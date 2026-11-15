import { GCM_CONTINUATION } from "@/model/climate/gcm/continuation"
import { GCM_SYSTEM } from "@/model/climate/gcm/system"
import type { GcmConfig } from "@/model/climate/gcm/types"
import { LabeledSlider } from "@/ui/components/primitives/LabeledSlider"
import { SegmentedControl } from "@/ui/components/primitives/SegmentedControl"
import { ToggleRow } from "@/ui/components/primitives/ToggleRow"
import { uiTokens } from "@/ui/components/tokens"
import { GcmAtmosphereControls } from "@/ui/gcm/GcmAtmosphereControls"
import { GcmOverrideControls } from "@/ui/gcm/GcmOverrideControls"
import { GCM_SYSTEM_VIEW } from "@/ui/gcm/system/view"
import { TerrainPanel } from "@/ui/gcm/terrain/TerrainPanel"
import type { GcmAdvancedPanelProps } from "@/ui/gcm/types"
import { formatWithUnit } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

type GcmNumericKey = Extract<
	keyof GcmConfig,
	| "fluxWm2"
	| "starTemperatureK"
	| "obliquityDeg"
	| "eccentricity"
	| "rotationPeriodDays"
	| "yearDays"
	| "radiusEarth"
	| "gravityMs2"
	| "substellarLongitudeDeg"
>

const SLIDERS = {
	flux: {
		label: "Stellar flux",
		min: 800,
		max: 2000,
		step: 1,
		unit: "W/m²",
		digits: 0,
	},
	starTemperature: {
		label: "Star temperature",
		min: 2600,
		max: 10000,
		step: 10,
		unit: "K",
		digits: 0,
	},
	obliquity: {
		label: "Obliquity",
		min: 0,
		max: 90,
		step: 0.5,
		unit: "°",
		digits: 2,
	},
	eccentricity: {
		label: "Eccentricity",
		min: 0,
		max: 0.8,
		step: 0.005,
		unit: "",
		digits: 3,
	},
	rotation: {
		label: "Rotation period",
		min: GCM_SYSTEM.rotationDaysRange.min,
		max: GCM_SYSTEM.rotationDaysRange.max,
		step: 0.25,
		unit: "days",
		digits: 2,
	},
	year: {
		label: "Year length",
		min: 10,
		max: 720,
		step: 1,
		unit: "days",
		digits: 0,
	},
	radius: {
		label: "Planet radius",
		min: 0.5,
		max: 2,
		step: 0.01,
		unit: "R⊕",
		digits: 2,
	},
	gravity: {
		label: "Surface gravity",
		min: 1,
		max: 30,
		step: 0.01,
		unit: "m/s²",
		digits: 2,
	},
	substellar: {
		label: "Substellar longitude",
		min: 0,
		max: 360,
		step: 1,
		unit: "°E",
		digits: 0,
	},
} as const

export function GcmAdvancedPanel({
	section,
	config,
	summary,
	disabled,
	locked,
	onChange,
	hasTerrain,
	latitudes,
	unitSystem,
	starPoints,
	zoneCircles,
	onTerrainChange,
}: GcmAdvancedPanelProps) {
	const update = (patch: Partial<GcmConfig>) => {
		if (!disabled) onChange({ ...config, ...patch })
	}
	const isDisabled = (key: keyof GcmConfig) =>
		disabled ||
		(key === "rotationPeriodDays" && config.synchronous) ||
		(locked && !GCM_CONTINUATION.EDITABLE.includes(key))
	const slider = (key: keyof typeof SLIDERS, configKey: GcmNumericKey) => {
		const spec = SLIDERS[key]
		const apply = (value: number) =>
			configKey === "yearDays"
				? onChange(
						GCM_SYSTEM.withPeriod({
							config,
							yearDays: value,
							refreshFlux: false,
						}),
					)
				: update({ [configKey]: value })
		return (
			<LabeledSlider
				key={configKey}
				label={I18N.t(spec.label)}
				value={formatWithUnit(config[configKey], spec.unit, spec.digits)}
				numericValue={config[configKey]}
				min={spec.min}
				max={spec.max}
				step={spec.step}
				disabled={isDisabled(configKey)}
				onChange={apply}
			/>
		)
	}
	if (section === "star")
		return (
			<div className="space-y-3">
				{slider("flux", "fluxWm2")}
				{slider("starTemperature", "starTemperatureK")}
			</div>
		)
	if (section === "orbit")
		return (
			<div className="space-y-3">
				{slider("obliquity", "obliquityDeg")}
				{slider("eccentricity", "eccentricity")}
				{slider("rotation", "rotationPeriodDays")}
				{slider("year", "yearDays")}
				<SegmentedControl
					fullWidth
					options={[
						{ value: "free", label: I18N.t("Free rotation") },
						{ value: "locked", label: I18N.t("Tidally locked") },
					]}
					value={config.synchronous ? "locked" : "free"}
					onChange={(mode) => {
						if (disabled) return
						onChange(
							GCM_SYSTEM.withSynchronous({
								config,
								synchronous: mode === "locked",
							}),
						)
					}}
				/>
				<p className={uiTokens.field.note}>
					{GCM_SYSTEM_VIEW.tidalLockAdvice({
						summary,
						synchronous: config.synchronous,
					})}
				</p>
				{config.synchronous && slider("substellar", "substellarLongitudeDeg")}
				<details className="space-y-2">
					<summary className={uiTokens.field.disclosure}>
						{I18N.t("Advanced orbit")}
					</summary>
					<div className="space-y-2 pt-2">
						<ToggleRow
							label={I18N.t("Generic Keplerian orbit")}
							checked={config.keplerian}
							disabled={isDisabled("keplerian")}
							onChange={(keplerian) => update({ keplerian })}
						/>
						<GcmOverrideControls
							section="orbit"
							config={config}
							unitSystem={unitSystem}
							disabled={isDisabled("periapseLongitudeDeg")}
							onChange={onChange}
						/>
						<ToggleRow
							label={I18N.t("Fixed orbit")}
							checked={config.fixedOrbit}
							disabled={isDisabled("fixedOrbit")}
							onChange={(fixedOrbit) => update({ fixedOrbit })}
						/>
					</div>
				</details>
			</div>
		)
	if (section === "planet")
		return (
			<div className="space-y-3">
				{slider("radius", "radiusEarth")}
				{slider("gravity", "gravityMs2")}
				<TerrainPanel
					hasTerrain={hasTerrain}
					latitudes={latitudes}
					disabled={disabled || locked}
					unitSystem={unitSystem}
					starPoints={starPoints}
					zoneCircles={zoneCircles}
					onChange={onTerrainChange}
				/>
			</div>
		)
	return (
		<GcmAtmosphereControls
			locked={locked}
			config={config.atmosphere}
			disabled={disabled}
			onChange={(next) => update({ atmosphere: next })}
		/>
	)
}
