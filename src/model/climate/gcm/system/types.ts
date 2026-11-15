import type {
	AtmosphereGas,
	AtmosphereProfile,
	AtmosphereSpecies,
	AtmosphereState,
} from "@/model/celestial/atmosphere/types"
import type { EnergyBudget } from "@/model/celestial/energy/types"
import type { OrbitSystem } from "@/model/celestial/orbit/types"
import type {
	PlanetInterior,
	PlanetState,
} from "@/model/celestial/planet/types"
import type { StarState } from "@/model/celestial/star/types"
import type { GcmConfig } from "@/model/climate/gcm/types"

export interface GcmSystemSummaryRequest {
	config: GcmConfig
}

export interface GcmSystemStarEdit {
	config: GcmConfig
	massSolar: number
	ageGyr: number
}

export interface GcmSystemPeriodEdit {
	config: GcmConfig
	yearDays: number
	refreshFlux: boolean
}

export interface GcmSystemSynchronousEdit {
	config: GcmConfig
	synchronous: boolean
}

export interface GcmSystemPlanetEdit {
	config: GcmConfig
	massEarth: number
	radiusEarth: number
}

export interface GcmSystemSummary {
	star: StarState
	planet: PlanetState
	interior: PlanetInterior
	orbit: OrbitSystem
	atmosphere: AtmosphereState
	profile: AtmosphereProfile
	energy: EnergyBudget
	semiMajorAxisAu: number
	pressureBar: number
	equilibriumTemperatureK: number
	composition: Record<AtmosphereGas, number>
	species: ReadonlyArray<AtmosphereSpecies>
}
