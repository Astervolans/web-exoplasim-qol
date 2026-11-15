import type {
	AtmosphereBand,
	AtmosphereCompositionRequest,
	AtmosphereGas,
	AtmosphereGasLabelRequest,
	AtmosphereProfile,
	AtmosphereProfileRequest,
	AtmosphereRegime,
	AtmosphereRequest,
	AtmosphereSpecies,
	AtmosphereState,
} from "@/model/celestial/atmosphere/types"

const UNIVERSAL_GAS_CONSTANT = 8.314462618
const WATER_MOLAR_MASS = 18.015
const WATER_VAPOR_GAS_CONSTANT = 461.5
const LATENT_HEAT_WATER = 2.5e6
const WATER_VAPOR_PRESSURE_AT_0C = 0.006112
const WATER_VAPOR_EXPONENT = 17.67
const WATER_VAPOR_OFFSET = 243.5
const MINIMUM_LAPSE_RATE = 1.5
const STRATOSPHERE_TEMPERATURE_K = 210
const SEA_LEVEL_TEMPERATURE_K = 273.15
const SURFACE_PRESSURE_FLOOR_BAR = 0.001
const SURFACE_PRESSURE_CEIL_BAR = 100
const ARMSTRONG_PRESSURE_BAR = 0.0618
const HYPOXIA_OXYGEN_BAR = 0.11
const HYPEROXIA_OXYGEN_BAR = 0.5
const CO2_POISON_BAR = 0.02
const NARCOSIS_PRESSURE_BAR = 3.2
const LETHAL_HIGH_TEMPERATURE_K = 333
const LETHAL_LOW_TEMPERATURE_K = 213
const PROFILE_SAMPLES = 141
const LOWEST_TEMPERATURE_K = 20

const SPECIES: ReadonlyArray<AtmosphereSpecies> = [
	{ id: "H2", label: "H₂", molarMass: 2.01588, heatCapacity: 14304 },
	{ id: "He", label: "He", molarMass: 4.002602, heatCapacity: 5193 },
	{ id: "N2", label: "N₂", molarMass: 28.0134, heatCapacity: 1040 },
	{ id: "O2", label: "O₂", molarMass: 31.9988, heatCapacity: 918 },
	{ id: "Ar", label: "Ar", molarMass: 39.948, heatCapacity: 520 },
	{ id: "Ne", label: "Ne", molarMass: 20.1797, heatCapacity: 1030 },
	{ id: "Kr", label: "Kr", molarMass: 83.798, heatCapacity: 248 },
	{ id: "CO2", label: "CO₂", molarMass: 44.0095, heatCapacity: 844 },
	{ id: "H2O", label: "H₂O", molarMass: 18.01528, heatCapacity: 1996 },
]

const REGIME_LABELS: Record<AtmosphereRegime, string> = {
	vacuum: "Vacuum or trace",
	subNeptune: "Sub-Neptune envelope",
	runawayGreenhouse: "Runaway greenhouse",
	snowball: "Snowball-prone",
	thinHabitable: "Thin habitable",
	habitable: "Habitable",
	thickHabitable: "Thick habitable",
	beyondRange: "Beyond model range",
}

const EMPTY_COMPOSITION = Object.fromEntries(
	SPECIES.map((species) => [species.id, 0]),
) as Record<AtmosphereGas, number>

function fractions({
	moleFractions,
}: AtmosphereCompositionRequest): Record<AtmosphereGas, number> {
	const total = SPECIES.reduce(
		(sum, species) => sum + Math.max(moleFractions[species.id] ?? 0, 0),
		0,
	)
	if (total <= 0) return { ...EMPTY_COMPOSITION }
	const result = { ...EMPTY_COMPOSITION }
	for (const species of SPECIES) {
		result[species.id] = Math.max(moleFractions[species.id] ?? 0, 0) / total
	}
	return result
}

function meanMolarMass({
	moleFractions,
}: AtmosphereCompositionRequest): number {
	const normalized = fractions({ moleFractions })
	return SPECIES.reduce(
		(sum, species) => sum + normalized[species.id] * species.molarMass,
		0,
	)
}

