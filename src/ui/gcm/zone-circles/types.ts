import type { GcmTerrainOrientation } from "@/model/climate/gcm/terrain/orientation/types"
import type { GcmMapViewport } from "@/ui/gcm/map-navigation/types"

export type GcmZoneCircleKind = "tropic" | "polar"

export interface GcmZoneCircle {
	kind: GcmZoneCircleKind
	latitude: number
}

export interface GcmZoneCircleModelRequest {
	obliquityDeg: number
}

export interface GcmZoneCircleDisplayRequest {
	circles: ReadonlyArray<GcmZoneCircle>
	orientation: GcmTerrainOrientation
}

export interface GcmZoneCirclePath {
	kind: GcmZoneCircleKind
	segments: ReadonlyArray<number[]>
}

export interface GcmZoneCircleSegment {
	kind: GcmZoneCircleKind
	points: ReadonlyArray<number>
}

export interface GcmZoneCircleProjectionRequest {
	paths: ReadonlyArray<GcmZoneCirclePath>
	width: number
	height: number
	viewport: GcmMapViewport
	shifts: ReadonlyArray<number>
}

export interface GcmZoneCirclePaint {
	context: CanvasRenderingContext2D
	segments: ReadonlyArray<GcmZoneCircleSegment>
	scale: number
}
