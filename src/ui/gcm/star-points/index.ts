import { GCM_TERRAIN_ORIENTATION } from "@/model/climate/gcm/terrain/orientation"
import { uiPalette } from "@/ui/components/tokens"
import type {
	GcmStarGlyphPaint,
	GcmStarGlyphRequest,
	GcmStarPoint,
	GcmStarPointDisplayRequest,
	GcmStarPointModelRequest,
	GcmStarRightAscensionRequest,
} from "@/ui/gcm/star-points/types"

const RADIANS_PER_DEGREE = Math.PI / 180
const DEGREES_PER_RADIAN = 180 / Math.PI
const SUBSTELLAR_RADIUS = 3.5
const ANTISTELLAR_RADIUS = 4
const OUTLINE_MARGIN = 1
const RAY_COUNT = 8
const RAY_INNER = 5.5
const RAY_OUTER = 8.5
const RAY_WIDTH = 1.5
const OUTLINE_WIDTH = 3
const CENTER_DOT_RADIUS = 1.25

function wrapDegrees(value: number): number {
	return ((value % 360) + 360) % 360
}

// Generic Keplerian mode subtracts the right ascension from the native fixed
// illumination hour angle, which shifts the sub-stellar longitude.
function rightAscensionDegrees({
	obliquityDeg,
	periapseLongitudeDeg,
}: GcmStarRightAscensionRequest): number {
	const perihelion = (periapseLongitudeDeg + 180) * RADIANS_PER_DEGREE
	return (
		Math.atan2(
			Math.cos(obliquityDeg * RADIANS_PER_DEGREE) * Math.sin(perihelion),
			Math.cos(perihelion),
		) * DEGREES_PER_RADIAN
	)
}

function model({
	obliquityDeg,
	substellarLongitudeDeg,
	periapseLongitudeDeg,
	keplerian,
}: GcmStarPointModelRequest): GcmStarPoint[] {
	const shift = keplerian
		? rightAscensionDegrees({ obliquityDeg, periapseLongitudeDeg })
		: 0
	const substellarLongitude = wrapDegrees(substellarLongitudeDeg + shift)
	return [
		{
			kind: "substellar",
			latitude: obliquityDeg,
			longitude: substellarLongitude,
		},
		{
			kind: "antistellar",
			latitude: -obliquityDeg,
			longitude: wrapDegrees(substellarLongitude + 180),
		},
	]
}

function display({
	points,
	orientation,
}: GcmStarPointDisplayRequest): GcmStarPoint[] {
	const rotation = GCM_TERRAIN_ORIENTATION.rotation(orientation)
	return points.map(({ kind, latitude, longitude }) => {
		const source = GCM_TERRAIN_ORIENTATION.toSource({
			rotation,
			latitude,
			longitude,
		})
		return { kind, latitude: source.latitude, longitude: source.longitude }
	})
}

function drawSubstellar({ context, scale }: GcmStarGlyphRequest) {
	const color = uiPalette.starPoint.substellar
	const outline = uiPalette.starPoint.outline
	context.lineCap = "round"
	for (let index = 0; index < RAY_COUNT; index++) {
		const angle = (index / RAY_COUNT) * Math.PI * 2
		const x = Math.cos(angle)
		const y = Math.sin(angle)
		for (const [style, width] of [
			[outline, OUTLINE_WIDTH],
			[color, RAY_WIDTH],
		] as const) {
			context.strokeStyle = style
			context.lineWidth = width * scale
			context.beginPath()
			context.moveTo(x * RAY_INNER * scale, y * RAY_INNER * scale)
			context.lineTo(x * RAY_OUTER * scale, y * RAY_OUTER * scale)
			context.stroke()
		}
	}
	context.beginPath()
	context.arc(
		0,
		0,
		(SUBSTELLAR_RADIUS + OUTLINE_MARGIN) * scale,
		0,
		2 * Math.PI,
	)
	context.fillStyle = outline
	context.fill()
	context.beginPath()
	context.arc(0, 0, SUBSTELLAR_RADIUS * scale, 0, 2 * Math.PI)
	context.fillStyle = color
	context.fill()
}

function drawAntistellar({ context, scale }: GcmStarGlyphRequest) {
	const color = uiPalette.starPoint.antistellar
	const outline = uiPalette.starPoint.outline
	context.beginPath()
	context.arc(
		0,
		0,
		(ANTISTELLAR_RADIUS + OUTLINE_MARGIN) * scale,
		0,
		2 * Math.PI,
	)
	context.fillStyle = outline
	context.fill()
	context.beginPath()
	context.arc(0, 0, ANTISTELLAR_RADIUS * scale, 0, 2 * Math.PI)
	context.fillStyle = color
	context.fill()
	context.beginPath()
	context.arc(0, 0, CENTER_DOT_RADIUS * scale, 0, 2 * Math.PI)
	context.fillStyle = outline
	context.fill()
}

function paint({ context, glyphs, scale }: GcmStarGlyphPaint) {
	for (const glyph of glyphs) {
		context.save()
		context.translate(glyph.x, glyph.y)
		if (glyph.kind === "substellar") drawSubstellar({ context, scale })
		else drawAntistellar({ context, scale })
		context.restore()
	}
}

export const GCM_STAR_POINTS = { model, display, paint }