function heatCapacity({ moleFractions }: AtmosphereCompositionRequest): number {
	const normalized = fractions({ moleFractions })
	const massSum = SPECIES.reduce(
		(sum, species) => sum + normalized[species.id] * species.molarMass,
		0,
	)
	if (massSum <= 0) return 1005
	return (
		SPECIES.reduce(
			(sum, species) =>
				sum + normalized[species.id] * species.molarMass * species.heatCapacity,
			0,
		) / massSum
	)
}

// Single-layer grey-atmosphere estimate. The absorbing layer's optical depth
// thickens with surface pressure, the CO2 column and pressure-induced
// hydrogen absorption, and the surface sits at T_eff·(1+τ)^(1/4), the
// standard grey-atmosphere result (Goody & Yung 1989). The per-bar optical
// depth is calibrated so modern Earth air reproduces the observed ~33 K
// greenhouse effect (Trenberth & Fasullo 2012), and its CO2 exponent gives
// 3 K per CO2 doubling, the IPCC AR6 central estimate.
const GREY_OPTICAL_DEPTH_PER_BAR = 0.66
const CO2_REFERENCE_COLUMN_BAR = 0.0004
const CO2_OPTICAL_DEPTH_EXPONENT = 0.155
const HYDROGEN_OPTICAL_DEPTH_PER_BAR = 0.9
const MAXIMUM_OPTICAL_DEPTH = 100
const GREENHOUSE_FLOOR_K = -20
const GREENHOUSE_CEIL_K = 500

function greenhouseK({
	composition,
	pressureBar,
	equilibriumTemperatureK,
}: {
	composition: Record<AtmosphereGas, number>
	pressureBar: number
	equilibriumTemperatureK: number
}): number {
	const pressure = Math.min(
		Math.max(pressureBar, SURFACE_PRESSURE_FLOOR_BAR),
		SURFACE_PRESSURE_CEIL_BAR,
	)
	const co2Column = Math.max(composition.CO2 * pressure, 1e-12)
	const co2Factor =
		(co2Column / CO2_REFERENCE_COLUMN_BAR) ** CO2_OPTICAL_DEPTH_EXPONENT
	const opticalDepth = Math.min(
		pressure *
			(GREY_OPTICAL_DEPTH_PER_BAR * co2Factor +
				HYDROGEN_OPTICAL_DEPTH_PER_BAR * composition.H2),
		MAXIMUM_OPTICAL_DEPTH,
	)
	const warming =
		Math.max(equilibriumTemperatureK, 0) * ((1 + opticalDepth) ** 0.25 - 1)
	return Math.min(Math.max(warming, GREENHOUSE_FLOOR_K), GREENHOUSE_CEIL_K)
}

function regime({
	pressureBar,
	composition,
	surfaceTemperatureK,
}: {
	pressureBar: number
	composition: Record<AtmosphereGas, number>
	surfaceTemperatureK: number
}): AtmosphereRegime {
	if (pressureBar < 0.01) return "vacuum"
	if (composition.H2 + composition.He > 0.5 && pressureBar >= 0.3)
		return "subNeptune"
	if (surfaceTemperatureK > 350) return "runawayGreenhouse"
	if (surfaceTemperatureK < 240) return "snowball"
	if (pressureBar < 0.3) return "thinHabitable"
	if (pressureBar <= 3) return "habitable"
	if (pressureBar <= 10) return "thickHabitable"
	return "beyondRange"
}

