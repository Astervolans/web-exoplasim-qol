import { GCM_TERRAIN_ORIENTATION } from "@/model/climate/gcm/terrain/orientation"
import { uiPalette } from "@/ui/components/tokens"
import type {
	GcmZoneCircle,
	GcmZoneCircleDisplayRequest,
	GcmZoneCircleKind,
	GcmZoneCircleModelRequest,
	GcmZoneCirclePaint,
	GcmZoneCirclePath,
	GcmZoneCircleProjectionRequest,
	GcmZoneCircleSegment,
} from "@/ui/gcm/zone-circles/types"

const SAMPLE_DEG = 2
const LINE_WIDTH = 2
const HALO_WIDTH = 4
const STYLES: Record<GcmZoneCircleKind, { color: string; dash: number[] }> = {
	tropic: { color: uiPalette.zoneCircle.tropic, dash: [6, 4] },
	polar: { color: uiPalette.zoneCircle.polar, dash: [4, 3] },
}

// The tropics bound the latitudes where the star can pass overhead and the
// polar circles where it can stay up or down for a whole rotation. Above 45°
// obliquity the polar circles lie closer to the equator than the tropics;
// both pairs keep their geometric latitudes.
function model({ obliquityDeg }: GcmZoneCircleModelRequest): GcmZoneCircle[] {
	const polar = 90 - obliquityDeg
	return [
		{ kind: "tropic", latitude: obliquityDeg },
		{ kind: "tropic", latitude: -obliquityDeg },
		{ kind: "polar", latitude: polar },
		{ kind: "polar", latitude: -polar },
	]
}

function display({
	circles,
	orientation,
}: GcmZoneCircleDisplayRequest): GcmZoneCirclePath[] {
	const rotation = GCM_TERRAIN_ORIENTATION.rotation(orientation)
	return circles.map(({ kind, latitude }) => {
		const segments: number[][] = []
		let segment: number[] = []
		let previous = Number.NaN
		for (let longitude = 0; longitude <= 360; longitude += SAMPLE_DEG) {
			const source = GCM_TERRAIN_ORIENTATION.toSource({
				rotation,
				latitude,
				longitude,
			})
			const wrapped = ((((source.longitude + 180) % 360) + 360) % 360) - 180
			if (Number.isFinite(previous) && Math.abs(wrapped - previous) > 180) {
				if (segment.length >= 4) segments.push(segment)
				segment = []
			}
			segment.push(wrapped, source.latitude)
			previous = wrapped
		}
		if (segment.length >= 4) segments.push(segment)
		return { kind, segments }
	})
}

function project({
	paths,
	width,
	height,
	viewport,
	shifts,
}: GcmZoneCircleProjectionRequest): GcmZoneCircleSegment[] {
	const projected: GcmZoneCircleSegment[] = []
	for (const shift of shifts) {
		for (const path of paths) {
			for (const points of path.segments) {
				const canvasPoints: number[] = []
				for (let index = 0; index < points.length; index += 2) {
					canvasPoints.push(
						((points[index] + shift - viewport.west) / viewport.longitudeSpan) *
							width,
						((viewport.north - points[index + 1]) / viewport.latitudeSpan) *
							height,
					)
				}
				projected.push({ kind: path.kind, points: canvasPoints })
			}
		}
	}
	return projected
}

function paint({ context, segments, scale }: GcmZoneCirclePaint) {
	if (segments.length === 0) return
	context.save()
	context.lineCap = "round"
	context.lineJoin = "round"
	for (const segment of segments) {
		const style = STYLES[segment.kind]
		const dash = style.dash.map((value) => value * scale)
		for (const pass of [
			{ color: uiPalette.zoneCircle.halo, width: HALO_WIDTH },
			{ color: style.color, width: LINE_WIDTH },
		] as const) {
			context.strokeStyle = pass.color
			context.lineWidth = pass.width * scale
			context.setLineDash(dash)
			context.beginPath()
			for (let index = 0; index < segment.points.length; index += 2) {
				if (index === 0)
					context.moveTo(segment.points[index], segment.points[index + 1])
				else context.lineTo(segment.points[index], segment.points[index + 1])
			}
			context.stroke()
		}
	}
	context.restore()
}

export const GCM_ZONE_CIRCLES = { model, display, project, paint }
