import type { GcmGrid } from "@/model/climate/gcm/grid/types"
import type { GcmHoverPoint } from "@/ui/gcm/hover/types"
import type { GcmMapLayer } from "@/ui/gcm/types"

export interface GcmFieldSampleRequest {
	layer: GcmMapLayer
	point: GcmHoverPoint
}

export interface GcmGridSampleRequest {
	grid: GcmGrid
	values: Float32Array
	latitude: number
	longitude: number
}
