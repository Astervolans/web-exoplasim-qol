import type {
	OrbitAxisRequest,
	OrbitDistanceRange,
	OrbitDistanceRangeRequest,
	OrbitHillRadiusRequest,
	OrbitInsolationRequest,
	OrbitPeriodRequest,
	OrbitRocheLimitRequest,
	OrbitSeasonRequest,
	OrbitSystem,
	OrbitSystemRequest,
	OrbitTemperatureRequest,
	OrbitTidalLockRequest,
	OrbitTidalLockStatus,
	OrbitTidalLockStatusRequest,
	OrbitZoneRequest,
	OrbitZones,
} from "@/model/celestial/orbit/types"
import { STAR } from "@/model/celestial/star"

const AU_KM = 149_597_870.7
const SOLAR_RADIUS_AU = 0.004650467
const SOLAR_MASS_EARTHS = 332_946
// The model's own calendar year. Using it as the Kepler reference keeps a
// 365-day year at one solar mass exactly 1 AU, so the Earth defaults stay
// 1 AU and 1367 W/m².
const EARTH_YEAR_DAYS = 365
const EARTH_MASS_KG = 5.9722e24
const SOLAR_MASS_KG = 1.98892e30
const GRAVITATIONAL_CONSTANT = 6.6743e-11
const SOLAR_DENSITY_GCC = 1.408
// Habitable-zone edges at one solar luminosity, close to the conservative
// Kopparapu et al. (2013) limits of 0.99 and 1.70 AU; the snow line follows
// the conventional 2.7 AU. All three scale with sqrt(luminosity).
const HABITABLE_INNER_AU = 0.95
const HABITABLE_OUTER_AU = 1.67
const SNOW_LINE_AU = 2.7
const ROCHE_COEFFICIENT = 2.44
// Constant-Q tidal friction (Goldreich & Soter 1966).
const TIDAL_OMEGA = 7e-5
const TIDAL_LOVE_NUMBER = 0.3
const TIDAL_DISSIPATION = 100
// A timescale below a tenth of the stellar age means the planet should have
// locked, and below the age itself means it may have.
const TIDAL_LOCK_CERTAIN_AGE_FRACTION = 0.1
const YEARS_PER_GYR = 1e9
const SECONDS_PER_YEAR = 3.15576e7
const SEASONS: ReadonlyArray<string> = [
	"near autumn equinox",
	"northern autumn",
	"near winter solstice",
	"northern winter",
	"near spring equinox",
	"northern spring",
	"near summer solstice",
	"northern summer",
]

function periodDays({
	semiMajorAxisAu,
	totalMassSolar,
}: OrbitPeriodRequest): number {
	return (
		EARTH_YEAR_DAYS *
		Math.sqrt(
			Math.max(semiMajorAxisAu, 1e-6) ** 3 / Math.max(totalMassSolar, 1e-4),
		)
	)
}

function semiMajorAxisAu({
	periodDays: period,
	totalMassSolar,
}: OrbitAxisRequest): number {
	return (
		(Math.max(totalMassSolar, 1e-4) * (period / EARTH_YEAR_DAYS) ** 2) **
		(1 / 3)
	)
}

function insolation({
	luminositySolar,
	semiMajorAxisAu: axis,
}: OrbitInsolationRequest): number {
	return STAR.flux({ luminositySolar, distanceAu: axis })
}

function equilibriumTemperature({
	insolationWm2,
	albedo,
}: OrbitTemperatureRequest): number {
	const STEFAN_BOLTZMANN = 5.670374419e-8
	return ((insolationWm2 * (1 - albedo)) / (4 * STEFAN_BOLTZMANN)) ** 0.25
}

function zones({ luminositySolar }: OrbitZoneRequest): OrbitZones {
	const root = Math.sqrt(Math.max(luminositySolar, 0))
	return {
		habitableInnerAu: HABITABLE_INNER_AU * root,
		habitableOuterAu: HABITABLE_OUTER_AU * root,
		snowLineAu: SNOW_LINE_AU * root,
	}
}

function distanceRange({
	semiMajorAxisAu: axis,
	eccentricity,
}: OrbitDistanceRangeRequest): OrbitDistanceRange {
	const e = Math.min(Math.max(eccentricity, 0), 0.95)
	return {
		perihelionAu: axis * (1 - e),
		aphelionAu: axis * (1 + e),
	}
}

