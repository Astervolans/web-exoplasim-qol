import path from "node:path"
import { createServer } from "vite"
import { openPage } from "./trajectory.mjs"

// Checks the mixed-layer transport's operator through the kernels the model
// actually runs: after one step's worth of sub-steps, a wet field keeps its
// area-weighted mean, loses variance, and changes in proportion to the
// diffusivity and the total diffused time.
// Usage: node verify-ocean-transport.mjs
const server = await createServer({
	server: { host: "127.0.0.1", port: 0, watch: null },
	logLevel: "error",
})
await server.listen()
const { browser, page, errors } = await openPage(server)
try {
	const cases = await page.evaluate(async () => {
		const { GCM_DEVICE } = await import("/src/model/climate/gcm/device/index.ts")
		const { GCM_GRID } = await import("/src/model/climate/gcm/grid/index.ts")
		const { KERNEL } = await import("/src/model/climate/gcm/kernel/index.ts")
		const { LAYOUT } = await import("/src/model/climate/gcm/layout/index.ts")
		const { OCEAN } = await import("/src/model/climate/gcm/physics/ocean/index.ts")
		const { SURFACE } = await import(
			"/src/model/climate/gcm/physics/surface/index.ts"
		)
		const { SETUP } = await import("/src/model/climate/gcm/setup/index.ts")
		const { STEPPER } = await import("/src/model/climate/gcm/stepper/index.ts")
		const { device, adapter } = await GCM_DEVICE.request({
			storageBytes: 0,
			onLost: () => {},
		})
		const results = []
		for (const truncation of [21, 63]) {
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
			const request = { truncation, levels: 10, namelists }
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
			for (const [name, values] of Object.entries(initial.fields))
				if (context.state.slots[name]) write({ name, values })
			const base = schedule.main.stepper.surface
			const field = new Float32Array(grid.points)
			const land = new Float32Array(grid.points)
			for (let row = 0; row < grid.latitudes; row++) {
				const phi = Math.asin(grid.latitudeSines[row])
				for (let column = 0; column < grid.longitudes; column++) {
					const at = row * grid.longitudes + column
					const lambda = (2 * Math.PI * column) / grid.longitudes
					field[at] =
						290 +
						20 * Math.cos(phi) * Math.cos(2 * lambda) +
						5 * Math.cos(phi) * Math.cos(lambda * 6)
					// a zonal wall, so the land mask has to block the flux
					land[at] = column === 3 ? 1 : 0
				}
			}
			const read = (names) =>
				LAYOUT.read({
					device,
					buffer: context.stateBuffer,
					layout: context.state,
					names,
				})
			const measure = async ({ diffusivity, seconds }) => {
				write({ name: "ysst", values: field })
				write({ name: "yls", values: land })
				const plan = OCEAN.transport({
					diffusivity,
					stepSeconds: seconds,
					dimensions,
				})
				const kernels = await SURFACE.kernels({
					context,
					constants: { ...base, ocean: { ...base.ocean, HCOND: diffusivity } },
				})
				const encoder = device.createCommandEncoder()
				const pass = encoder.beginComputePass()
				for (const kernel of kernels.slice(-plan.steps))
					KERNEL.dispatch({ pass, context, kernel })
				pass.end()
				device.queue.submit([encoder.finish()])
				const after = await read(["ysst"])
				let weight = 0
				let mean = 0
				let variance = 0
				let change = 0
				let largest = 0
				let leaked = 0
				for (let row = 0; row < grid.latitudes; row++) {
					const rowWeight = grid.latitudeWeights[row]
					for (let column = 0; column < grid.longitudes; column++) {
						const at = row * grid.longitudes + column
						const next = after.ysst[at]
						if (land[at] >= 1) {
							leaked = Math.max(leaked, Math.abs(next - field[at]))
							continue
						}
						const delta = next - field[at]
						weight += rowWeight
						mean += delta * rowWeight
						variance += delta * delta * rowWeight
						change += (next * next - field[at] * field[at]) * rowWeight
						largest = Math.max(largest, Math.abs(delta))
					}
				}
				return {
					diffusivity,
					steps: plan.steps,
					tauSeconds: plan.tauSeconds,
					meanShift: mean / weight,
					meanShiftFraction: Math.abs(mean / weight) / largest,
					varianceChange: variance / weight,
					squaredSumChange: change / weight,
					largestChange: largest,
					landChange: leaked,
				}
			}
			const cases = []
			for (const diffusivity of [50000, 100000, 200000])
				cases.push(await measure({ diffusivity, seconds: 1800 }))
			results.push({ truncation, cases })
		}
		device.destroy()
		return { adapter: `${adapter.vendor} ${adapter.architecture}`, results }
	})
	console.log(JSON.stringify({ ...cases, errors }, null, 2))
} finally {
	await browser.close()
	await server.close()
}
