import { GCM_SYSTEM } from "@/model/climate/gcm/system"
import { InputLabel } from "@/ui/components/primitives/InputLabel"
import { LabeledSlider } from "@/ui/components/primitives/LabeledSlider"
import { LabeledValueRow } from "@/ui/components/primitives/LabeledValueRow"
import { SegmentedControl } from "@/ui/components/primitives/SegmentedControl"
import { ToggleRow } from "@/ui/components/primitives/ToggleRow"
import { uiPalette, uiTokens } from "@/ui/components/tokens"
import { GcmOverrideControls } from "@/ui/gcm/GcmOverrideControls"
import { GCM_INPUT_HELP } from "@/ui/gcm/input-help"
import { OrbitDiagram } from "@/ui/gcm/system/OrbitDiagram"
import { SystemSlider } from "@/ui/gcm/system/SystemSlider"
import type { GcmSystemPanelProps } from "@/ui/gcm/system/types"
import { GCM_SYSTEM_VIEW } from "@/ui/gcm/system/view"
import { formatWithUnit } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

const NATIVE_PERIAPSE_DEG = 102.7
const ROTATION_DAYS = GCM_SYSTEM.rotationDaysRange
const MIN_YEAR_DAYS = 10
const MAX_YEAR_DAYS = 720
const ROTATION_OPTIONS = [
	{ value: "free", label: "Free rotation" },
	{ value: "locked", label: "Tidally locked" },
] as const

export function OrbitPanel({
	config,
	summary,
	disabled,
	locked,
	onChange,
}: GcmSystemPanelProps) {
	const structural = disabled || locked
	const label = uiTokens.field.label
	return (
		<div className="space-y-3">
			<OrbitDiagram
				semiMajorAxisAu={summary.semiMajorAxisAu}
				eccentricity={config.eccentricity}
				periodDays={config.yearDays}
				zones={summary.orbit.zones}
				planetRadiusEarth={summary.planet.radiusEarth}
				planetColor={uiPalette.celestial.planet}
				starColor={uiPalette.celestial.star}
			/>
			<SystemSlider
				label={I18N.t("Year length")}
				help={GCM_INPUT_HELP.yearDays}
				value={config.yearDays}
				display={formatWithUnit(config.yearDays, "days", 0)}
				min={MIN_YEAR_DAYS}
				max={MAX_YEAR_DAYS}
				step={1}
				scale="linear"
				disabled={structural}
				onChange={(yearDays) =>
					onChange(
						GCM_SYSTEM.withPeriod({ config, yearDays, refreshFlux: true }),
					)
				}
			/>
			<SystemSlider
				label={I18N.t("Eccentricity")}
				help={GCM_INPUT_HELP.eccentricity}
				value={config.eccentricity}
				display={formatWithUnit(config.eccentricity, "", 3)}
				min={0}
				max={0.8}
				step={0.005}
				scale="linear"
				disabled={disabled}
				onChange={(eccentricity) => onChange({ ...config, eccentricity })}
			/>
			<SystemSlider
				label={I18N.t("Longitude of periapsis")}
				help={GCM_INPUT_HELP.periapseLongitudeDeg}
				value={config.periapseLongitudeDeg ?? NATIVE_PERIAPSE_DEG}
				display={formatWithUnit(
					config.periapseLongitudeDeg ?? NATIVE_PERIAPSE_DEG,
					"°",
					1,
				)}
				min={0}
				max={360}
				step={0.1}
				scale="linear"
				disabled={disabled}
				onChange={(periapseLongitudeDeg) =>
					onChange({ ...config, periapseLongitudeDeg })
				}
			/>
			<div className="space-y-1">
				<span className={label}>
					<InputLabel
						label={I18N.t("Rotation")}
						help={GCM_INPUT_HELP.synchronous}
					/>
				</span>
				<SegmentedControl
					fullWidth
					options={ROTATION_OPTIONS.map((option) => ({
						...option,
						label: I18N.t(option.label),
					}))}
					value={config.synchronous ? "locked" : "free"}
					onChange={(mode) => {
						if (structural) return
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
			</div>
			<SystemSlider
				label={I18N.t("Rotation period")}
				help={GCM_INPUT_HELP.rotationPeriodDays}
				value={config.rotationPeriodDays}
				display={formatWithUnit(config.rotationPeriodDays, "days", 2)}
				min={ROTATION_DAYS.min}
				max={ROTATION_DAYS.max}
				step={0.25}
				scale="linear"
				disabled={structural || config.synchronous}
				onChange={(rotationPeriodDays) =>
					onChange({ ...config, rotationPeriodDays })
				}
			/>
			{config.synchronous && (
				<LabeledSlider
					label={I18N.t("Substellar longitude")}
					help={GCM_INPUT_HELP.substellarLongitudeDeg}
					value={formatWithUnit(config.substellarLongitudeDeg, "°E", 0)}
					numericValue={config.substellarLongitudeDeg}
					min={0}
					max={360}
					step={1}
					disabled={structural}
					onChange={(substellarLongitudeDeg) =>
						onChange({ ...config, substellarLongitudeDeg })
					}
				/>
			)}
			<div className="space-y-1">
				{GCM_SYSTEM_VIEW.orbitRows({ summary }).map((row) => (
					<LabeledValueRow
						key={row.label}
						size="md"
						label={row.label}
						value={row.value}
					/>
				))}
			</div>
			<details className="space-y-2">
				<summary className={uiTokens.field.disclosure}>
					{I18N.t("Advanced orbit")}
				</summary>
				<div className="space-y-2 pt-2">
					<ToggleRow
						label={I18N.t("Generic Keplerian orbit")}
						help={GCM_INPUT_HELP.keplerian}
						checked={config.keplerian}
						disabled={structural}
						onChange={(keplerian) => onChange({ ...config, keplerian })}
					/>
					<GcmOverrideControls
						section="orbit"
						config={config}
						unitSystem="metric"
						disabled={structural}
						onChange={onChange}
					/>
					<ToggleRow
						label={I18N.t("Fixed orbit")}
						help={GCM_INPUT_HELP.fixedOrbit}
						checked={config.fixedOrbit}
						disabled={disabled}
						onChange={(fixedOrbit) => onChange({ ...config, fixedOrbit })}
					/>
				</div>
			</details>
			<p className={uiTokens.field.note}>
				{I18N.t(
					"Semi-major axis, insolation and the habitable zone follow from the stellar luminosity and Kepler's third law. The model's own orbital illumination uses the year length and eccentricity set here. The zone edges and both temperature rows are estimates: the band is flux-scaled, the equilibrium temperature assumes a 0.3 albedo and no greenhouse warming, and the surface temperature adds the atmosphere's greenhouse fit.",
				)}
			</p>
		</div>
	)
}