function state({
	composition,
	pressureBar,
	gravityMs2,
	equilibriumTemperatureK,
}: AtmosphereRequest): AtmosphereState {
	const pressure = Math.min(
		Math.max(pressureBar, SURFACE_PRESSURE_FLOOR_BAR),
		SURFACE_PRESSURE_CEIL_BAR,
	)
	const normalized = fractions({ moleFractions: composition })
	const molarMass = meanMolarMass({ moleFractions: normalized })
	const capacity = heatCapacity({ moleFractions: normalized })
	const greenhouse = greenhouseK({
		composition: normalized,
		pressureBar: pressure,
		equilibriumTemperatureK,
	})
	const surfaceTemperatureK = Math.max(
		LOWEST_TEMPERATURE_K,
		equilibriumTemperatureK + greenhouse,
	)
	const scaleHeightKm =
		(UNIVERSAL_GAS_CONSTANT * surfaceTemperatureK) /
		Math.max(molarMass * gravityMs2, 0.0001)
	return {
		pressureBar: pressure,
		moleFractions: normalized,
		meanMolarMass: molarMass,
		heatCapacity: capacity,
		gasConstant: (UNIVERSAL_GAS_CONSTANT * 1000) / Math.max(molarMass, 1e-6),
		greenhouseK: greenhouse,
		surfaceTemperatureK,
		scaleHeightKm,
		atmosphereHeightKm: scaleHeightKm * 6,
		regime: regime({
			pressureBar: pressure,
			composition: normalized,
			surfaceTemperatureK,
		}),
	}
}

function environmentalLapseRate({
	state: atmosphere,
	gravityMs2,
	waterFraction,
}: {
	state: AtmosphereState
	gravityMs2: number
	waterFraction: number
}): number {
	const dry = Math.max(
		(gravityMs2 / Math.max(atmosphere.heatCapacity, 1)) * 1000,
		0.5,
	)
	const celsius = atmosphere.surfaceTemperatureK - SEA_LEVEL_TEMPERATURE_K
	if (celsius < -100 || waterFraction <= 0.001) return dry
	const saturation =
		WATER_VAPOR_PRESSURE_AT_0C *
		Math.exp(
			(WATER_VAPOR_EXPONENT * celsius) /
				Math.max(celsius + WATER_VAPOR_OFFSET, 10),
		)
	const vaporPressure = Math.min(
		saturation * waterFraction,
		0.5 * atmosphere.pressureBar,
	)
	const epsilon = WATER_MOLAR_MASS / Math.max(atmosphere.meanMolarMass, 1e-6)
	const mixingRatio = Math.min(
		Math.max(
			(epsilon * vaporPressure) /
				Math.max(atmosphere.pressureBar - vaporPressure, 0.01),
			0,
		),
		0.2,
	)
	const airConstant =
		(UNIVERSAL_GAS_CONSTANT * 1000) / Math.max(atmosphere.meanMolarMass, 1e-6)
	const moist =
		(gravityMs2 *
			(1 +
				(LATENT_HEAT_WATER * mixingRatio) /
					(airConstant * atmosphere.surfaceTemperatureK))) /
		(atmosphere.heatCapacity +
			(LATENT_HEAT_WATER ** 2 * mixingRatio * epsilon) /
				(WATER_VAPOR_GAS_CONSTANT * atmosphere.surfaceTemperatureK ** 2))
	return Math.min(Math.max(moist * 1000, MINIMUM_LAPSE_RATE), dry)
}

function survives({
	pressureBar,
	temperatureK,
	composition,
}: {
	pressureBar: number
	temperatureK: number
	composition: Record<AtmosphereGas, number>
}): boolean {
	if (pressureBar < ARMSTRONG_PRESSURE_BAR) return false
	if (temperatureK > LETHAL_HIGH_TEMPERATURE_K) return false
	if (temperatureK < LETHAL_LOW_TEMPERATURE_K) return false
	const oxygen = pressureBar * composition.O2
	if (oxygen < HYPOXIA_OXYGEN_BAR || oxygen > HYPEROXIA_OXYGEN_BAR) return false
	if (pressureBar * composition.CO2 > CO2_POISON_BAR) return false
	if (pressureBar - oxygen > NARCOSIS_PRESSURE_BAR) return false
	return true
}

