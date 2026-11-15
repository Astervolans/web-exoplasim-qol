import type { GcmTerrainOrientation } from "@/model/climate/gcm/terrain/orientation/types"

export interface GcmMapProjection {
	u: Float32Array
	v: Float32Array
}

export interface GcmMapProjectionRequest {
	orientation: GcmTerrainOrientation
	width: number
	height: number
}

export interface GcmMapResampleRequest {
	orientation: GcmTerrainOrientation
	width: number
	height: number
	source: Uint8ClampedArray
	nearest: boolean
}
