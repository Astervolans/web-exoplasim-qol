import fs from "node:fs/promises"
import path from "node:path"
import { createServer } from "vite"
import { openPage } from "./trajectory.mjs"

// One benchmark series: a fresh-start GPU run of the page's inputs at a given
// truncation and timestep, with each mixed-layer diffusivity measured in turn
// so the cases share the machine's state. Each measurement submits one command
// buffer per step without draining the queue, which is the page's steady state.
// Usage: node benchmark-ocean.mjs <truncation> <minutes> <steps> <repetitions> <diffusivity> [output.json]
const truncation = Number(process.argv[2] ?? 21)
const minutes = Number(process.argv[3] ?? 45)
const steps = Number(process.argv[4] ?? 400)
const repetitions = Number(process.argv[5] ?? 5)
const diffusivity = Number(process.argv[6] ?? 100000)
const output = process.argv[7] ? path.resolve(process.argv[7]) : null
// PlaSim's NSTPW window, as GCM_NAMELIST derives it.
const NSTPW_WINDOW_MINUTES = 7200
const WARMUP = 50

const server = await createServer({
	server: { host: "127.0.0.1", port: 0, watch: null },
	logLevel: "error",
})
await server.listen()
const { browser, page, errors } = await openPage(server)
try {
	const { GCM_NAMELIST } = await server.ssrLoadModule(
		path.resolve("src/model/climate/gcm/namelist/index.ts"),
	)
	const { files } = JSON.parse(
		await fs.readFile(`public/gcm/t${truncation}/inputs.json`, "utf8"),
	)
	const apply = (text, values) => GCM_NAMELIST.apply({ text, values })
	const namelists = {
		...files,
		plasim_namelist: apply(files.plasim_namelist, {
			MPSTEP: String(minutes),
			NSTPW: String(Math.floor(NSTPW_WINDOW_MINUTES / minutes)),
		}),
	}
	const result = await page.evaluate(
		async ({ truncation, steps, warmup, repetitions, diffusivity, namelists }) => {
			const { GCM_DEVICE } = await import(
				"/src/model/climate/gcm/device/index.ts"
			)
			const { GCM_GRID } = await import("/src/model/climate/gcm/grid/index.ts")
			const { LAYOUT } = await import("/src/model/climate/gcm/layout/index.ts")
			const { SETUP } = await import("/src/model/climate/gcm/setup/index.ts")
			const { STEPPER } = await import(
				"/src/model/climate/gcm/stepper/index.ts"
			)
			const grid = GCM_GRID.forTruncation(truncation)
			const dimensions = {
				truncation,
				latitudes: grid.latitudes,
				longitudes: grid.longitudes,
				levels: 10,
			}
			const request = {
				truncation,
				levels: 10,
				namelists,
				oceanDiffusivityM2S: 0,
				oceanCurrents: true,
			}
			const initial = SETUP.state({ ...request, clock: 0 })
			const schedule = SETUP.schedule({ request, state: initial })
			const { device, adapter } = await GCM_DEVICE.request({
				storageBytes: 0,
				onLost: () => {},
			})
			const context = STEPPER.context({
				device,
				dimensions,
				tables: schedule.tables,
			})
			const write = ({ name, values }) =>
				LAYOUT.write({
					device,
					buffer: context.stateBuffer,
					layout: context.state,
					name,
					values: Float32Array.from(values),
				})
			for (const [name, values] of Object.entries(initial.fields))
				if (context.state.slots[name]) write({ name, values })
			const writeTable = (values) =>
				LAYOUT.write({
					device,
					buffer: context.tableBuffer,
					layout: context.tables,
					name: "bm1",
					values: Float32Array.from(values),
				})
			const probe = device.createBuffer({
				size: 4,
				usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
			})
			// The ocean's constants are the only thing a case changes: the first
			// case is the model without the feature, the second is with it.
			const stepper = ({ diffusivity, currents }) => ({
				...schedule.main.stepper,
				surface: {
					...schedule.main.stepper.surface,
					ocean: {
						...schedule.main.stepper.surface.ocean,
						HCOND: diffusivity,
						CURRENTS: currents,
					},
				},
			})
			const startup = await Promise.all(
				schedule.startup.map((phase) =>
					STEPPER.kernels({ context, constants: phase.stepper }),
				),
			)
			const cases = [
				{ diffusivity: 0, currents: 0 },
				{ diffusivity, currents: 1 },
			]
			const main = []
			for (const entry of cases)
				main.push(await STEPPER.kernels({ context, constants: stepper(entry) }))
			const readback = async () => {
				const encoder = device.createCommandEncoder()
				encoder.copyBufferToBuffer(context.stateBuffer, 0, probe, 0, 4)
				device.queue.submit([encoder.finish()])
				await probe.mapAsync(GPUMapMode.READ)
				probe.unmap()
			}
			const run = async ({ at, count, kernels, timed }) => {
				const querySet = timed
					? device.createQuerySet({ type: "timestamp", count: 2 * count })
					: null
				const resolve = timed
					? device.createBuffer({
							size: 16 * count,
							usage:
								GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
						})
					: null
				const staging = timed
					? device.createBuffer({
							size: 16 * count,
							usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
						})
					: null
				const started = performance.now()
				for (let index = 0; index < count; index++) {
					const values = STEPPER.values({
						step: at + index,
						carbonStep: counter,
						calendar: schedule.calendar,
					})
					counter = values.carbonStep
					for (const [name, field] of Object.entries(values.fields))
						write({ name, values: field })
					const encoder = device.createCommandEncoder()
					const pass = encoder.beginComputePass(
						timed
							? {
									timestampWrites: {
										querySet,
										beginningOfPassWriteIndex: 2 * index,
										endOfPassWriteIndex: 2 * index + 1,
									},
								}
							: {},
					)
					STEPPER.encode({ pass, context, kernels })
					pass.end()
					device.queue.submit([encoder.finish()])
				}
				if (!timed) {
					await readback()
					return { wall: performance.now() - started, gpu: null }
				}
				const encoder = device.createCommandEncoder()
				encoder.resolveQuerySet(querySet, 0, 2 * count, resolve, 0)
				encoder.copyBufferToBuffer(resolve, 0, staging, 0, 16 * count)
				device.queue.submit([encoder.finish()])
				await staging.mapAsync(GPUMapMode.READ)
				const wall = performance.now() - started
				const timestamps = new BigUint64Array(staging.getMappedRange())
				let gpu = 0
				for (let index = 0; index < count; index++)
					gpu += Number(timestamps[2 * index + 1] - timestamps[2 * index])
				staging.unmap()
				staging.destroy()
				resolve.destroy()
				querySet.destroy()
				return { wall, gpu: gpu / 1e6 }
			}
			// Start-up phases: their own bm1 and kernels, one command buffer each.
			for (let index = 0; index < schedule.startup.length; index++) {
				writeTable(schedule.startup[index].bm1)
				const encoder = device.createCommandEncoder()
				const pass = encoder.beginComputePass()
				STEPPER.encode({ pass, context, kernels: startup[index] })
				pass.end()
				device.queue.submit([encoder.finish()])
			}
			await readback()
			writeTable(schedule.main.bm1)
			let counter = 0
			let at = schedule.startStep
			const samples = cases.map(() => [])
			for (let repetition = 0; repetition < repetitions; repetition++) {
				for (let index = 0; index < cases.length; index++) {
					await run({ at, count: warmup, kernels: main[index], timed: false })
					at += warmup
					samples[index].push(
						await run({ at, count: steps, kernels: main[index], timed: true }),
					)
					at += steps
				}
			}
			const fields = await LAYOUT.read({
				device,
				buffer: context.stateBuffer,
				layout: context.state,
				names: ["ysst", "yls"],
			})
			let wetWeight = 0
			let mean = 0
			let finite = true
			const bands = { tropical: [0, 0], polar: [0, 0] }
			for (let row = 0; row < grid.latitudes; row++) {
				const weight = grid.latitudeWeights[row]
				const latitude = grid.latitudesDeg[row]
				const band =
					Math.abs(latitude) < 23
						? bands.tropical
						: Math.abs(latitude) > 60
							? bands.polar
							: null
				for (let column = 0; column < grid.longitudes; column++) {
					const point = row * grid.longitudes + column
					if (fields.yls[point] >= 1) continue
					const value = fields.ysst[point]
					if (!Number.isFinite(value)) finite = false
					mean += value * weight
					wetWeight += weight
					if (band) {
						band[0] += value * weight
						band[1] += weight
					}
				}
			}
			device.destroy()
			const sorted = (values) => [...values].sort((a, b) => a - b)
			return {
				adapter: `${adapter.vendor} ${adapter.architecture}`,
				steps,
				warmup,
				repetitions,
				cases: cases.map((entry, index) => {
					const walls = sorted(samples[index].map((sample) => sample.wall))
					const gpus = sorted(
						samples[index].map((sample) => sample.gpu ?? sample.wall),
					)
					return {
						diffusivity: entry.diffusivity,
						currents: entry.currents,
						dispatches: main[index].length,
						walls: samples[index].map((sample) => sample.wall),
						gpus: samples[index].map((sample) => sample.gpu),
						wall: { min: walls[0], median: walls[Math.floor(walls.length / 2)] },
						gpu: { min: gpus[0], median: gpus[Math.floor(gpus.length / 2)] },
					}
				}),
				finalState: {
					wetPoints: wetWeight > 0,
					meanSeaSurface: mean / wetWeight,
					tropical: bands.tropical[0] / bands.tropical[1],
					polar: bands.polar[0] / bands.polar[1],
					contrast:
						bands.tropical[0] / bands.tropical[1] -
						bands.polar[0] / bands.polar[1],
					finite,
				},
			}
		},
		{ truncation, steps, warmup: WARMUP, repetitions, diffusivity, namelists },
	)
	const summary = {
		truncation,
		minutes,
		chrome: browser.version(),
		errors,
		...result,
	}
	for (const benchmark of summary.cases) {
		benchmark.gpuMillisecondsPerStep = benchmark.gpu.min / steps
		benchmark.wallMillisecondsPerStep = benchmark.wall.min / steps
	}
	console.log(JSON.stringify(summary))
	if (output) await fs.writeFile(output, `${JSON.stringify(summary, null, 2)}\n`)
} finally {
	await browser.close()
	await server.close()
}
