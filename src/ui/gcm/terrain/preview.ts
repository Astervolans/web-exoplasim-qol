import { GCM_TERRAIN_ORIENTATION } from "@/model/climate/gcm/terrain/orientation"
import { uiPalette } from "@/ui/components/tokens"
import { GCM_STAR_POINTS } from "@/ui/gcm/star-points"
import type { GcmStarGlyph } from "@/ui/gcm/star-points/types"
import type {
	GcmTerrainCanvasRequest,
	GcmTerrainGridRequest,
	GcmTerrainMaskCache,
	GcmTerrainPaint,
	GcmTerrainStrokeRequest,
} from "@/ui/gcm/terrain/types"
import { GCM_ZONE_CIRCLES } from "@/ui/gcm/zone-circles"

const GRATICULE_STEP_DEG = 30
const GRATICULE_SAMPLE_DEG = 2
const IMPORTED_GRID_WIDTH = 1
const MODEL_GRID_WIDTH = 1.25
const POLE_RADIUS = 3.5
const POLE_OUTLINE_WIDTH = 2

let cachedMask: GcmTerrainMaskCache | null = null

function stroke({
	context,
	width,
	height,
	points,
	color,
	lineWidth,
}: GcmTerrainStrokeRequest) {
	context.strokeStyle = color
	context.lineWidth = lineWidth
	context.beginPath()
	let previousLongitude = Number.NaN
	for (let index = 0; index < points.length; index += 2) {
		const longitude = points[index]
		const latitude = points[index + 1]
		const x = ((longitude + 180) / 360) * width
		const y = ((90 - latitude) / 180) * height
		if (
			!Number.isFinite(previousLongitude) ||
			Math.abs(longitude - previousLongitude) > 180
		)
			context.moveTo(x, y)
		else context.lineTo(x, y)
		previousLongitude = longitude
	}
	context.stroke()
}

function paintImportedGrid({
	context,
	width,
	height,
}: GcmTerrainCanvasRequest) {
	context.strokeStyle = uiPalette.terrainPreview.importedGrid
	context.lineWidth = IMPORTED_GRID_WIDTH
	context.setLineDash([3, 3])
	context.beginPath()
	for (
		let longitude = -180 + GRATICULE_STEP_DEG;
		longitude < 180;
		longitude += GRATICULE_STEP_DEG
	) {
		const x = ((longitude + 180) / 360) * width
		context.moveTo(x, 0)
		context.lineTo(x, height)
	}
	for (
		let latitude = -90 + GRATICULE_STEP_DEG;
		latitude < 90;
		latitude += GRATICULE_STEP_DEG
	) {
		const y = ((90 - latitude) / 180) * height
		context.moveTo(0, y)
		context.lineTo(width, y)
	}
	context.stroke()
	context.setLineDash([])
}

// Draws the model's own graticule over the imported map, so both coordinate
// systems stay visible while the orientation is adjusted.
function paintOrientationGrid({
	context,
	width,
	height,
	orientation,
}: GcmTerrainGridRequest) {
	paintImportedGrid({ context, width, height })
	const rotation = GCM_TERRAIN_ORIENTATION.rotation(orientation)
	const modelGrid = uiPalette.terrainPreview.modelGrid
	const points: number[] = []
	for (let longitude = 0; longitude < 360; longitude += GRATICULE_STEP_DEG) {
		points.length = 0
		for (let latitude = -90; latitude <= 90; latitude += GRATICULE_SAMPLE_DEG) {
			const source = GCM_TERRAIN_ORIENTATION.toSource({
				rotation,
				latitude,
				longitude,
			})
			points.push(source.longitude, source.latitude)
		}
		stroke({
			context,
			width,
			height,
			points,
			color: modelGrid,
			lineWidth: MODEL_GRID_WIDTH,
		})
	}
	for (
		let latitude = -90 + GRATICULE_STEP_DEG;
		latitude < 90;
		latitude += GRATICULE_STEP_DEG
	) {
		points.length = 0
		for (
			let longitude = 0;
			longitude <= 360;
			longitude += GRATICULE_SAMPLE_DEG
		) {
			const source = GCM_TERRAIN_ORIENTATION.toSource({
				rotation,
				latitude,
				longitude,
			})
			points.push(source.longitude, source.latitude)
		}
		stroke({
			context,
			width,
			height,
			points,
			color: modelGrid,
			lineWidth: MODEL_GRID_WIDTH,
		})
	}
	for (const latitude of [-90, 90]) {
		const source = GCM_TERRAIN_ORIENTATION.toSource({
			rotation,
			latitude,
			longitude: 0,
		})
		context.beginPath()
		context.arc(
			((source.longitude + 180) / 360) * width,
			((90 - source.latitude) / 180) * height,
			POLE_RADIUS,
			0,
			2 * Math.PI,
		)
		context.fillStyle = uiPalette.terrainPreview.modelPole
		context.fill()
		context.lineWidth = POLE_OUTLINE_WIDTH
		context.strokeStyle = uiPalette.terrainPreview.modelPoleOutline
		context.stroke()
	}
}

