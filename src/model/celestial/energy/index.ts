import type {
	EnergyBudget,
	EnergyEstimateRequest,
} from "@/model/celestial/energy/types"

// A single-layer radiative-convective sketch with Earth-calibrated fractions
// (Trenberth & Fasullo 2012, "Tracking Earth's energy"): the atmosphere
// absorbs sunlight by Beer's law, the surface loses latent and sensible heat
// in the observed proportions, and the 8-13 um window passes a share of the
// surface emission that shrinks as the atmosphere thickens. Every flow
// closes, so the diagram's totals balance by construction.
const STEFAN_BOLTZMANN = 5.670374419e-8
const GLOBAL_MEAN_GEOMETRY = 4
const PLANETARY_ALBEDO = 0.3
const SURFACE_REFLECTION_SHARE = 0.2
const ATMOSPHERIC_ABSORPTION_PER_BAR = 0.4
const ATMOSPHERIC_PRESSURE_MIN = 0.05
const ATMOSPHERIC_PRESSURE_MAX = 2
const LATENT_SHARE = 0.21
const SENSIBLE_SHARE = 0.05
const WINDOW_SHARE = 0.1
const WINDOW_PRESSURE_DECAY = 0.7
const WINDOW_MIN = 0.02
const WINDOW_MAX = 0.3

function estimate({
	insolationWm2,
	pressureBar,
	equilibriumTemperatureK,
	surfaceTemperatureK,
}: EnergyEstimateRequest): EnergyBudget {
	const incoming = Math.max(insolationWm2, 0) / GLOBAL_MEAN_GEOMETRY
	const reflected = incoming * PLANETARY_ALBEDO
	const absorbed = incoming - reflected
	const pressure = Math.min(
		Math.max(pressureBar, ATMOSPHERIC_PRESSURE_MIN),
		ATMOSPHERIC_PRESSURE_MAX,
	)
	const atmosphericShare =
		1 - Math.exp(-ATMOSPHERIC_ABSORPTION_PER_BAR * pressure)
	const airAbsorbed = absorbed * atmosphericShare
	const surfaceAbsorbed = absorbed - airAbsorbed
	const surfaceEmission = STEFAN_BOLTZMANN * surfaceTemperatureK ** 4
	const latent = surfaceEmission * LATENT_SHARE
	const sensible = surfaceEmission * SENSIBLE_SHARE
	const upward = surfaceEmission + latent + sensible
	const outgoing = absorbed
	const windowShare = Math.min(
		Math.max(
			WINDOW_SHARE *
				Math.exp(-WINDOW_PRESSURE_DECAY * Math.max(pressureBar - 1, 0)),
			WINDOW_MIN,
		),
		WINDOW_MAX,
	)
	const window = windowShare * surfaceEmission
	return {
		insolationWm2,
		albedo: PLANETARY_ALBEDO,
		incoming,
		reflected,
		reflectedBySurface: reflected * SURFACE_REFLECTION_SHARE,
		reflectedByAir: reflected * (1 - SURFACE_REFLECTION_SHARE),
		absorbed,
		airAbsorbed,
		surfaceAbsorbed,
		surfaceEmission,
		latent,
		sensible,
		upward,
		outgoing,
		window,
		atmosphereEmission: outgoing - window,
		backRadiation: upward - outgoing + airAbsorbed,
		returned: upward - outgoing,
		stored: 0,
		equilibriumTemperatureK,
		surfaceTemperatureK,
	}
}

export const ENERGY_BUDGET = {
	PLANETARY_ALBEDO,
	estimate,
}