function profile({
	state: atmosphere,
	waterFraction,
	gravityMs2,
}: AtmosphereProfileRequest): AtmosphereProfile {
	const scaleHeight = atmosphere.scaleHeightKm
	const maxAltitudeKm = scaleHeight * 6.6
	const lapseRate = environmentalLapseRate({
		state: atmosphere,
		gravityMs2,
		waterFraction,
	})
	const tropopauseKm = Math.max(
		3,
		(atmosphere.surfaceTemperatureK - STRATOSPHERE_TEMPERATURE_K) /
			Math.max(lapseRate, 0.1),
	)
	const emissionKm = Math.max(
		0,
		atmosphere.greenhouseK / Math.max(lapseRate, 0.1),
	)
	const cloudCenterKm = Math.min(0.85 * tropopauseKm, scaleHeight)
	const cloudBottomKm = 0.55 * cloudCenterKm
	const cloudTopKm =
		cloudBottomKm + Math.min(1.1 * cloudCenterKm, tropopauseKm - cloudBottomKm)
	const armstrongKm =
		atmosphere.pressureBar > ARMSTRONG_PRESSURE_BAR
			? scaleHeight * Math.log(atmosphere.pressureBar / ARMSTRONG_PRESSURE_BAR)
			: null
	const oxygenPressure = atmosphere.moleFractions.O2 * atmosphere.pressureBar
	const hypoxiaKm =
		oxygenPressure > HYPOXIA_OXYGEN_BAR
			? scaleHeight * Math.log(oxygenPressure / HYPOXIA_OXYGEN_BAR)
			: null
	let breathable: AtmosphereBand | null = null
	let runStart: number | null = null
	for (let index = 0; index < PROFILE_SAMPLES; index++) {
		const altitude = (index / (PROFILE_SAMPLES - 1)) * maxAltitudeKm
		const pressure =
			atmosphere.pressureBar * Math.exp(-altitude / Math.max(scaleHeight, 1e-6))
		const temperature = Math.max(
			atmosphere.surfaceTemperatureK - lapseRate * altitude,
			STRATOSPHERE_TEMPERATURE_K,
		)
		const alive = survives({
			pressureBar: pressure,
			temperatureK: temperature,
			composition: atmosphere.moleFractions,
		})
		if (alive && runStart === null) runStart = altitude
		if (!alive && runStart !== null) {
			const bottom = runStart
			const top = altitude
			if (!breathable || top - bottom > breathable.topKm - breathable.bottomKm)
				breathable = { bottomKm: bottom, topKm: top }
			runStart = null
		}
	}
	if (runStart !== null) {
		const band = { bottomKm: runStart, topKm: maxAltitudeKm }
		if (
			!breathable ||
			band.topKm - band.bottomKm > breathable.topKm - breathable.bottomKm
		)
			breathable = band
	}
	return {
		maxAltitudeKm,
		lapseRateKperKm: lapseRate,
		cloud: { bottomKm: cloudBottomKm, topKm: cloudTopKm },
		tropopauseKm,
		emissionKm,
		atmosphereTopKm: atmosphere.atmosphereHeightKm,
		armstrongKm:
			armstrongKm !== null && armstrongKm > 0 && armstrongKm < maxAltitudeKm
				? armstrongKm
				: null,
		hypoxiaKm:
			hypoxiaKm !== null && hypoxiaKm > 0 && hypoxiaKm < maxAltitudeKm
				? hypoxiaKm
				: null,
		breathable,
	}
}

function speciesLabel({ gas }: AtmosphereGasLabelRequest): string {
	return SPECIES.find((species) => species.id === gas)?.label ?? gas
}

function nearestSpecies({ molarMass }: { molarMass: number }): AtmosphereGas {
	let best = SPECIES[0]
	for (const species of SPECIES) {
		if (
			Math.abs(species.molarMass - molarMass) <
			Math.abs(best.molarMass - molarMass)
		)
			best = species
	}
	return best.id
}

export const CELESTIAL_ATMOSPHERE = {
	SPECIES,
	REGIME_LABELS,
	EMPTY_COMPOSITION,
	state,
	profile,
	speciesLabel,
	nearestSpecies,
}
