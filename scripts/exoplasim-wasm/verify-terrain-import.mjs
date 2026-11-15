import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { encode } from "fast-png"
import { chromium } from "playwright"

const baseUrl = process.env.TERRAIN_TEST_URL ?? "http://127.0.0.1:5176"
const output = path.resolve("stats/terrain-import")
const fixture = JSON.parse(await readFile(path.join(output, "fixture.json"), "utf8"))
const name = `chaos-world-${fixture.seed}`
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
try {
	await page.goto(baseUrl)
	const core = await page.evaluate(async ({ name, fixture }) => {
		const { GCM_TERRAIN_IMPORT } = await import("/src/model/climate/gcm/terrain/import/index.ts")
		const { GCM_TERRAIN } = await import("/src/model/climate/gcm/terrain/index.ts")
		const { GCM_BOUNDARY } = await import("/src/model/climate/gcm/boundary/index.ts")
		const { GCM_DOWNSCALE } = await import("/src/model/climate/gcm/downscale/index.ts")
		const { GCM_GRID } = await import("/src/model/climate/gcm/grid/index.ts")
		const { GCM_FIELDS } = await import("/src/model/climate/gcm/fields/index.ts")
		const { GCM_TERRAIN_REGRID } = await import("/src/model/climate/gcm/terrain/regrid/index.ts")
		const { GCM_MAP_ORIENTATION } = await import("/src/ui/gcm/map-orientation/index.ts")
		const { GCM_STAR_POINTS } = await import("/src/ui/gcm/star-points/index.ts")
		const { GCM_ZONE_CIRCLES } = await import("/src/ui/gcm/zone-circles/index.ts")
		const { GCM_CHECKPOINT } = await import("/src/model/climate/gcm/checkpoint/index.ts")
		const { GCM } = await import("/src/model/climate/gcm/index.ts")
		const { GCM_AVERAGES } = await import("/src/model/climate/gcm/averages/index.ts")
		const { GCM_TERRAIN_ORIENTATION } = await import("/src/model/climate/gcm/terrain/orientation/index.ts")
		const check = (condition, message) => { if (!condition) throw new Error(message) }
		const rejects = (operation) => { try { operation(); return false } catch { return true } }
		const identity = { poleLatitudeDeg: 90, poleLongitudeDeg: 0, spinDeg: 0 }
		const read = async (extension) => GCM_TERRAIN_IMPORT.read({ name: `${name}.${extension}`, buffer: await (await fetch(`/stats/terrain-import/${name}.${extension}`)).arrayBuffer() })
		const heightmap = await read("bin")
		const mask = await read("land-mask.png")
		const mapping = { maxElevationM: 8000, seaLevel: 128, invertMask: false }
		const terrain = GCM_TERRAIN_IMPORT.create({ heightmap, mask, mapping, orientation: identity })
		let differences = 0
		for (let i = 0; i < terrain.land.length; i++) {
			check(terrain.land[i] === Number(mask.samples[i] >= 0.5), "Explicit land mask changed")
			differences += Number((terrain.land[i] > 0) !== (terrain.elevationM[i] > 0))
		}
		const sample = { name: "sample", width: 4, height: 2, encoding: "normalized", samples: new Float32Array([0, 0.25, 0.5, 0.75, 1, 0, 0.5, 1]) }
		const sampleMapping = { ...mapping, seaLevel: 127.5 }
		const derived = GCM_TERRAIN_IMPORT.create({ heightmap: sample, mask: null, mapping: sampleMapping, orientation: identity })
		check(derived.elevationM.join(",") === "0,0,0,4000,8000,0,0,8000", "Elevation scaling failed")
		check(derived.land.join(",") === "0,0,0,1,1,0,0,1", "Land threshold failed")
		const dim = { ...sample, samples: new Float32Array([0, 0.25, 0.5, 0.75, 0.75, 0, 0.5, 0.75]) }
		const dimTerrain = GCM_TERRAIN_IMPORT.create({ heightmap: dim, mask: null, mapping: sampleMapping, orientation: identity })
		check(dimTerrain.elevationM[3] === 8000 && dimTerrain.elevationM[2] === 0, "Brightest sample must reach the maximum elevation")
		const flooded = GCM_TERRAIN_IMPORT.create({ heightmap: dim, mask: null, mapping: { ...mapping, seaLevel: 200 }, orientation: identity })
		check(flooded.elevationM.every((value) => value === 0), "Cutoff above the brightest sample must flatten the terrain")
		const white = GCM_TERRAIN_IMPORT.create({ heightmap: sample, mask: null, mapping: { ...mapping, seaLevel: 255 }, orientation: identity })
		check(white.land.every((value) => value === 0) && white.elevationM.every((value) => value === 0), "White cutoff failed")
		const inverted = GCM_TERRAIN_IMPORT.create({ heightmap, mask, mapping: { ...mapping, invertMask: true }, orientation: identity })
		check(inverted.land.every((value, i) => value === 1 - terrain.land[i]), "Invert mask is incorrect")
		check(rejects(() => GCM_TERRAIN_IMPORT.read({ name: "broken.bin", buffer: new ArrayBuffer(4) })), "Wrong binary length accepted")
		check(rejects(() => GCM_TERRAIN_IMPORT.create({ heightmap, mask: { ...mask, width: 4 }, mapping, orientation: identity })), "Mismatched mask accepted")
		check(rejects(() => GCM_TERRAIN_IMPORT.create({ heightmap, mask, mapping: { ...mapping, maxElevationM: -1 }, orientation: identity })), "Invalid height mapping accepted")
		const quadrants = { name: "quadrants", width: 4, height: 2, elevationM: new Float32Array([100, 100, 200, 200, 300, 300, 400, 400]), land: new Float32Array(8).fill(1), orientation: identity }
		for (const latitudes of [32, 64]) {
			const grid = GCM_GRID.forLatitudes(latitudes)
			const boundary = GCM_BOUNDARY.fromTerrain({ gravityMs2: 9.80665, grid, terrain })
			check(boundary.landFraction.every((value) => Number.isFinite(value) && value >= -1e-12 && value <= 1 + 1e-12), "Invalid regridded land coverage")
			check(boundary.geopotential.every(Number.isFinite), "Nonfinite geopotential")
			const oriented = GCM_BOUNDARY.fromTerrain({ gravityMs2: 9.80665, grid, terrain: quadrants })
			const west = grid.longitudes * 3 / 4
			const east = grid.longitudes / 4
			for (const [cell, expected] of [[west, 100], [east, 200], [(latitudes - 1) * grid.longitudes + west, 300], [(latitudes - 1) * grid.longitudes + east, 400]]) check(Math.abs(oriented.geopotential[cell] / 9.80665 - expected) < 1e-8, "Terrain orientation changed")
			for (const metres of [0, -100]) {
				const flat = { ...quadrants, elevationM: new Float32Array(8).fill(metres) }
				const result = GCM_BOUNDARY.fromTerrain({ gravityMs2: 9.80665, grid, terrain: flat })
				check(result.landFraction.every((value) => value === 1), "Flat/below-sea land lost")
				check(result.geopotential.every((value) => Math.abs(value / 9.80665 - metres) < 1e-8), "Flat/below-sea terrain changed")
			}
		}
		const downscale = GCM_DOWNSCALE.create({ grid: GCM_GRID.forLatitudes(32), terrain, factor: 2 })
		check(downscale.elevationM.every(Number.isFinite) && downscale.cellElevationM.every(Number.isFinite), "Downscale produced nonfinite terrain")
		const small = GCM_DOWNSCALE.create({ grid: GCM_GRID.forLatitudes(32), terrain: quadrants, factor: 1 })
		check(small.land.every((value) => value === 1), "Downscale lost explicit land")
		const meta = { format: GCM_CHECKPOINT.FORMATS.cpu, config: GCM.DEFAULT_CONFIG, precisionBytes: 8, date: { year: 1, month: 1, day: 1, hour: 0, minute: 0 }, step: 0 }
		const points = GCM_GRID.forTruncation(meta.config.truncation).points
		const snapshot = { step: 0, date: meta.date, layers: meta.config.layers, values: new Float32Array(points * GCM_FIELDS.fieldCount(meta.config.layers)) }
		const checkpoint = { terrain, meta, restart: new Uint8Array([1, 2, 3]).buffer, diagnostics: { averager: GCM_AVERAGES.create(), snapshot } }
		const restored = GCM_CHECKPOINT.decode(GCM_CHECKPOINT.encode(checkpoint))
		check(restored.terrain.elevationM.every((value, i) => value === terrain.elevationM[i]) && restored.terrain.land.every((value, i) => value === terrain.land[i]), "Checkpoint lost terrain")
		const tilt = { poleLatitudeDeg: 0, poleLongitudeDeg: 0, spinDeg: 0 }
		const tiltRotation = GCM_TERRAIN_ORIENTATION.rotation(tilt)
		const sourcePole = GCM_TERRAIN_ORIENTATION.toModel({ rotation: tiltRotation, latitude: 90, longitude: 0 })
		check(Math.abs(sourcePole.latitude) < 1e-9 && Math.abs(sourcePole.longitude) < 1e-9, "Orientation did not place the map pole on the model equator")
		const roundTrip = GCM_TERRAIN_ORIENTATION.toSource({ rotation: tiltRotation, latitude: 12.5, longitude: 42 })
		const roundTripBack = GCM_TERRAIN_ORIENTATION.toModel({ rotation: tiltRotation, latitude: roundTrip.latitude, longitude: roundTrip.longitude })
		check(Math.abs(roundTripBack.latitude - 12.5) < 1e-9 && Math.abs(((roundTripBack.longitude - 42 + 540) % 360) - 180) < 1e-9, "Orientation round trip failed")
		const marked = { name: "tilted pixel", width: 8, height: 4, elevationM: new Float32Array(32), land: new Float32Array(32), orientation: tilt }
		marked.elevationM[3] = 1000
		marked.land[3] = 1
		const pixelLatitude = 90 - (0.5 / 4) * 180
		const pixelLongitude = -180 + (3.5 / 8) * 360
		const mapped = GCM_TERRAIN_ORIENTATION.toModel({ rotation: tiltRotation, latitude: pixelLatitude, longitude: pixelLongitude })
		const hit = GCM_TERRAIN_REGRID.cell({ terrain: marked, rotation: tiltRotation, north: mapped.latitude + 0.25, south: mapped.latitude - 0.25, west: mapped.longitude - 0.25, east: mapped.longitude + 0.25 })
		check(hit.elevationM > 0 && hit.landFraction > 0.9, "Rotated terrain did not follow the orientation")
		const opposite = GCM_TERRAIN_REGRID.cell({ terrain: marked, rotation: tiltRotation, north: -mapped.latitude + 0.25, south: -mapped.latitude - 0.25, west: mapped.longitude + 179.75, east: mapped.longitude + 180.25 })
		check(opposite.elevationM === 0 && opposite.landFraction === 0, "Rotated terrain appeared on the opposite side")
		const restoredTilt = GCM_CHECKPOINT.decode(GCM_CHECKPOINT.encode({ ...checkpoint, terrain: marked }))
		check(restoredTilt.terrain.orientation.poleLatitudeDeg === 0, "Checkpoint lost the terrain orientation")
		const markWidth = 8
		const markHeight = 4
		const markColumn = 3
		const markRow = 1
		const displayLatitude = 90 - ((markRow + 0.5) / markHeight) * 180
		const displayLongitude = -180 + ((markColumn + 0.5) / markWidth) * 360
		const markModel = GCM_TERRAIN_ORIENTATION.toModel({ rotation: tiltRotation, latitude: displayLatitude, longitude: displayLongitude })
		const sourceColumn = Math.floor(((((markModel.longitude + 180) % 360) / 360) * markWidth))
		const sourceRow = Math.floor(((90 - markModel.latitude) / 180) * markHeight)
		const modelRaster = new Uint8ClampedArray(markWidth * markHeight * 4)
		modelRaster[(sourceRow * markWidth + sourceColumn) * 4] = 255
		const orientedRaster = GCM_MAP_ORIENTATION.resample({ orientation: tilt, width: markWidth, height: markHeight, source: modelRaster, nearest: true })
		check(orientedRaster[(markRow * markWidth + markColumn) * 4] === 255, "Oriented map resampling misplaced the model pixel")
		const repeatedRaster = GCM_MAP_ORIENTATION.resample({ orientation: tilt, width: markWidth, height: markHeight, source: modelRaster, nearest: true })
		check(repeatedRaster.every((value, index) => value === orientedRaster[index]), "Cached map projection changed the resampled raster")
		const fixedStar = GCM_STAR_POINTS.model({ obliquityDeg: 23.5, substellarLongitudeDeg: 90, periapseLongitudeDeg: 102.7, keplerian: false })
		check(Math.abs(fixedStar[0].latitude - 23.5) < 1e-9 && Math.abs(fixedStar[0].longitude - 90) < 1e-9, "Sub-stellar point placement failed")
		check(Math.abs(fixedStar[1].latitude + 23.5) < 1e-9 && Math.abs(fixedStar[1].longitude - 270) < 1e-9, "Anti-stellar point placement failed")
		const perihelion = ((102.7 + 180) * Math.PI) / 180
		const shift = (Math.atan2(Math.cos((23.5 * Math.PI) / 180) * Math.sin(perihelion), Math.cos(perihelion)) * 180) / Math.PI
		const keplerianStar = GCM_STAR_POINTS.model({ obliquityDeg: 23.5, substellarLongitudeDeg: 90, periapseLongitudeDeg: 102.7, keplerian: true })
		check(Math.abs(keplerianStar[0].longitude - (((90 + shift) % 360) + 360) % 360) < 1e-9, "Keplerian star-point correction failed")
		const starDisplay = GCM_STAR_POINTS.display({ points: fixedStar, orientation: tilt })
		const expectedStar = GCM_TERRAIN_ORIENTATION.toSource({ rotation: tiltRotation, latitude: 23.5, longitude: 90 })
		check(Math.abs(starDisplay[0].latitude - expectedStar.latitude) < 1e-9 && Math.abs(((starDisplay[0].longitude - expectedStar.longitude + 540) % 360) - 180) < 1e-9, "Star-point display conversion failed")
		const zones = GCM_ZONE_CIRCLES.model({ obliquityDeg: 23.5 })
		check(zones[0].kind === "tropic" && Math.abs(zones[0].latitude - 23.5) < 1e-9, "Tropic of Cancer placement failed")
		check(zones[1].kind === "tropic" && Math.abs(zones[1].latitude + 23.5) < 1e-9, "Tropic of Capricorn placement failed")
		check(zones[2].kind === "polar" && Math.abs(zones[2].latitude - 66.5) < 1e-9, "Arctic Circle placement failed")
		check(zones[3].kind === "polar" && Math.abs(zones[3].latitude + 66.5) < 1e-9, "Antarctic Circle placement failed")
		const highZones = GCM_ZONE_CIRCLES.model({ obliquityDeg: 60 })
		check(Math.abs(highZones[0].latitude - 60) < 1e-9 && Math.abs(highZones[2].latitude - 30) < 1e-9, "High-obliquity zone circles failed")
		check(GCM_ZONE_CIRCLES.display({ circles: zones, orientation: tilt }).every((path) => path.segments.length > 0), "Zone circle display conversion failed")
		return { ...GCM_TERRAIN.summary(terrain), explicitMaskDifferences: differences, checkpointFormat: GCM_CHECKPOINT.FORMATS.cpu }
	}, { name, fixture })
	console.log("Terrain core checks", core)
	await page.goto(`${baseUrl}/gcm`)
	await page.getByRole("button", { name: "Import terrain" }).click()
	await page.getByLabel("Heightmap", { exact: true }).setInputFiles(path.join(output, `${name}.bin`))
	await page.getByRole("button", { name: "Apply terrain", exact: true }).waitFor()
	await page.getByLabel("Land mask", { exact: true }).setInputFiles(path.join(output, `${name}.land-mask.png`))
	await page.getByRole("img", { name: /^Land mask/ }).waitFor()
	await page.getByRole("button", { name: "Edit North pole latitude" }).click()
	const poleLatitude = page.getByRole("spinbutton", { name: "North pole latitude", exact: true })
	await poleLatitude.fill("0")
	await poleLatitude.press("Enter")
	await page.getByRole("button", { name: "Apply terrain", exact: true }).click()
	await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 })
	assert.equal(await page.getByRole("button", { name: "Use Earth", exact: true }).isEnabled(), true)
	await page.screenshot({ path: path.join(output, "terrain-import.png"), fullPage: true })
	await page.getByRole("button", { name: "Start", exact: true }).click()
	await page.getByRole("button", { name: "Pause", exact: true }).waitFor({ timeout: 60000 })
	await page.waitForFunction(() => {
		const text = document.body.innerText
		return !text.includes("No data yet") && !text.includes("Loading ExoPlaSim")
	}, null, { timeout: 60000 })
	await page.getByRole("button", { name: "Pause", exact: true }).click()
	const downloadEvent = page.waitForEvent("download", { timeout: 60000 })
	await page.getByRole("button", { name: "Save", exact: true }).click()
	const download = await downloadEvent
	const checkpointFile = path.join(output, "custom-terrain.ckpt")
	await download.saveAs(checkpointFile)
	await page.getByRole("button", { name: "Resume", exact: true }).waitFor({ timeout: 60000 })
	await page.getByRole("button", { name: "Clear", exact: true }).click()
	await page.getByRole("button", { name: "Use Earth", exact: true }).click()
	await page.locator('input[accept=".ckpt"]').setInputFiles(checkpointFile)
	await page.getByRole("button", { name: "Resume", exact: true }).waitFor({ timeout: 60000 })
	await page.screenshot({ path: path.join(output, "terrain-checkpoint-restored.png"), fullPage: true })
	await page.getByRole("button", { name: "Clear", exact: true }).click()
	for (const extension of ["16bit.png", "8bit.png"]) {
		await page.getByRole("button", { name: "Import terrain" }).click()
		await page.getByLabel("Heightmap", { exact: true }).setInputFiles(path.join(output, `${name}.${extension}`))
		await page.getByRole("slider", { name: "Sea level", exact: true }).press("Home")
		await page.getByRole("spinbutton", { name: "Maximum elevation", exact: true }).fill("20000")
		await page.getByRole("button", { name: "Apply terrain", exact: true }).click()
		await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 })
	}
	await page.getByRole("button", { name: "Import terrain" }).click()
	await page.getByLabel("Invert mask", { exact: true }).check()
	await page.getByLabel("Invert mask", { exact: true }).uncheck()
	const bad = path.join(output, "invalid.png")
	await writeFile(bad, encode({ width: 4, height: 4, channels: 1, depth: 8, data: new Uint8Array(16) }))
	await page.getByLabel("Heightmap", { exact: true }).setInputFiles(bad)
	await page.getByRole("alert").waitFor()
	assert.equal(await page.getByRole("button", { name: "Apply terrain", exact: true }).isEnabled(), false)
	await page.getByRole("button", { name: "Close terrain import" }).click()
	await page.getByLabel("Tidally locked illumination", { exact: true }).check()
	const starToggle = page.getByLabel("Show sub-stellar and anti-stellar points", { exact: true })
	await starToggle.waitFor()
	await starToggle.check()
	await page.waitForTimeout(500)
	const starPixels = await page.evaluate(() => {
		const canvas = document.querySelector("main canvas")
		const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
		let amber = 0
		for (let index = 0; index < data.length; index += 4) {
			if (data[index + 3] < 200) continue
			if (data[index] > 200 && data[index + 1] > 110 && data[index + 1] < 200 && data[index + 2] < 90) amber++
		}
		return amber
	})
	assert(starPixels > 0, "Sub-stellar marker missing from the map")
	await page.screenshot({ path: path.join(output, "star-points.png"), fullPage: true })
	await page.getByLabel("Tidally locked illumination", { exact: true }).uncheck()
	await page.waitForTimeout(400)
	const clearedPixels = await page.evaluate(() => {
		const canvas = document.querySelector("main canvas")
		const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
		let amber = 0
		for (let index = 0; index < data.length; index += 4) {
			if (data[index + 3] < 200) continue
			if (data[index] > 200 && data[index + 1] > 110 && data[index + 1] < 200 && data[index + 2] < 90) amber++
		}
		return amber
	})
	assert.equal(clearedPixels, 0, "Star marker remained after disabling tidal locking")
	assert.equal(await starToggle.count(), 0, "Star toggle remained after disabling tidal locking")
	const zoneToggle = page.getByLabel("Show tropics and polar circles", { exact: true })
	await zoneToggle.waitFor()
	await zoneToggle.check()
	await page.waitForTimeout(400)
	const zonePixels = await page.evaluate(() => {
		const canvas = document.querySelector("main canvas")
		const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
		let orange = 0
		let violet = 0
		for (let index = 0; index < data.length; index += 4) {
			if (data[index + 3] < 200) continue
			const r = data[index]
			const g = data[index + 1]
			const b = data[index + 2]
			if (r > 200 && g < 210 && b < 150 && r - g > 40 && r - b > 100) orange++
			if (b > 190 && r > 90 && r < 230 && g < 200 && b - r > 30 && b - g > 45) violet++
		}
		return { orange, violet }
	})
	assert(zonePixels.orange > 0 && zonePixels.violet > 0, "Tropics and polar circles missing from the map")
	await page.screenshot({ path: path.join(output, "zone-circles.png"), fullPage: true })
	await page.getByLabel("Tidally locked illumination", { exact: true }).check()
	await page.waitForTimeout(400)
	assert.equal(await zoneToggle.count(), 0, "Zone toggle remained with tidal locking")
	const starToggleAfter = page.getByLabel("Show sub-stellar and anti-stellar points", { exact: true })
	if (await starToggleAfter.isChecked()) {
		await starToggleAfter.uncheck()
		await page.waitForTimeout(300)
	}
	const clearedZones = await page.evaluate(() => {
		const canvas = document.querySelector("main canvas")
		const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
		let colored = 0
		for (let index = 0; index < data.length; index += 4) {
			if (data[index + 3] < 200) continue
			const r = data[index]
			const g = data[index + 1]
			const b = data[index + 2]
			if (r > 200 && g < 210 && b < 150 && r - g > 40 && r - b > 100) colored++
			if (b > 190 && r > 90 && r < 230 && g < 200 && b - r > 30 && b - g > 45) colored++
		}
		return colored
	})
	assert.equal(clearedZones, 0, "Zone circles remained with tidal locking")
	await page.getByLabel("Tidally locked illumination", { exact: true }).uncheck()
	const racePage = await browser.newPage()
	racePage.on("pageerror", (error) => errors.push(error.message))
	let releaseEarth
	let earthRequested = false
	const earthGate = new Promise((resolve) => { releaseEarth = resolve })
	await racePage.route("**/earth-data/earth-real-elevation.bin.gz", async (route) => {
		earthRequested = true
		await earthGate
		await route.continue()
	})
	await racePage.goto(`${baseUrl}/gcm`)
	await racePage.getByRole("button", { name: "Import terrain" }).click()
	await racePage.getByLabel("Heightmap", { exact: true }).setInputFiles(path.join(output, `${name}.bin`))
	await racePage.getByRole("button", { name: "Apply terrain", exact: true }).click()
	assert(earthRequested, "Earth data request was not intercepted")
	releaseEarth()
	await racePage.waitForLoadState("networkidle")
	await racePage.getByRole("button", { name: "Use Earth", exact: true }).waitFor()
	assert.equal(await racePage.getByRole("button", { name: "Use Earth", exact: true }).isEnabled(), true)
	await racePage.close()
	assert.deepEqual(errors, [])
	await writeFile(path.join(output, "verification.json"), JSON.stringify({ fixture, core, browserErrors: errors, ui: "binary/8-bit/16-bit import, preview, orientation controls and tilted terrain run, star-point toggle and markers, tropics/polar-circle overlay, invert mask, pause, save, restore, invalid-file rejection, delayed-Earth selection race passed" }, null, 2))
	console.log("Terrain import UI and checkpoint checks passed")
} catch (error) {
	await page.screenshot({ path: path.join(output, "terrain-test-failure.png"), fullPage: true }).catch(() => {})
	throw error
} finally {
	await browser.close()
}