function hillRadiusAu({
	semiMajorAxisAu: axis,
	eccentricity,
	planetMassEarth,
	totalMassSolar,
}: OrbitHillRadiusRequest): number {
	const e = Math.min(Math.max(eccentricity, 0), 0.95)
	const ratio =
		planetMassEarth / (3 * Math.max(totalMassSolar * SOLAR_MASS_EARTHS, 1e-6))
	return axis * (1 - e) * ratio ** (1 / 3)
}

function rocheLimitAu({
	starLuminositySolar,
	starMassSolar,
	starTemperatureK,
	planetDensityGcc,
}: OrbitRocheLimitRequest): number {
	const temperatureRatio = Math.max(
		starTemperatureK / STAR.SOLAR_TEMPERATURE_K,
		0.05,
	)
	const starRadiusSolar =
		Math.sqrt(Math.max(starLuminositySolar, 1e-12)) /
		(temperatureRatio * temperatureRatio)
	const starDensityGcc =
		(SOLAR_DENSITY_GCC * Math.max(starMassSolar, 1e-4)) /
		Math.max(starRadiusSolar ** 3, 1e-12)
	return (
		ROCHE_COEFFICIENT *
		starRadiusSolar *
		(starDensityGcc / Math.max(planetDensityGcc, 0.01)) ** (1 / 3) *
		SOLAR_RADIUS_AU
	)
}

function tidalLockGyr({
	planetMassEarth,
	planetRadiusKm,
	starMassSolar,
	semiMajorAxisAu: axis,
}: OrbitTidalLockRequest): number {
	const planetMass = planetMassEarth * EARTH_MASS_KG
	const planetRadius = planetRadiusKm * 1000
	const starMass = starMassSolar * SOLAR_MASS_KG
	const distance = axis * AU_KM * 1000
	const seconds =
		(TIDAL_OMEGA *
			distance ** 6 *
			(0.33 * planetMass * planetRadius ** 2) *
			TIDAL_DISSIPATION) /
		(3 *
			GRAVITATIONAL_CONSTANT *
			starMass ** 2 *
			TIDAL_LOVE_NUMBER *
			planetRadius ** 5)
	return seconds / SECONDS_PER_YEAR / YEARS_PER_GYR
}

function tidalLockStatus({
	timescaleGyr,
	ageGyr,
}: OrbitTidalLockStatusRequest): OrbitTidalLockStatus {
	if (timescaleGyr < ageGyr * TIDAL_LOCK_CERTAIN_AGE_FRACTION) return "locked"
	if (timescaleGyr < ageGyr) return "may"
	return "not"
}

function closestApproach({ periapseLongitudeDeg }: OrbitSeasonRequest): string {
	const index =
		Math.floor(((((periapseLongitudeDeg + 22.5) % 360) + 360) % 360) / 45) % 8
	return SEASONS[index]
}

function system({
	host,
	semiMajorAxisAu: axis,
	eccentricity,
	periapseLongitudeDeg,
	planetMassEarth,
	planetRadiusKm,
	planetDensityGcc,
}: OrbitSystemRequest): OrbitSystem {
	const totalMassSolar = host.massSolar
	return {
		periodDays: periodDays({ semiMajorAxisAu: axis, totalMassSolar }),
		insolationWm2: insolation({
			luminositySolar: host.luminositySolar,
			semiMajorAxisAu: axis,
		}),
		distanceRange: distanceRange({
			semiMajorAxisAu: axis,
			eccentricity,
		}),
		zones: zones({ luminositySolar: host.luminositySolar }),
		hillRadiusAu: hillRadiusAu({
			semiMajorAxisAu: axis,
			eccentricity,
			planetMassEarth,
			totalMassSolar,
		}),
		rocheLimitAu: rocheLimitAu({
			starLuminositySolar: host.luminositySolar,
			starMassSolar: host.massSolar,
			starTemperatureK: host.temperatureK,
			planetDensityGcc,
		}),
		tidalLockGyr: tidalLockGyr({
			planetMassEarth,
			planetRadiusKm,
			starMassSolar: host.massSolar,
			semiMajorAxisAu: axis,
		}),
		closestApproach: closestApproach({ periapseLongitudeDeg }),
	}
}

export const ORBIT = {
	periodDays,
	semiMajorAxisAu,
	equilibriumTemperature,
	system,
	tidalLockStatus,
}
