import { createServer } from "vite"
import { openPage } from "./trajectory.mjs"

// Checks the wind-driven surface current through the kernel the model
// dispatches: finite everywhere, zero on land, and carrying the banded
// structure the wind implies, with the magnitude a mixed layer gives.
// Usage: node verify-ocean-currents.mjs
const STEPS = 480

const server = await createServer({
	server: { host: "127.0.0.1", port: 0, watch: null },
	logLevel: "error",
})
await server.listen()
const { browser, page, errors } = await openPage(server)
try {
	const report = await page.evaluate(async ({ steps }) => {
		const { GCM_DEVICE } = await import("/src/model/climate/gcm/device/index.ts")
		const { GCM_GRID } = await import("/src/model/climate/gcm/grid/index.ts")
		const { LAYOUT } = await import("/src/model/climate/gcm/layout/index.ts")
		const { SETUP } = await import("/src/model/climate/gcm/setup/index.ts")
		const { GCM_FIELDS } = await import("/src/model/climate/gcm/fields/index.ts")
		const { SNAPSHOT } = await import("/src/model/climate/gcm/snapshot/index.ts")
		const { STEPPER } = await import("/src/model/climate/gcm/stepper/index.ts")
		const { device, adapter } = await GCM_DEVICE.request({
			storageBytes: 0,
			onLost: () => {},
		})
		const results = []
		for (const truncation of [21, 42, 63]) {
			const grid = GCM_GRID.forTruncation(truncation)
			const dimensions = {
				truncation,
				latitudes: grid.latitudes,
				longitudes: grid.longitudes,
				levels: 10,
			}
			const namelists = {
				plasim_namelist:
					" &plasim_nl\n MPSTEP = 30.0\n N_DAYS_PER_YEAR = 360\n /END\n",
				oceanmod_namelist: " &oceanmod_nl\n MLDEPTH = 50\n /END\n",
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
			const table = (values) =>
				LAYOUT.write({
					device,
					buffer: context.tableBuffer,
					layout: context.tables,
					name: "bm1",
					values: Float32Array.from(values),
				})
			for (const [name, values] of Object.entries(initial.fields))
				if (context.state.slots[name]) write({ name, values })
			let step = schedule.startStep
			let carbonStep = 0
			const run = async ({ kernels }) => {
				const values = STEPPER.values({
					step,
					carbonStep,
					calendar: schedule.calendar,
				})
				carbonStep = values.carbonStep
				// The pack kernel only publishes when the runner sets this
				// interval flag, which STEPPER.batch does for a publishing step.
				values.fields.snapshot_step[2] = 1
				for (const [name, field] of Object.entries(values.fields))
					write({ name, values: field })
				const encoder = device.createCommandEncoder()
				const pass = encoder.beginComputePass()
				STEPPER.encode({ pass, context, kernels })
				pass.end()
				device.queue.submit([encoder.finish()])
				step++
			}
			for (const phase of schedule.startup) {
				table(phase.bm1)
				await run({
					kernels: await STEPPER.kernels({
						context,
						constants: phase.stepper,
					}),
				})
			}
			table(schedule.main.bm1)
			const kernels = await STEPPER.kernels({
				context,
				constants: schedule.main.stepper,
			})
			// The publish kernel is separate from the step's own dispatch list.
			const pack = await SNAPSHOT.kernel({
				context,
				sigma: schedule.tables.dynamics.sigma,
				humidity: schedule.main.stepper.precipitation,
			})
			for (let index = 0; index < steps; index++) await run({ kernels })
			await (async () => {
				const values = STEPPER.values({
					step,
					carbonStep,
					calendar: schedule.calendar,
				})
				carbonStep = values.carbonStep
				values.fields.snapshot_step[2] = 1
				for (const [name, field] of Object.entries(values.fields))
					write({ name, values: field })
				const encoder = device.createCommandEncoder()
				const pass = encoder.beginComputePass()
				STEPPER.encode({ pass, context, kernels: [...kernels, pack] })
				pass.end()
				device.queue.submit([encoder.finish()])
				step++
			})()
			const fields = await LAYOUT.read({
				device,
				buffer: context.stateBuffer,
				layout: context.state,
				names: ["ocean_u", "ocean_v", "yls", "dtaux", "dtauy", "snapshot"],
			})
			// The published snapshot carries the currents after the model fields.
			const points = dimensions.latitudes * dimensions.longitudes
			const publishedFields = GCM_FIELDS.fieldCount(10)
			let packedU = 0
			let packedV = 0
			for (let at = 0; at < points; at++) {
				packedU = Math.max(
					packedU,
					Math.abs(fields.snapshot[publishedFields * points + at] - fields.ocean_u[at]),
				)
				packedV = Math.max(
					packedV,
					Math.abs(
						fields.snapshot[(publishedFields + 1) * points + at] - fields.ocean_v[at],
					),
				)
			}
			let wet = 0
			let land = 0
			let landCurrent = 0
			let finite = true
			let minSpeed = Number.POSITIVE_INFINITY
			let maxSpeed = 0
			let meanSpeed = 0
			let maxStress = 0
			const rows = []
			for (let row = 0; row < grid.latitudes; row++) {
				let u = 0
				let weight = 0
				for (let column = 0; column < grid.longitudes; column++) {
					const at = row * grid.longitudes + column
					if (fields.yls[at] >= 1) {
						land++
						landCurrent = Math.max(
							landCurrent,
							Math.hypot(fields.ocean_u[at], fields.ocean_v[at]),
						)
						continue
					}
					const speed = Math.hypot(fields.ocean_u[at], fields.ocean_v[at])
					if (!Number.isFinite(speed)) finite = false
					wet++
					minSpeed = Math.min(minSpeed, speed)
					maxSpeed = Math.max(maxSpeed, speed)
					meanSpeed += speed
					maxStress = Math.max(
						maxStress,
						Math.hypot(fields.dtaux[at], fields.dtauy[at]),
					)
					u += fields.ocean_u[at]
					weight++
				}
				if (weight > 0)
					rows.push({ latitude: Math.round(grid.latitudesDeg[row]), meanU: u / weight })
			}
			const reversals = rows
				.filter(
					(entry, index) =>
						index > 0 && Math.sign(entry.meanU) !== Math.sign(rows[index - 1].meanU),
				)
				.map((entry) => entry.latitude)
			results.push({
				truncation,
				wet,
				land,
				finite,
				landCurrent,
				minSpeed,
				maxSpeed,
				meanSpeed: meanSpeed / wet,
				maxStressPa: maxStress,
				snapshotCurrentError: Math.max(packedU, packedV),

				reversals,
				zonalMeans: rows.filter(
					(_, index) => index % Math.ceil(rows.length / 10) === 0,
				),
			})
		}
		device.destroy()
		return { adapter: `${adapter.vendor} ${adapter.architecture}`, results }
	}, { steps: STEPS })
	console.log(JSON.stringify({ ...report, errors }, null, 2))
} finally {
	await browser.close()
	await server.close()
}