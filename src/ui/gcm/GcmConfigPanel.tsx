import type { ReactNode } from "react"
import { useState } from "react"
import { GCM_CONTINUATION } from "@/model/climate/gcm/continuation"
import { GCM_SYSTEM } from "@/model/climate/gcm/system"
import type {
	GcmConfig,
	GcmLayerCount,
	GcmTruncation,
	GcmVegetation,
} from "@/model/climate/gcm/types"
import { CollapsibleSection } from "@/ui/components/composites/CollapsibleSection"
import { cx } from "@/ui/components/lib"
import { InputLabel } from "@/ui/components/primitives/InputLabel"
import { LabeledSlider } from "@/ui/components/primitives/LabeledSlider"
import { SegmentedControl } from "@/ui/components/primitives/SegmentedControl"
import { Swatch } from "@/ui/components/primitives/Swatch"
import { ToggleRow } from "@/ui/components/primitives/ToggleRow"
import { uiPalette, uiTokens } from "@/ui/components/tokens"
import { GcmAdvancedPanel } from "@/ui/gcm/GcmAdvancedPanel"
import { GCM_INPUT_HELP } from "@/ui/gcm/input-help"
import { GCM_SETTINGS_SECTIONS } from "@/ui/gcm/settings-sections"
import type {
	GcmSectionSpec,
	GcmSettingsMode,
	GcmSettingsSection,
} from "@/ui/gcm/settings-sections/types"
import { AtmospherePanel } from "@/ui/gcm/system/AtmospherePanel"
import { OrbitPanel } from "@/ui/gcm/system/OrbitPanel"
import { PlanetPanel } from "@/ui/gcm/system/PlanetPanel"
import { StarPanel } from "@/ui/gcm/system/StarPanel"
import type {
	GcmConfigPanelProps,
	GcmFilterToggle,
	GcmSliderSpec,
	GcmSmoothingFilter,
} from "@/ui/gcm/types"
import { formatWithUnit } from "@/ui/genesis/shared/ui-format"

const BYTES_PER_MEGABYTE = 1_000_000
const SOIL_DEPTH_SLIDER: GcmSliderSpec = {
	key: "soilDepthScale",
	label: "Soil depth multiplier",
	min: 0.1,
	max: 5,
	step: 0.1,
	unit: "×",
	digits: 1,
}
const OCEAN_DEPTH_SLIDER: GcmSliderSpec = {
	key: "oceanDepthM",
	label: "Ocean mixed-layer depth",
	min: 1,
	max: 200,
	step: 1,
	unit: "m",
	digits: 0,
}
const GROWTH_SLIDER: GcmSliderSpec = {
	key: "initialGrowth",
	label: "Initial growth",
	min: 0,
	max: 1,
	step: 0.05,
	unit: "",
	digits: 2,
}
const SMOOTHING_FILTERS: ReadonlyArray<GcmSmoothingFilter> = [
	"none",
	"cesaro",
	"exp",
	"lh",
]
const VEGETATION_OPTIONS = [
	{ value: "0", label: "Off" },
	{ value: "1", label: "Diagnostic" },
	{ value: "2", label: "Coupled" },
] as const
const SMOOTHING_OPTIONS = [
	{ value: "none", label: "None" },
	{ value: "cesaro", label: "Cesàro" },
	{ value: "exp", label: "Exp" },
	{ value: "lh", label: "L-H" },
] as const
const TIMESTEP_OPTIONS = [
	{ value: "5", label: "5" },
	{ value: "10", label: "10" },
	{ value: "15", label: "15" },
	{ value: "20", label: "20" },
	{ value: "30", label: "30" },
	{ value: "45", label: "45" },
] as const

const SECTIONS: ReadonlyArray<GcmSectionSpec> = [
	{ section: "model", title: "Model", defaultOpen: true },
	{ section: "star", title: "Star", defaultOpen: true },
	{ section: "orbit", title: "Orbit & rotation", defaultOpen: true },
	{ section: "planet", title: "Planet", defaultOpen: true },
	{ section: "atmosphere", title: "Atmosphere", defaultOpen: false },
	{ section: "surface", title: "Surface & vegetation", defaultOpen: true },
]

