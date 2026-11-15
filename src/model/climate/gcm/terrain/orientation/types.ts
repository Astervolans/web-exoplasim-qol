export interface GcmTerrainOrientation {
	poleLatitudeDeg: number
	poleLongitudeDeg: number
	spinDeg: number
}

export interface GcmTerrainRotation {
	matrix: Float64Array
}

export interface GcmTerrainDirection {
	latitude: number
	longitude: number
}

export interface GcmTerrainVector {
	x: number
	y: number
	z: number
}

export interface GcmTerrainPointRequest {
	rotation: GcmTerrainRotation
	latitude: number
	longitude: number
}

export interface GcmTerrainTangentRequest {
	rotation: GcmTerrainRotation
	latitude: number
	longitude: number
	u: number
	v: number
}

export interface GcmTerrainTangent {
	latitude: number
	longitude: number
	u: number
	v: number
}
