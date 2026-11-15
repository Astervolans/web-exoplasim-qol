import { GCM_SYSTEM } from "@/model/climate/gcm/system"
import { LabeledValueRow } from "@/ui/components/primitives/LabeledValueRow"
import { uiTokens } from "@/ui/components/tokens"
import { GCM_INPUT_HELP } from "@/ui/gcm/input-help"
import { InteriorDiagram } from "@/ui/gcm/system/InteriorDiagram"
import { SystemSlider } from "@/ui/gcm/system/SystemSlider"
import type { GcmPlanetPanelProps } from "@/ui/gcm/system/types"
import { GCM_SYSTEM_VIEW } from "@/ui/gcm/system/view"
import { TerrainPanel } from "@/ui/gcm/terrain/TerrainPanel"
import { formatWithUnit } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

const MIN_MASS_EARTH = 0.05
const MAX_MASS_EARTH = 10
const MIN_RADIUS_EARTH = 0.5
const MAX_RADIUS_EARTH = 2

export function PlanetPanel({
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
}: GcmPlanetPanelProps) {
	const massEarth = GCM_SYSTEM.mass({ config })
	const structural = disabled || locked
	return (
		<div className="space-y-3">
			<InteriorDiagram
				layers={summary.interior.layers}
				radiusKm={summary.interior.radiusKm}
				obliquityDeg={config.obliquityDeg}
				coreTemperatureK={summary.interior.coreTemperatureK}
				corePressureGPa={summary.interior.corePressureGPa}
			/>
			<SystemSlider
				label={I18N.t("Planet mass")}
				help={GCM_INPUT_HELP.planetMassEarth}
				value={massEarth}
				display={formatWithUnit(massEarth, "M⊕", massEarth < 10 ? 2 : 1)}
				min={MIN_MASS_EARTH}
				max={MAX_MASS_EARTH}
				step={0.001}
				scale="log"
				disabled={structural}
				onChange={(value) =>
					onChange(
						GCM_SYSTEM.withPlanet({
							config,
							massEarth: value,
							radiusEarth: config.radiusEarth,
						}),
					)
				}
			/>
			<SystemSlider
				label={I18N.t("Planet radius")}
				help={GCM_INPUT_HELP.radiusEarth}
				value={config.radiusEarth}
				display={formatWithUnit(config.radiusEarth, "R⊕", 2)}
				min={MIN_RADIUS_EARTH}
				max={MAX_RADIUS_EARTH}
				step={0.01}
				scale="linear"
				disabled={structural}
				onChange={(radiusEarth) =>
					onChange(
						GCM_SYSTEM.withPlanet({
							config,
							massEarth,
							radiusEarth,
						}),
					)
				}
			/>
			<SystemSlider
				label={I18N.t("Axial tilt")}
				help={GCM_INPUT_HELP.obliquityDeg}
				value={config.obliquityDeg}
				display={formatWithUnit(config.obliquityDeg, "°", 1)}
				min={0}
				max={90}
				step={0.5}
				scale="linear"
				disabled={disabled}
				onChange={(obliquityDeg) => onChange({ ...config, obliquityDeg })}
			/>
			<div className="space-y-1">
				{GCM_SYSTEM_VIEW.planetRows({ summary }).map((row) => (
					<LabeledValueRow
						key={row.label}
						size="md"
						label={row.label}
						value={row.value}
					/>
				))}
			</div>
			<p className={uiTokens.field.note}>
				{I18N.t(
					"Gravity follows from mass and radius; the model receives that value. The globe shows the rotation axis at the chosen tilt. Interior structure, core temperature and core pressure are estimates for a differentiated rocky or icy body.",
				)}
			</p>
			<TerrainPanel
				hasTerrain={hasTerrain}
				latitudes={latitudes}
				disabled={structural}
				unitSystem={unitSystem}
				starPoints={starPoints}
				zoneCircles={zoneCircles}
				onChange={onTerrainChange}
			/>
		</div>
	)
}
