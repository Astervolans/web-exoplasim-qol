import { CELESTIAL_ATMOSPHERE } from "@/model/celestial/atmosphere"
import type { AtmosphereGas } from "@/model/celestial/atmosphere/types"
import { ENERGY_BUDGET } from "@/model/celestial/energy"
import { ORBIT } from "@/model/celestial/orbit"
import { PLANET } from "@/model/celestial/planet"
import { STAR } from "@/model/celestial/star"
import { GCM_ATMOSPHERE } from "@/model/climate/gcm/atmosphere"
import type {
	GcmSystemPeriodEdit,
	GcmSystemPlanetEdit,
	GcmSystemStarEdit,
	GcmSystemSummary,
	GcmSystemSummaryRequest,
	GcmSystemSynchronousEdit,
} from "@/model/climate/gcm/system/types"
import type { GcmConfig } from "@/model/climate/gcm/types"

const NATIVE_PERIAPSE_DEG = 102.7
const UNIVERSAL_GAS_CONSTANT = 8314.46261815324
const EARTH_WATER_FRACTION = 0.71
const SEED_PRESSURE_BAR = 1e-6
const MIN_ROTATION_DAYS = 0.25
const MAX_ROTATION_DAYS = 100

function mass({ config }: { config: GcmConfig }): number {
	return (
		(config.gravityMs2 / PLANET.EARTH_GRAVITY_MS2) * config.radiusEarth ** 2
	)
}

function semiMajorAxis({ config }: { config: GcmConfig }): number {
	return ORBIT.semiMajorAxisAu({
		periodDays: config.yearDays,
		totalMassSolar: config.starMassSolar,
	})
}

function nativeComposition(): Record<AtmosphereGas, number> {
	const result = { ...CELESTIAL_ATMOSPHERE.EMPTY_COMPOSITION }
	for (const gas of GCM_ATMOSPHERE.GASES)
		result[gas.id as AtmosphereGas] = gas.nativeFraction
	return result
}

function composition({
	config,
}: {
	config: GcmConfig
}): Record<AtmosphereGas, number> {
	const result = { ...CELESTIAL_ATMOSPHERE.EMPTY_COMPOSITION }
	const resolved = GCM_ATMOSPHERE.resolve(config.atmosphere)
	const pressureBar = resolved.ok
		? resolved.values.pressureBar
		: GCM_ATMOSPHERE.NATIVE_PRESSURE_BAR
	let specified = 0
	let weightedMass = 0
	for (const gas of GCM_ATMOSPHERE.GASES) {
		const partial = config.atmosphere.partialPressures[gas.id]
		if (partial === null || partial <= 0) continue
		result[gas.id as AtmosphereGas] += partial / pressureBar
		specified += partial
		weightedMass += partial * gas.molarMass
	}
	if (specified <= 0) return nativeComposition()
	if (!resolved.ok) return result
	const remainder = Math.max(pressureBar - specified, 0)
	if (remainder <= SEED_PRESSURE_BAR) return result
	const totalMolarMass =
		UNIVERSAL_GAS_CONSTANT / Math.max(resolved.values.gasConstant, 1e-6)
	const remainderMolarMass =
		(totalMolarMass * pressureBar - weightedMass) / remainder
	result[
		CELESTIAL_ATMOSPHERE.nearestSpecies({ molarMass: remainderMolarMass })
	] += remainder / pressureBar
	return result
}

