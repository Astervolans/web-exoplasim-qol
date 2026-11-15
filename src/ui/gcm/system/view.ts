import { CELESTIAL_ATMOSPHERE } from "@/model/celestial/atmosphere"
import { ORBIT } from "@/model/celestial/orbit"
import type { OrbitTidalLockStatus } from "@/model/celestial/orbit/types"
import type { GcmSystemSummary } from "@/model/climate/gcm/system/types"
import type {
	GcmAtmosphereRowsRequest,
	GcmOrbitRowsRequest,
	GcmPlanetRowsRequest,
	GcmStarRowsRequest,
	GcmTidalLockAdviceRequest,
} from "@/ui/gcm/system/types"
import type { GcmBalanceRow } from "@/ui/gcm/types"
import {
	formatTemperature,
	formatWithUnit,
} from "@/ui/genesis/shared/ui-format"

const TIDAL_LOCK_LABELS: Record<OrbitTidalLockStatus, string> = {
	locked: "Likely tidally locked",
	may: "May be tidally locked",
	not: "Not tidally locked",
}

function durationGyr(value: number): string {
	return value < 0.01
		? `${value.toExponential(1)} Gyr`
		: formatWithUnit(value, "Gyr", value < 10 ? 1 : 0)
}

function luminosity(value: number): string {
	if (value > 0 && value < 0.01) return `${value.toExponential(1)} L☉`
	return formatWithUnit(value, "L☉", 3)
}

function distanceAu(value: number): string {
	return value < 0.01
		? formatWithUnit(value, "AU", 4)
		: formatWithUnit(value, "AU", 3)
}

function amount(value: number, digits: number): string {
	return value.toLocaleString(undefined, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	})
}

function starRows({
	summary,
}: GcmStarRowsRequest): ReadonlyArray<GcmBalanceRow> {
	return [
		{
			label: "Temperature",
			value: formatWithUnit(summary.star.temperatureK, "K", 0),
		},
		{ label: "Luminosity", value: luminosity(summary.star.luminositySolar) },
		{
			label: "Radius",
			value: formatWithUnit(summary.star.radiusSolar, "R☉", 3),
		},
		{
			label: "Main sequence",
			value: formatWithUnit(summary.star.lifetimeGyr, "Gyr", 1),
		},
		{
			label: "Flux at the planet",
			value: formatWithUnit(summary.orbit.insolationWm2, "W/m²", 0),
		},
		{ label: "Spectral class", value: summary.star.spectralClass },
	]
}

function planetRows({
	summary,
}: GcmPlanetRowsRequest): ReadonlyArray<GcmBalanceRow> {
	const { planet } = summary
	return [
		{
			label: "Mass",
			value: formatWithUnit(
				planet.massEarth,
				"M⊕",
				planet.massEarth < 10 ? 2 : 0,
			),
		},
		{
			label: "Radius",
			value: `${amount(planet.radiusKm, 0)} km · ${formatWithUnit(planet.radiusEarth, "R⊕", 2)}`,
		},
		{ label: "Density", value: formatWithUnit(planet.densityGcc, "g/cm³", 2) },
		{
			label: "Gravity",
			value: `${formatWithUnit(planet.gravityMs2, "m/s²", 2)} · ${formatWithUnit(planet.gravityEarth, "g", 2)}`,
		},
		{
			label: "Escape velocity",
			value: formatWithUnit(planet.escapeVelocityKms, "km/s", 1),
		},
		{
			label: "Composition",
			value: `Fe ${Math.round(planet.composition.core * 100)}% · H₂O ${Math.round(planet.composition.water * 100)}%`,
		},
		{ label: "Type", value: planet.label },
	]
}

function tidalLockStatus({
	summary,
}: {
	summary: GcmSystemSummary
}): OrbitTidalLockStatus {
	return ORBIT.tidalLockStatus({
		timescaleGyr: summary.orbit.tidalLockGyr,
		ageGyr: summary.star.ageGyr,
	})
}

