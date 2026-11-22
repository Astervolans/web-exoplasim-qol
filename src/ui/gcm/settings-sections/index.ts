import { GCM } from "@/model/climate/gcm"
import type { GcmConfig } from "@/model/climate/gcm/types"
import type {
	GcmSettingsMode,
	GcmSettingsSection,
	GcmSettingsSectionQuery,
} from "@/ui/gcm/settings-sections/types"

const SECTION_KEYS: Record<
	GcmSettingsSection,
	ReadonlyArray<keyof GcmConfig>
> = {
	planet: ["radiusEarth", "gravityMs2", "obliquityDeg"],
	star: ["starMassSolar", "starAgeGyr"],
	orbit: [
		"eccentricity",
		"rotationPeriodDays",
		"yearDays",
		"synchronous",
		"substellarLongitudeDeg",
		"keplerian",
		"periapseLongitudeDeg",
		"initialMeanAnomalyDeg",
		"fixedOrbit",
	],
	atmosphere: ["atmosphere", "targetTemperatureK"],
	surface: [
		"oceanDepthM",
		"oceanDiffusivityM2S",
		"vegetation",
		"initialGrowth",
		"wetSoil",
		"glaciers",
		"earthSurfaceClimatology",
		"soilDepthScale",
		"landAlbedo",
		"oceanAlbedo",
		"snowIceAlbedo",
		"soilWaterCapacityM",
		"soilHeatCapacity",
	],
	model: [
		"truncation",
		"layers",
		"timestepMinutes",
		"physicsFilter",
		"stormclim",
	],
}

const ADVANCED_KEYS: Record<
	GcmSettingsSection,
	ReadonlyArray<keyof GcmConfig>
> = {
	planet: ["radiusEarth", "gravityMs2"],
	star: ["fluxWm2", "starTemperatureK"],
	orbit: [
		"obliquityDeg",
		"eccentricity",
		"rotationPeriodDays",
		"yearDays",
		"synchronous",
		"substellarLongitudeDeg",
		"keplerian",
		"periapseLongitudeDeg",
		"initialMeanAnomalyDeg",
		"fixedOrbit",
	],
	atmosphere: ["atmosphere", "targetTemperatureK"],
	surface: [],
	model: [],
}

function keys({
	section,
	mode,
}: {
	section: GcmSettingsSection
	mode: GcmSettingsMode
}): ReadonlyArray<keyof GcmConfig> {
	return mode === "advanced" ? ADVANCED_KEYS[section] : SECTION_KEYS[section]
}

function comparable(value: unknown): string {
	return JSON.stringify(Array.isArray(value) ? [...value].sort() : value)
}

function modified({ config, section, mode }: GcmSettingsSectionQuery): boolean {
	return keys({ section, mode }).some(
		(key) => comparable(config[key]) !== comparable(GCM.DEFAULT_CONFIG[key]),
	)
}

function reset({ config, section, mode }: GcmSettingsSectionQuery): GcmConfig {
	return keys({ section, mode }).reduce<GcmConfig>(
		(next, key) => ({ ...next, [key]: GCM.DEFAULT_CONFIG[key] }),
		config,
	)
}

export const GCM_SETTINGS_SECTIONS = {
	modified,
	reset,
}