function summary({ config }: GcmSystemSummaryRequest): GcmSystemSummary {
	const star = STAR.state({
		massSolar: config.starMassSolar,
		ageGyr: config.starAgeGyr,
	})
	const axis = semiMajorAxis({ config })
	const massEarth = mass({ config })
	const planet = PLANET.state({
		massEarth,
		radiusKm: config.radiusEarth * PLANET.EARTH_RADIUS_KM,
	})
	const orbit = ORBIT.system({
		host: {
			luminositySolar: star.luminositySolar,
			temperatureK: star.temperatureK,
			massSolar: star.massSolar,
		},
		semiMajorAxisAu: axis,
		eccentricity: config.eccentricity,
		periapseLongitudeDeg: config.periapseLongitudeDeg ?? NATIVE_PERIAPSE_DEG,
		planetMassEarth: massEarth,
		planetRadiusKm: planet.radiusKm,
		planetDensityGcc: planet.densityGcc,
	})
	const equilibriumTemperatureK = ORBIT.equilibriumTemperature({
		insolationWm2: orbit.insolationWm2,
		albedo: ENERGY_BUDGET.PLANETARY_ALBEDO,
	})
	const resolved = GCM_ATMOSPHERE.resolve(config.atmosphere)
	const pressureBar = resolved.ok
		? resolved.values.pressureBar
		: GCM_ATMOSPHERE.NATIVE_PRESSURE_BAR
	const mixture = composition({ config })
	const atmosphere = CELESTIAL_ATMOSPHERE.state({
		composition: mixture,
		pressureBar,
		gravityMs2: planet.gravityMs2,
		equilibriumTemperatureK,
	})
	const profile = CELESTIAL_ATMOSPHERE.profile({
		state: atmosphere,
		waterFraction: EARTH_WATER_FRACTION,
		gravityMs2: planet.gravityMs2,
	})
	const interior = PLANET.interior({
		massEarth,
		radiusKm: planet.radiusKm,
		densityGcc: planet.densityGcc,
		surfaceTemperatureK: atmosphere.surfaceTemperatureK,
		composition: planet.composition,
	})
	const energy = ENERGY_BUDGET.estimate({
		insolationWm2: orbit.insolationWm2,
		pressureBar,
		equilibriumTemperatureK,
		surfaceTemperatureK: atmosphere.surfaceTemperatureK,
	})
	return {
		star,
		planet,
		interior,
		orbit,
		atmosphere,
		profile,
		energy,
		semiMajorAxisAu: axis,
		pressureBar,
		equilibriumTemperatureK,
		composition: mixture,
		species: CELESTIAL_ATMOSPHERE.SPECIES,
	}
}

function withStar({ config, massSolar, ageGyr }: GcmSystemStarEdit): GcmConfig {
	const star = STAR.state({
		massSolar,
		ageGyr: Math.min(Math.max(ageGyr, 0), STAR.maxAgeGyr(massSolar)),
	})
	const next: GcmConfig = {
		...config,
		starMassSolar: star.massSolar,
		starAgeGyr: star.ageGyr,
	}
	return {
		...next,
		starTemperatureK: star.temperatureK,
		fluxWm2: STAR.flux({
			luminositySolar: star.luminositySolar,
			distanceAu: semiMajorAxis({ config: next }),
		}),
	}
}

function withPeriod({
	config,
	yearDays,
	refreshFlux,
}: GcmSystemPeriodEdit): GcmConfig {
	const next: GcmConfig = config.synchronous
		? {
				...config,
				yearDays,
				rotationPeriodDays: Math.min(yearDays, MAX_ROTATION_DAYS),
			}
		: { ...config, yearDays }
	if (!refreshFlux) return next
	const star = STAR.state({
		massSolar: next.starMassSolar,
		ageGyr: next.starAgeGyr,
	})
	return {
		...next,
		starTemperatureK: star.temperatureK,
		fluxWm2: STAR.flux({
			luminositySolar: star.luminositySolar,
			distanceAu: semiMajorAxis({ config: next }),
		}),
	}
}

function withSynchronous({
	config,
	synchronous,
}: GcmSystemSynchronousEdit): GcmConfig {
	if (!synchronous) return { ...config, synchronous }
	return {
		...config,
		synchronous,
		rotationPeriodDays: Math.min(config.yearDays, MAX_ROTATION_DAYS),
	}
}

function withPlanet({
	config,
	massEarth,
	radiusEarth,
}: GcmSystemPlanetEdit): GcmConfig {
	return {
		...config,
		radiusEarth,
		gravityMs2:
			(PLANET.EARTH_GRAVITY_MS2 * massEarth) / Math.max(radiusEarth ** 2, 1e-6),
	}
}

function refresh({ config }: { config: GcmConfig }): GcmConfig {
	return withStar({
		config,
		massSolar: config.starMassSolar,
		ageGyr: config.starAgeGyr,
	})
}

export const GCM_SYSTEM = {
	mass,
	summary,
	withStar,
	withPeriod,
	withPlanet,
	withSynchronous,
	refresh,
	rotationDaysRange: { min: MIN_ROTATION_DAYS, max: MAX_ROTATION_DAYS },
}
