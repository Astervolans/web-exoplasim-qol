import type { GcmTerrainOrientation } from "@/model/climate/gcm/terrain/orientation/types"

export type GcmStarPointKind = "substellar" | "antistellar"

export interface GcmStarPoint {
	kind: GcmStarPointKind
	latitude: number
	longitude: number
}

export interface GcmStarPointModelRequest {
	obliquityDeg: number
	substellarLongitudeDeg: number
	periapseLongitudeDeg: number
	keplerian: boolean
}

export interface GcmStarRightAscensionRequest {
	obliquityDeg: number
	periapseLongitudeDeg: number
}

export interface GcmStarPointDisplayRequest {
	points: ReadonlyArray<GcmStarPoint>
	orientation: GcmTerrainOrientation
}

export interface GcmStarGlyph {
	kind: GcmStarPointKind
	x: number
	y: number
}

export interface GcmStarGlyphPaint {
	context: CanvasRenderingContext2D
	glyphs: ReadonlyArray<GcmStarGlyph>
	scale: number
}

export interface GcmStarGlyphRequest {
	context: CanvasRenderingContext2D
	scale: number
}
