import type { GcmBoundary } from "@/model/climate/gcm/boundary/types"
import type { GcmTerrainOrientation } from "@/model/climate/gcm/terrain/orientation/types"
import type { GcmTerrain } from "@/model/climate/gcm/terrain/types"
import type { GcmStarPoint } from "@/ui/gcm/star-points/types"
import type { GcmZoneCircle } from "@/ui/gcm/zone-circles/types"
import type { UnitSystem } from "@/ui/genesis/shared/ui-format"

export interface GcmTerrainPanelProps {
	hasTerrain: boolean
	latitudes: number
	disabled: boolean
	unitSystem: UnitSystem
	starPoints: ReadonlyArray<GcmStarPoint>
	zoneCircles: ReadonlyArray<GcmZoneCircle>
	onChange: (terrain: GcmTerrain | null) => void
}

export interface GcmTerrainUpload {
	file: File
	kind: "heightmap" | "mask"
}

export interface GcmTerrainPreviewProps {
	readTerrain: () => GcmTerrain | null
	label: string
	starPoints: ReadonlyArray<GcmStarPoint>
	zoneCircles: ReadonlyArray<GcmZoneCircle>
}

export interface GcmTerrainPaint {
	terrain: GcmTerrain
	boundary: GcmBoundary | null
	canvas: HTMLCanvasElement
	starPoints: ReadonlyArray<GcmStarPoint>
	zoneCircles: ReadonlyArray<GcmZoneCircle>
}

export interface GcmTerrainCanvasRequest {
	context: CanvasRenderingContext2D
	width: number
	height: number
}

export interface GcmTerrainGridRequest extends GcmTerrainCanvasRequest {
	orientation: GcmTerrainOrientation
}

export interface GcmTerrainStrokeRequest extends GcmTerrainCanvasRequest {
	points: number[]
	color: string
	lineWidth: number
}

export interface GcmTerrainMaskCache {
	elevationM: Float32Array
	land: Float32Array
	width: number
	height: number
	boundary: GcmBoundary | null
	image: ImageData
}