function paint({
	canvas,
	terrain,
	boundary,
	starPoints,
	zoneCircles,
}: GcmTerrainPaint) {
	const width = Math.min(720, terrain.width)
	const height = width / 2
	canvas.width = width
	canvas.height = height
	const context = canvas.getContext("2d")
	if (!context) return
	let image: ImageData
	if (
		cachedMask &&
		cachedMask.elevationM === terrain.elevationM &&
		cachedMask.land === terrain.land &&
		cachedMask.width === width &&
		cachedMask.height === height &&
		cachedMask.boundary === boundary
	) {
		image = cachedMask.image
	} else {
		image = context.createImageData(width, height)
		for (let y = 0; y < height; y++) {
			const latitude = 90 - ((y + 0.5) * 180) / height
			let row = 0
			if (boundary)
				while (
					row < boundary.grid.latitudes - 1 &&
					latitude <
						(boundary.grid.latitudesDeg[row] +
							boundary.grid.latitudesDeg[row + 1]) /
							2
				)
					row++
			for (let x = 0; x < width; x++) {
				const i =
					Math.floor(((y + 0.5) * terrain.height) / height) * terrain.width +
					Math.floor(((x + 0.5) * terrain.width) / width)
				const cell = boundary
					? row * boundary.grid.longitudes +
						Math.floor(
							(((x + 0.5) / width) * boundary.grid.longitudes +
								boundary.grid.longitudes / 2 +
								0.5) %
								boundary.grid.longitudes,
						)
					: 0
				const land = boundary ? boundary.landFraction[cell] : terrain.land[i]
				const shade = land >= 0.5 ? 255 : 0
				for (let channel = 0; channel < 3; channel++) {
					image.data[(y * width + x) * 4 + channel] = shade
				}
				image.data[(y * width + x) * 4 + 3] = 255
			}
		}
		cachedMask = {
			elevationM: terrain.elevationM,
			land: terrain.land,
			width,
			height,
			boundary,
			image,
		}
	}
	context.putImageData(image, 0, 0)
	paintOrientationGrid({
		context,
		width,
		height,
		orientation: terrain.orientation,
	})
	const scale = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1
	if (zoneCircles.length > 0) {
		const paths = GCM_ZONE_CIRCLES.display({
			circles: zoneCircles,
			orientation: terrain.orientation,
		})
		const segments = GCM_ZONE_CIRCLES.project({
			paths,
			width,
			height,
			viewport: {
				west: -180,
				north: 90,
				longitudeSpan: 360,
				latitudeSpan: 180,
			},
			shifts: [0],
		})
		GCM_ZONE_CIRCLES.paint({ context, segments, scale })
	}
	if (starPoints.length > 0) {
		const glyphs: GcmStarGlyph[] = GCM_STAR_POINTS.display({
			points: starPoints,
			orientation: terrain.orientation,
		}).map(({ kind, latitude, longitude }) => ({
			kind,
			x: (((((longitude + 180) % 360) + 360) % 360) / 360) * width,
			y: ((90 - latitude) / 180) * height,
		}))
		GCM_STAR_POINTS.paint({
			context,
			glyphs,
			scale,
		})
	}
}

export const GCM_TERRAIN_PREVIEW = { paint }
