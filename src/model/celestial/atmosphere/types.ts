export type AtmosphereGas =
	| "H2"
	| "He"
	| "N2"
	| "O2"
	| "Ar"
	| "Ne"
	| "Kr"
	| "CO2"
	| "H2O"

export type AtmosphereRegime =
	| "vacuum"
	| "subNeptune"
	| "runawayGreenhouse"
	| "snowball"
	| "thinHabitable"
	| "habitable"
	| "thickHabitable"
	| "beyondRange"

export interface AtmosphereSpecies {
	id: AtmosphereGas
	label: string
	molarMass: number
	heatCapacity: number
}

export interface AtmosphereRequest {
	composition: Record<AtmosphereGas, number>
	pressureBar: number
	gravityMs2: number
	equilibriumTemperatureK: number
}

export interface AtmosphereState {
	pressureBar: number
	moleFractions: Record<AtmosphereGas, number>
	meanMolarMass: number
	heatCapacity: number
	gasConstant: number
	greenhouseK: number
	surfaceTemperatureK: number
	scaleHeightKm: number
	atmosphereHeightKm: number
	regime: AtmosphereRegime
}

export interface AtmosphereProfileRequest {
	state: AtmosphereState
	waterFraction: number
	gravityMs2: number
}

export interface AtmosphereBand {
	topKm: number
	bottomKm: number
}

export interface AtmosphereProfile {
	maxAltitudeKm: number
	lapseRateKperKm: number
	cloud: AtmosphereBand
	tropopauseKm: number
	emissionKm: number
	atmosphereTopKm: number
	armstrongKm: number | null
	hypoxiaKm: number | null
	breathable: AtmosphereBand | null
}

export interface AtmosphereCompositionRequest {
	moleFractions: Record<AtmosphereGas, number>
}

export interface AtmosphereGasLabelRequest {
	gas: AtmosphereGas
}
