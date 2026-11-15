export interface OrbitPeriodRequest {
	semiMajorAxisAu: number
	totalMassSolar: number
}

export interface OrbitAxisRequest {
	periodDays: number
	totalMassSolar: number
}

export interface OrbitInsolationRequest {
	luminositySolar: number
	semiMajorAxisAu: number
}

export interface OrbitTemperatureRequest {
	insolationWm2: number
	albedo: number
}

export interface OrbitZoneRequest {
	luminositySolar: number
}

export interface OrbitZones {
	habitableInnerAu: number
	habitableOuterAu: number
	snowLineAu: number
}

export interface OrbitDistanceRangeRequest {
	semiMajorAxisAu: number
	eccentricity: number
}

export interface OrbitDistanceRange {
	perihelionAu: number
	aphelionAu: number
}

export interface OrbitHillRadiusRequest {
	semiMajorAxisAu: number
	eccentricity: number
	planetMassEarth: number
	totalMassSolar: number
}

export interface OrbitRocheLimitRequest {
	starLuminositySolar: number
	starMassSolar: number
	starTemperatureK: number
	planetDensityGcc: number
}

export interface OrbitTidalLockRequest {
	planetMassEarth: number
	planetRadiusKm: number
	starMassSolar: number
	semiMajorAxisAu: number
}

export type OrbitTidalLockStatus = "locked" | "may" | "not"

export interface OrbitTidalLockStatusRequest {
	timescaleGyr: number
	ageGyr: number
}

export interface OrbitSeasonRequest {
	periapseLongitudeDeg: number
}

export interface OrbitHostStar {
	luminositySolar: number
	temperatureK: number
	massSolar: number
}

export interface OrbitSystemRequest {
	host: OrbitHostStar
	semiMajorAxisAu: number
	eccentricity: number
	periapseLongitudeDeg: number
	planetMassEarth: number
	planetRadiusKm: number
	planetDensityGcc: number
}

export interface OrbitSystem {
	periodDays: number
	insolationWm2: number
	distanceRange: OrbitDistanceRange
	zones: OrbitZones
	hillRadiusAu: number
	rocheLimitAu: number
	tidalLockGyr: number
	closestApproach: string
}
