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
import { I18N } from "@/ui/i18n"

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
			label: I18N.t("Temperature"),
			value: formatWithUnit(summary.star.temperatureK, "K", 0),
		},
		{
			label: I18N.t("Luminosity"),
			value: luminosity(summary.star.luminositySolar),
		},
		{
			label: I18N.t("Radius"),
			value: formatWithUnit(summary.star.radiusSolar, "R☉", 3),
		},
		{
			label: I18N.t("Main sequence"),
			value: formatWithUnit(summary.star.lifetimeGyr, "Gyr", 1),
		},
		{
			label: I18N.t("Flux at the planet"),
			value: formatWithUnit(summary.orbit.insolationWm2, "W/m²", 0),
		},
		{ label: I18N.t("Spectral class"), value: summary.star.spectralClass },
	]
}

function planetRows({
	summary,
}: GcmPlanetRowsRequest): ReadonlyArray<GcmBalanceRow> {
	const { planet } = summary
	return [
		{
			label: I18N.t("Mass"),
			value: formatWithUnit(
				planet.massEarth,
				"M⊕",
				planet.massEarth < 10 ? 2 : 0,
			),
		},
		{
			label: I18N.t("Radius"),
			value: `${amount(planet.radiusKm, 0)} km · ${formatWithUnit(planet.radiusEarth, "R⊕", 2)}`,
		},
		{
			label: I18N.t("Density"),
			value: formatWithUnit(planet.densityGcc, "g/cm³", 2),
		},
		{
			label: I18N.t("Gravity"),
			value: `${formatWithUnit(planet.gravityMs2, "m/s²", 2)} · ${formatWithUnit(planet.gravityEarth, "g", 2)}`,
		},
		{
			label: I18N.t("Escape velocity"),
			value: formatWithUnit(planet.escapeVelocityKms, "km/s", 1),
		},
		{
			label: I18N.t("Composition"),
			value: `Fe ${Math.round(planet.composition.core * 100)}% · H₂O ${Math.round(planet.composition.water * 100)}%`,
		},
		{ label: I18N.t("Type"), value: I18N.t(planet.label) },
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
	const estimate = I18N.t(
		"Tidal lock estimate: {status} ({timescale}, stellar age {age}).",
		{
			status: I18N.t(TIDAL_LOCK_LABELS[status]).toLowerCase(),
			timescale: durationGyr(summary.orbit.tidalLockGyr),
			age: formatWithUnit(summary.star.ageGyr, "Gyr", 1),
		},
	)
	if (status === "locked" && !synchronous)
		return I18N.t("{estimate} Consider enabling Tidally locked.", { estimate })
	if (status === "may" && !synchronous)
		return I18N.t("{estimate} Tidally locked is optional.", { estimate })
	if (status === "not" && synchronous)
		return I18N.t("{estimate} The star is fixed in longitude regardless.", {
			estimate,
		})
	return estimate
}

function orbitRows({
	summary,
}: GcmOrbitRowsRequest): ReadonlyArray<GcmBalanceRow> {
	const range = summary.orbit.distanceRange
	const lock = tidalLockStatus({ summary })
	return [
		{
			label: I18N.t("Semi-major axis"),
			value: distanceAu(summary.semiMajorAxisAu),
		},
		{
			label: I18N.t("Perihelion / aphelion"),
			value: `${distanceAu(range.perihelionAu)} · ${distanceAu(range.aphelionAu)}`,
		},
		{
			label: I18N.t("Habitable zone (estimate)"),
			value: `${distanceAu(summary.orbit.zones.habitableInnerAu)} – ${distanceAu(summary.orbit.zones.habitableOuterAu)}`,
		},
		{
			label: I18N.t("Insolation"),
			value: formatWithUnit(summary.orbit.insolationWm2, "W/m²", 0),
		},
		{
			label: I18N.t("Equilibrium temperature"),
			value: formatTemperature(
				summary.equilibriumTemperatureK - 273.15,
				"metric",
			),
		},
		{
			label: I18N.t("Surface temperature (estimate)"),
			value: formatTemperature(
				summary.atmosphere.surfaceTemperatureK - 273.15,
				"metric",
			),
		},
		{
			label: I18N.t("Hill radius"),
			value: distanceAu(summary.orbit.hillRadiusAu),
		},
		{
			label: I18N.t("Roche limit"),
			value: formatWithUnit(summary.orbit.rocheLimitAu, "AU", 4),
		},
		{
			label: I18N.t("Tidal locking"),
			value: `${I18N.t(TIDAL_LOCK_LABELS[lock])} · ${durationGyr(summary.orbit.tidalLockGyr)}`,
		},
		{
			label: I18N.t("Closest approach"),
			value: I18N.t(summary.orbit.closestApproach),
		},
	]
}

function atmosphereRows({
	summary,
	unitSystem,
}: GcmAtmosphereRowsRequest): ReadonlyArray<GcmBalanceRow> {
	const { atmosphere } = summary
	return [
		{
			label: I18N.t("Mean molar mass"),
			value: formatWithUnit(atmosphere.meanMolarMass, "g/mol", 2),
		},
		{
			label: I18N.t("Heat capacity"),
			value: formatWithUnit(atmosphere.heatCapacity, "J/(kg·K)", 0),
		},
		{
			label: I18N.t("Gas constant"),
			value: formatWithUnit(atmosphere.gasConstant, "J/(kg·K)", 1),
		},
		{
			label: I18N.t("Greenhouse estimate"),
			value: formatWithUnit(atmosphere.greenhouseK, "K", 1),
		},
		{
			label: I18N.t("Surface temperature (estimate)"),
			value: formatTemperature(
				atmosphere.surfaceTemperatureK - 273.15,
				unitSystem,
			),
		},
		{
			label: I18N.t("Equilibrium temperature"),
			value: formatTemperature(
				summary.equilibriumTemperatureK - 273.15,
				unitSystem,
			),
		},
		{
			label: I18N.t("Scale height"),
			value: formatWithUnit(atmosphere.scaleHeightKm, "km", 1),
		},
		{
			label: I18N.t("Atmosphere height"),
			value: formatWithUnit(atmosphere.atmosphereHeightKm, "km", 0),
		},
		{
			label: I18N.t("Climate"),
			value: I18N.t(CELESTIAL_ATMOSPHERE.REGIME_LABELS[atmosphere.regime]),
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
