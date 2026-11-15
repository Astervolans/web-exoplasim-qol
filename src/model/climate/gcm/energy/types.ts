import type { GcmConfig, GcmSnapshot } from "@/model/climate/gcm/types"

export interface GcmEnergyBudgetRequest {
	config: GcmConfig
	snapshot: GcmSnapshot
}

export interface GcmEnergyBudget {
	incoming: number
	reflected: number
	albedo: number
	absorbed: number
	airAbsorbed: number
	surfaceAbsorbed: number
	surfaceEmission: number
	latent: number
	sensible: number
	upward: number
	reflectedSurface: number
	reflectedAir: number
	surfaceAlbedo: number
	turn: number
	backRadiation: number
	outgoing: number
	stored: number
	surfaceStorage: number
	surfaceTemperatureK: number
}
