export interface EnergyEstimateRequest {
	insolationWm2: number
	pressureBar: number
	equilibriumTemperatureK: number
	surfaceTemperatureK: number
}

export interface EnergyBudget {
	insolationWm2: number
	albedo: number
	incoming: number
	reflected: number
	reflectedBySurface: number
	reflectedByAir: number
	absorbed: number
	airAbsorbed: number
	surfaceAbsorbed: number
	surfaceEmission: number
	latent: number
	sensible: number
	upward: number
	outgoing: number
	window: number
	atmosphereEmission: number
	backRadiation: number
	returned: number
	stored: number
	equilibriumTemperatureK: number
	surfaceTemperatureK: number
}
