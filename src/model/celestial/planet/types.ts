export type PlanetKind =
	| "rocky"
	| "terrestrial"
	| "superTerrestrial"
	| "ocean"
	| "ice"
	| "subNeptune"
	| "gasGiant"
	| "superJovian"

export type PlanetLayerPhase = "solid" | "liquid" | "gas"

export interface PlanetRequest {
	massEarth: number
	radiusKm: number
}

export interface PlanetComposition {
	core: number
	water: number
	gas: number
}

export interface PlanetState {
	massEarth: number
	radiusKm: number
	radiusEarth: number
	densityGcc: number
	gravityMs2: number
	gravityEarth: number
	escapeVelocityKms: number
	kind: PlanetKind
	label: string
	composition: PlanetComposition
}

export interface PlanetClassificationRequest {
	massEarth: number
	densityGcc: number
}

export interface PlanetCompositionRequest {
	massEarth: number
	radiusEarth: number
}

export interface PlanetLayer {
	name: string
	phase: PlanetLayerPhase
	innerRadius: number
	outerRadius: number
	color: string
}

export interface PlanetInteriorRequest {
	massEarth: number
	radiusKm: number
	densityGcc: number
	surfaceTemperatureK: number
	composition: PlanetComposition
}

export interface PlanetInterior {
	layers: ReadonlyArray<PlanetLayer>
	coreTemperatureK: number
	corePressureGPa: number
	radiusKm: number
}

export interface PlanetLabelRequest {
	massEarth: number
	densityGcc: number
	composition: PlanetComposition
}