function tidalLockAdvice({
	summary,
	synchronous,
}: GcmTidalLockAdviceRequest): string {
	const status = tidalLockStatus({ summary })
	const estimate = `Tidal lock estimate: ${TIDAL_LOCK_LABELS[status].toLowerCase()} (${durationGyr(summary.orbit.tidalLockGyr)}, stellar age ${formatWithUnit(summary.star.ageGyr, "Gyr", 1)}).`
	if (status === "locked" && !synchronous)
		return `${estimate} Consider enabling Tidally locked.`
	if (status === "may" && !synchronous)
		return `${estimate} Tidally locked is optional.`
	if (status === "not" && synchronous)
		return `${estimate} The star is fixed in longitude regardless.`
	return estimate
}

function orbitRows({
	summary,
}: GcmOrbitRowsRequest): ReadonlyArray<GcmBalanceRow> {
	const range = summary.orbit.distanceRange
	const lock = tidalLockStatus({ summary })
	return [
		{ label: "Semi-major axis", value: distanceAu(summary.semiMajorAxisAu) },
		{
			label: "Perihelion / aphelion",
			value: `${distanceAu(range.perihelionAu)} · ${distanceAu(range.aphelionAu)}`,
		},
		{
			label: "Habitable zone (estimate)",
			value: `${distanceAu(summary.orbit.zones.habitableInnerAu)} – ${distanceAu(summary.orbit.zones.habitableOuterAu)}`,
		},
		{
			label: "Insolation",
			value: formatWithUnit(summary.orbit.insolationWm2, "W/m²", 0),
		},
		{
			label: "Equilibrium temperature",
			value: formatTemperature(
				summary.equilibriumTemperatureK - 273.15,
				"metric",
			),
		},
		{
			label: "Surface temperature (estimate)",
			value: formatTemperature(
				summary.atmosphere.surfaceTemperatureK - 273.15,
				"metric",
			),
		},
		{
			label: "Hill radius",
			value: distanceAu(summary.orbit.hillRadiusAu),
		},
		{
			label: "Roche limit",
			value: formatWithUnit(summary.orbit.rocheLimitAu, "AU", 4),
		},
		{
			label: "Tidal locking",
			value: `${TIDAL_LOCK_LABELS[lock]} · ${durationGyr(summary.orbit.tidalLockGyr)}`,
		},
		{ label: "Closest approach", value: summary.orbit.closestApproach },
	]
}

function atmosphereRows({
	summary,
	unitSystem,
}: GcmAtmosphereRowsRequest): ReadonlyArray<GcmBalanceRow> {
	const { atmosphere } = summary
	return [
		{
			label: "Mean molar mass",
			value: formatWithUnit(atmosphere.meanMolarMass, "g/mol", 2),
		},
		{
			label: "Heat capacity",
			value: formatWithUnit(atmosphere.heatCapacity, "J/(kg·K)", 0),
		},
		{
			label: "Gas constant",
			value: formatWithUnit(atmosphere.gasConstant, "J/(kg·K)", 1),
		},
		{
			label: "Greenhouse estimate",
			value: formatWithUnit(atmosphere.greenhouseK, "K", 1),
		},
		{
			label: "Surface temperature (estimate)",
			value: formatTemperature(
				atmosphere.surfaceTemperatureK - 273.15,
				unitSystem,
			),
		},
		{
			label: "Equilibrium temperature",
			value: formatTemperature(
				summary.equilibriumTemperatureK - 273.15,
				unitSystem,
			),
		},
		{
			label: "Scale height",
			value: formatWithUnit(atmosphere.scaleHeightKm, "km", 1),
		},
		{
			label: "Atmosphere height",
			value: formatWithUnit(atmosphere.atmosphereHeightKm, "km", 0),
		},
		{
			label: "Climate",
			value: CELESTIAL_ATMOSPHERE.REGIME_LABELS[atmosphere.regime],
		},
	]
}

export const GCM_SYSTEM_VIEW = {
	starRows,
	planetRows,
	orbitRows,
	atmosphereRows,
	tidalLockAdvice,
}