function isSmoothing(filter: string): filter is GcmSmoothingFilter {
	return (SMOOTHING_FILTERS as ReadonlyArray<string>).includes(filter)
}

export function GcmConfigPanel({
	locked,
	config,
	hasTerrain,
	latitudes,
	maxElevationKm,
	unitSystem,
	resolutions,
	engine,
	gpuAvailable,
	onEngineChange,
	workerChoice,
	workerOptions,
	onWorkerChange,
	disabled,
	onChange,
	onTerrainChange,
	showStarPoints,
	onShowStarPointsChange,
	starPoints,
	showZoneCircles,
	onShowZoneCirclesChange,
	zoneCircles,
}: GcmConfigPanelProps) {
	const [mode, setMode] = useState<GcmSettingsMode>("standard")
	const update = (patch: Partial<GcmConfig>) => {
		if (!disabled) onChange({ ...config, ...patch })
	}
	const smoothing = config.physicsFilter.find(isSmoothing) ?? "none"
	const toggleFilter = ({ filter, enabled }: GcmFilterToggle) =>
		update({
			physicsFilter: [
				...config.physicsFilter.filter((each) => each !== filter),
				...(enabled ? [filter] : []),
			],
		})
	const isDisabled = (key: keyof GcmConfig) =>
		disabled || (locked && !GCM_CONTINUATION.EDITABLE.includes(key))
	const renderSlider = (spec: GcmSliderSpec) => (
		<LabeledSlider
			key={spec.key}
			label={spec.label}
			help={GCM_INPUT_HELP[spec.key]}
			value={formatWithUnit(config[spec.key], spec.unit, spec.digits)}
			numericValue={config[spec.key]}
			min={spec.min}
			max={spec.max}
			step={spec.step}
			disabled={isDisabled(spec.key)}
			onChange={(value) => update({ [spec.key]: value })}
		/>
	)
	const summary = GCM_SYSTEM.summary({ config })
	const label = uiTokens.field.label
	const systemPanels = {
		config,
		summary,
		disabled,
		locked,
		onChange,
	}
	const overlayLegend = cx(
		"flex flex-wrap items-center gap-x-3 gap-y-1",
		uiTokens.field.note,
	)
	const overlayControls = config.synchronous ? (
		<>
			<ToggleRow
				label="Show sub-stellar and anti-stellar points"
				help={GCM_INPUT_HELP.showStarPoints}
				checked={showStarPoints}
				onChange={onShowStarPointsChange}
			/>
			{showStarPoints && (
				<div className={overlayLegend}>
					<span className="inline-flex items-center gap-1">
						<Swatch color={uiPalette.starPoint.substellar} shape="round" />
						Sub-stellar
					</span>
					<span className="inline-flex items-center gap-1">
						<Swatch color={uiPalette.starPoint.antistellar} shape="round" />
						Anti-stellar
					</span>
				</div>
			)}
		</>
	) : (
		<>
			<ToggleRow
				label="Show tropics and polar circles"
				help={GCM_INPUT_HELP.showZoneCircles}
				checked={showZoneCircles}
				onChange={onShowZoneCirclesChange}
			/>
			{showZoneCircles && (
				<div className={overlayLegend}>
					<span className="inline-flex items-center gap-1">
						<Swatch color={uiPalette.zoneCircle.tropic} shape="round" />
						Tropics
					</span>
					<span className="inline-flex items-center gap-1">
						<Swatch color={uiPalette.zoneCircle.polar} shape="round" />
						Polar circles
					</span>
				</div>
			)}
		</>
	)
	const contents: Record<GcmSettingsSection, ReactNode> = {
		model: (
			<>
				<div className="space-y-1">
					<span className={label}>Engine</span>
					<SegmentedControl
						fullWidth
						options={[
							{
								value: "gpu",
								label: "GPU",
								disabled: gpuAvailable === false,
								title:
									gpuAvailable === false
										? "This browser has no WebGPU"
										: "The WebGPU port of ExoPlaSim, on the graphics card",
							},
							{
								value: "cpu",
								label: "CPU",
								title: "ExoPlaSim compiled to WebAssembly, on CPU workers",
							},
						]}
						value={engine}
						onChange={(value) => {
							if (!disabled) onEngineChange(value)
						}}
					/>
				</div>
				{resolutions.length > 0 && (
					<div className="space-y-1">
						<span className={label}>
							<InputLabel label="Resolution" help={GCM_INPUT_HELP.truncation} />
						</span>
						<SegmentedControl
							fullWidth
							options={resolutions
								.filter(
									(resolution) =>
										resolution.layers === config.layers &&
										(engine !== "cpu" || resolution.truncation !== 63),
								)
								.map((resolution) => {
									const assets = resolution[engine]
									return {
										value: String(resolution.truncation),
										label: assets
											? `T${resolution.truncation} · ${formatWithUnit(assets.downloadBytes / BYTES_PER_MEGABYTE, "MB", 1)}`
											: `T${resolution.truncation}`,
										disabled: !assets,
										title: assets
											? undefined
											: `Not built for the ${engine.toUpperCase()} engine`,
									}
								})}
							value={String(config.truncation)}
							onChange={(value) =>
								update({ truncation: Number(value) as GcmTruncation })
							}
						/>
					</div>
				)}
				<fieldset className="space-y-1" aria-label="Atmospheric layers">
					<legend className={label}>
						<InputLabel
							label="Atmospheric layers"
							help={GCM_INPUT_HELP.layers}
						/>
					</legend>
					<SegmentedControl
						fullWidth
						options={[
							{ value: "5", label: "5 layers" },
							{ value: "10", label: "10 layers" },
						]}
						value={String(config.layers)}
						onChange={(value) =>
							update({ layers: Number(value) as GcmLayerCount })
						}
					/>
				</fieldset>
				{engine !== "gpu" && (
					<fieldset className="space-y-1" aria-label="Workers">
						<legend className={label}>
							<InputLabel label="Workers" help={GCM_INPUT_HELP.workers} />
						</legend>
						<SegmentedControl
							fullWidth
							options={workerOptions}
							value={workerChoice}
							onChange={onWorkerChange}
						/>
					</fieldset>
				)}
				<div className="space-y-1">
					<span className={label}>
						<InputLabel
							label="Timestep (minutes)"
							help={GCM_INPUT_HELP.timestepMinutes}
						/>
					</span>
					<SegmentedControl
						fullWidth
						options={TIMESTEP_OPTIONS}
						value={
							String(
								config.timestepMinutes,
							) as (typeof TIMESTEP_OPTIONS)[number]["value"]
						}
						onChange={(value) => update({ timestepMinutes: Number(value) })}
					/>
				</div>
				<div className="space-y-1">
					<span className={label}>
						<InputLabel
							label="Spectral filter"
							help={GCM_INPUT_HELP.physicsFilter}
						/>
					</span>
					<SegmentedControl
						fullWidth
						options={SMOOTHING_OPTIONS}
						value={smoothing}
						onChange={(value) =>
							update({
								physicsFilter: [
									...config.physicsFilter.filter(
										(filter) => !isSmoothing(filter),
									),
									value,
								],
							})
						}
					/>
				</div>
				<ToggleRow
					label="Filter gridpoint tendencies"
					help={GCM_INPUT_HELP.gridpointFilter}
					checked={config.physicsFilter.includes("gp")}
					disabled={disabled}
					onChange={(enabled) => toggleFilter({ filter: "gp", enabled })}
				/>
				<ToggleRow
					label="Filter spectral tendencies"
					help={GCM_INPUT_HELP.spectralFilter}
					checked={config.physicsFilter.includes("sp")}
					disabled={disabled}
					onChange={(enabled) => toggleFilter({ filter: "sp", enabled })}
				/>
				<ToggleRow
					label="Storm climatology"
					help={GCM_INPUT_HELP.stormclim}
					checked={config.stormclim}
					disabled={disabled}
					onChange={(stormclim) => update({ stormclim })}
				/>
			</>
		),
		star: <StarPanel {...systemPanels} />,
		orbit: <OrbitPanel {...systemPanels} />,
		planet: (
			<PlanetPanel
				{...systemPanels}
				hasTerrain={hasTerrain}
				latitudes={latitudes}
				unitSystem={unitSystem}
				starPoints={starPoints}
				zoneCircles={zoneCircles}
				onTerrainChange={onTerrainChange}
			/>
		),
		atmosphere: (
			<AtmospherePanel
				{...systemPanels}
				maxElevationKm={maxElevationKm}
				unitSystem={unitSystem}
			/>
		),
		surface: (
			<>
				{renderSlider(OCEAN_DEPTH_SLIDER)}
				<fieldset disabled={disabled || locked} className="space-y-1">
					<span className={label}>
						<InputLabel label="Vegetation" help={GCM_INPUT_HELP.vegetation} />
					</span>
					<SegmentedControl
						fullWidth
						options={VEGETATION_OPTIONS}
						value={
							String(
								config.vegetation,
							) as (typeof VEGETATION_OPTIONS)[number]["value"]
						}
						onChange={(value) =>
							update({ vegetation: Number(value) as GcmVegetation })
						}
					/>
				</fieldset>
				<ToggleRow
					label="Glaciers"
					help={GCM_INPUT_HELP.glaciers}
					checked={config.glaciers.enabled}
					disabled={disabled || locked}
					onChange={(enabled) =>
						update({ glaciers: { ...config.glaciers, enabled } })
					}
				/>
				{config.vegetation > 0 && renderSlider(GROWTH_SLIDER)}
				{renderSlider(SOIL_DEPTH_SLIDER)}
				<ToggleRow
					label="Wet soil"
					help={GCM_INPUT_HELP.wetSoil}
					checked={config.wetSoil}
					disabled={disabled}
					onChange={(wetSoil) => update({ wetSoil })}
				/>
			</>
		),
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<SegmentedControl
					fullWidth
					options={[
						{
							value: "standard",
							label: "Standard",
							title: "Illustrated star, orbit, planet and atmosphere panels",
						},
						{
							value: "advanced",
							label: "Advanced",
							title: "Direct control of every value ExoPlaSim receives",
						},
					]}
					value={mode}
					onChange={setMode}
				/>
				<p className={uiTokens.field.note}>
					{mode === "standard"
						? "Illustrated panels: stellar, orbital and interior values are derived, and the habitable zone and atmosphere readouts are estimates."
						: "Direct inputs: the values ExoPlaSim actually receives, without the derivations."}
				</p>
			</div>
			{SECTIONS.map(({ section, title, defaultOpen }) => (
				<CollapsibleSection
					key={section}
					title={title}
					defaultOpen={defaultOpen}
					modified={GCM_SETTINGS_SECTIONS.modified({ config, section, mode })}
					resetDisabled={
						disabled ||
						(locked && (section === "model" || section === "planet"))
					}
					onReset={() =>
						onChange(
							GCM_SYSTEM.refresh({
								config: GCM_SETTINGS_SECTIONS.reset({
									config,
									section,
									mode,
								}),
							}),
						)
					}
				>
					<fieldset disabled={disabled} className="min-w-0 space-y-3">
						{mode === "advanced" &&
						section !== "model" &&
						section !== "surface" ? (
							<GcmAdvancedPanel
								section={section}
								config={config}
								summary={summary}
								disabled={disabled}
								locked={locked}
								onChange={onChange}
								hasTerrain={hasTerrain}
								latitudes={latitudes}
								unitSystem={unitSystem}
								starPoints={starPoints}
								zoneCircles={zoneCircles}
								onTerrainChange={onTerrainChange}
							/>
						) : (
							contents[section]
						)}
						{section === "orbit" && overlayControls}
					</fieldset>
				</CollapsibleSection>
			))}
		</div>
	)
}
