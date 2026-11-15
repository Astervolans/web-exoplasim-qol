import { useCallback, useMemo, useRef, useState } from "react"
import { GCM } from "@/model/climate/gcm"
import { GCM_AVERAGES } from "@/model/climate/gcm/averages"
import { GCM_CLASSIFICATION } from "@/model/climate/gcm/classification"
import { GCM_DOWNSCALE } from "@/model/climate/gcm/downscale"
import { GCM_FIELDS } from "@/model/climate/gcm/fields"
import type { GcmLevel, GcmMapMode } from "@/model/climate/gcm/fields/types"
import { GCM_GRID } from "@/model/climate/gcm/grid"
import { GCM_TERRAIN } from "@/model/climate/gcm/terrain"
import { GCM_TERRAIN_ORIENTATION } from "@/model/climate/gcm/terrain/orientation"
import { PanelHeader } from "@/ui/components/composites/PanelHeader"
import { cx } from "@/ui/components/lib"
import { Button } from "@/ui/components/primitives/Button"
import { ContinuousLegend } from "@/ui/components/primitives/charts/ContinuousLegend"
import { IconButton } from "@/ui/components/primitives/IconButton"
import { DetailsIcon } from "@/ui/components/primitives/icons/DetailsIcon"
import { LabeledValueRow } from "@/ui/components/primitives/LabeledValueRow"
import { LanguageToggle } from "@/ui/components/primitives/LanguageToggle"
import { SegmentedControl } from "@/ui/components/primitives/SegmentedControl"
import { TextSizeToggle } from "@/ui/components/primitives/TextSizeToggle"
import { Tooltip } from "@/ui/components/primitives/Tooltip"
import { uiTokens } from "@/ui/components/tokens"
import { GCM_BALANCE_VIEW } from "@/ui/gcm/balance-view"
import { GCM_DISPLAY } from "@/ui/gcm/field-display"
import { GcmClimateLegend } from "@/ui/gcm/GcmClimateLegend"
import { GcmConfigPanel } from "@/ui/gcm/GcmConfigPanel"
import { GcmHoverReadout } from "@/ui/gcm/GcmHoverReadout"
import { GcmMap } from "@/ui/gcm/GcmMap"
import type { GcmHoverMonthLayer, GcmHoverPoint } from "@/ui/gcm/hover/types"
import { GCM_LIVE } from "@/ui/gcm/live-store"
import { GCM_MODE_GROUPS } from "@/ui/gcm/map-mode-options"
import { GCM_PERIOD_VIEW } from "@/ui/gcm/period-view"
import { GCM_STAR_POINTS } from "@/ui/gcm/star-points"
import { GCM_TARGETING_VIEW } from "@/ui/gcm/targeting-view"
import type {
	GcmMapDetail,
	GcmMapLayer,
	GcmPeriod,
	GcmViewMode,
} from "@/ui/gcm/types"
import { useGcmClimate } from "@/ui/gcm/useGcmClimate"
import { useGcmRun } from "@/ui/gcm/useGcmRun"
import { GCM_ZONE_CIRCLES } from "@/ui/gcm/zone-circles"
import { rgbToCss, type UnitSystem } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

const UNIT_OPTIONS = [
	{ value: "metric", label: "Metric" },
	{ value: "imperial", label: "Imperial" },
] as const
const SUMMARY_MODES: ReadonlyArray<GcmMapMode> = [
	"airTemperature",
	"precipitation",
	"cloudCover",
	"seaIce",
	"outgoingLongwave",
]

const DETAIL_OPTIONS = [
	{ value: "model", label: "Model grid" },
	{ value: "downscaled", label: "Downscaled" },
] as const
const LAPSE_CORRECTED_MODES: ReadonlyArray<GcmMapMode> = [
	"surfaceTemperature",
	"airTemperature",
]
const PERIOD_OPTIONS = [
	{ value: "now", label: "Now" },
	{ value: "month", label: "Monthly" },
	{ value: "year", label: "Annual" },
] as const

const FAILED_PREFIX = "Climate analysis failed: "

function statusText(message: string): string {
	if (message.startsWith(FAILED_PREFIX)) {
		return I18N.t("Climate analysis failed: {detail}", {
			detail: message.slice(FAILED_PREFIX.length),
		})
	}
	return I18N.t(message)
}

export function GcmView() {
	const gcm = useGcmRun()
	const [requestedView, setView] = useState<GcmViewMode>("airTemperature")
	const supportedView: GcmViewMode =
		(!gcm.config.stormclim && GCM_FIELDS.stormMode(requestedView)) ||
		(gcm.engine === "gpu" &&
			requestedView !== "elevation" &&
			requestedView !== "koppen" &&
			requestedView !== "pasta" &&
			!GCM_FIELDS.gpuSupports(requestedView))
			? "surfaceTemperature"
			: requestedView
	const requestedLayer = GCM_FIELDS.layer(supportedView)
	const view =
		requestedLayer && requestedLayer.level > gcm.config.layers
			? GCM_FIELDS.layerMode({ ...requestedLayer, level: gcm.config.layers })
			: supportedView
	const levelOptions = GCM_FIELDS.levels(gcm.config.layers).map((level) => ({
		value: String(level),
		label:
			level === 1
				? I18N.t("{level} · top", { level })
				: level === gcm.config.layers
					? I18N.t("{level} · bottom", { level })
					: String(level),
	}))
	const [period, setPeriod] = useState<GcmPeriod>("now")
	const [monthIndex, setMonthIndex] = useState<number | null>(null)
	const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric")
	I18N.useLanguage()
	const [detail, setDetail] = useState<GcmMapDetail>("model")
	const [showStarPoints, setShowStarPoints] = useState(false)
	const [showZoneCircles, setShowZoneCircles] = useState(false)
	const [hover, setHover] = useState<GcmHoverPoint | null>(null)
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const atmosphere = GCM_FIELDS.layer(view)
	const groupView = atmosphere
		? GCM_FIELDS.layerMode({ ...atmosphere, level: 10 })
		: view
	const modeGroups = GCM_MODE_GROUPS.groups()
	const modeGroup = modeGroups.find(
		(group) =>
			group.defaultView === groupView ||
			group.children.some((child) => child.value === groupView),
	)
	const terrainView = view === "elevation"
	const climateView = view === "koppen" || view === "pasta"
	const scheme = view === "pasta" ? "pasta" : "koppen"
	const climateDefinition = GCM_CLASSIFICATION.definition(scheme)
	const mode: GcmMapMode =
		climateView || terrainView ? "surfaceTemperature" : view
	const definition = GCM_FIELDS.definition(mode)
	const terrainSummary = useMemo(
		() => (gcm.displayTerrain ? GCM_TERRAIN.summary(gcm.displayTerrain) : null),
		[gcm.displayTerrain],
	)
	const { status } = gcm.state
	const active =
		status === "loading" ||
		status === "running" ||
		status === "paused" ||
		status === "checkpointing"
	const checkpointFile = useRef<HTMLInputElement>(null)
	const { averages, snapshot: latest } = GCM_LIVE.useLive(gcm.live)
	const climate = averages[scheme]
	const selection = GCM_PERIOD_VIEW.select({
		period: climateView ? "year" : period,
		monthIndex,
		snapshot: latest,
		averages,
	})
	const { snapshot } = selection
	const { downscale } = gcm
	const downscaled = detail === "downscaled" && downscale
	const orientation =
		gcm.terrain?.orientation ?? GCM_TERRAIN_ORIENTATION.DEFAULT
	const starPoints = useMemo(
		() =>
			showStarPoints && gcm.config.synchronous
				? GCM_STAR_POINTS.model({
						obliquityDeg: gcm.config.obliquityDeg,
						substellarLongitudeDeg: gcm.config.substellarLongitudeDeg,
						periapseLongitudeDeg:
							gcm.config.periapseLongitudeDeg ?? GCM.PERIAPSE_LONGITUDE_DEG,
						keplerian: gcm.config.keplerian,
					})
				: [],
		[
			showStarPoints,
			gcm.config.synchronous,
			gcm.config.obliquityDeg,
			gcm.config.substellarLongitudeDeg,
			gcm.config.periapseLongitudeDeg,
			gcm.config.keplerian,
		],
	)
	const displayStarPoints = useMemo(
		() => GCM_STAR_POINTS.display({ points: starPoints, orientation }),
		[starPoints, orientation],
	)
	const readStarPoints = useCallback(
		() => displayStarPoints,
		[displayStarPoints],
	)
	const zoneCircles = useMemo(
		() =>
			showZoneCircles && !gcm.config.synchronous
				? GCM_ZONE_CIRCLES.model({
						obliquityDeg: gcm.config.obliquityDeg,
					})
				: [],
		[showZoneCircles, gcm.config.synchronous, gcm.config.obliquityDeg],
	)
	const displayZoneCircles = useMemo(
		() => GCM_ZONE_CIRCLES.display({ circles: zoneCircles, orientation }),
		[zoneCircles, orientation],
	)
	const readZoneCircles = useCallback(
		() => displayZoneCircles,
		[displayZoneCircles],
	)
	const climateMap = useGcmClimate({
		config: gcm.config,
		scheme,
		downscale: downscaled && climateView ? downscaled : null,
		months: averages.climateMonths,
	})
	const downscaledClimate = climateMap.classes
	const layer = useMemo<GcmMapLayer | null>(() => {
		if (terrainView)
			return gcm.displayTerrain
				? {
						kind: "terrain",
						terrain: gcm.displayTerrain,
						maxElevationM: terrainSummary?.maxM ?? 1,
					}
				: null
		if (!snapshot) return null
		if (climateView) {
			if (downscaled && downscaledClimate) {
				return {
					kind: "downscaled-classes",
					scheme,
					width: downscaled.width,
					height: downscaled.height,
					classes: downscaledClimate,
					orientation,
				}
			}
			return climate
				? { kind: "classes", snapshot, classes: climate, scheme, orientation }
				: null
		}
		if (!downscaled) return { kind: "field", snapshot, mode, orientation }
		const values = GCM_FIELDS.values({ snapshot, mode })
		return {
			kind: "downscaled-field",
			snapshot,
			mode,
			width: downscaled.width,
			height: downscaled.height,
			values: LAPSE_CORRECTED_MODES.includes(mode)
				? GCM_DOWNSCALE.temperature({ downscale: downscaled, values })
				: GCM_DOWNSCALE.interpolate({ downscale: downscaled, values }),
			orientation,
		}
	}, [
		snapshot,
		climateView,
		scheme,
		mode,
		terrainView,
		gcm.displayTerrain,
		climate,
		downscaled,
		downscaledClimate,
		terrainSummary?.maxM,
		orientation,
	])
	// React's development profiler traverses arrays in changed props on both
	// entry and exit. Keep raster data behind a reader at component boundaries.
	const readLayer = useCallback(() => layer, [layer])
	const readCoastlines = useCallback(() => gcm.coastlines, [gcm.coastlines])
	const calendarMonths = useMemo(
		() =>
			averages.months
				.map((month, index) => ({ month, index }))
				.toSorted((a, b) => a.month.month - b.month.month),
		[averages.months],
	)
	const hovering = hover !== null
	const monthlyLayers = useMemo<GcmHoverMonthLayer[]>(() => {
		if (!hovering || terrainView || climateView) return []
		return calendarMonths.map(({ month: { month, year, snapshot } }) => {
			if (!downscaled)
				return {
					month,
					year,
					layer: { kind: "field", snapshot, mode, orientation },
				}
			const values = GCM_FIELDS.values({ snapshot, mode })
			return {
				month,
				year,
				layer: {
					kind: "downscaled-field",
					snapshot,
					mode,
					width: downscaled.width,
					height: downscaled.height,
					values: LAPSE_CORRECTED_MODES.includes(mode)
						? GCM_DOWNSCALE.temperature({ downscale: downscaled, values })
						: GCM_DOWNSCALE.interpolate({ downscale: downscaled, values }),
					orientation,
				},
			}
		})
	}, [
		terrainView,
		climateView,
		calendarMonths,
		downscaled,
		mode,
		hovering,
		orientation,
	])
	const readMonths = useCallback(() => monthlyLayers, [monthlyLayers])
	const readClasses = useCallback(
		() => downscaledClimate ?? climate,
		[downscaledClimate, climate],
	)
	const balance = GCM_BALANCE_VIEW.rows({
		averages,
		targeting: gcm.targeting,
	})
	const means = useMemo(
		() =>
			snapshot
				? SUMMARY_MODES.map((summary) => ({
						mode: summary,
						value: GCM_GRID.globalMean(
							GCM_FIELDS.values({ snapshot, mode: summary }),
						),
					}))
				: [],
		[snapshot],
	)

	return (
		<div
			className={cx(
				"flex h-full w-full overflow-hidden",
				uiTokens.surface.canvas,
			)}
		>
			<main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
				<header className="flex flex-wrap items-start justify-between gap-2">
					<div>
						<h1 className={cx(uiTokens.type.title, uiTokens.text.primary)}>
							ExoPlaSim · Web
						</h1>
						<p className={cx(uiTokens.type.label, uiTokens.text.muted)}>
							{gcm.state.truncation > 0 ? `T${gcm.state.truncation} ` : ""}
							{I18N.t("general circulation model running in your browser")}
						</p>
					</div>
					<div className="relative flex flex-col items-end gap-1 text-right">
						<div className="flex items-center gap-1">
							<LanguageToggle />
							<TextSizeToggle />
						</div>
						<div className={cx(uiTokens.type.value, uiTokens.text.primary)}>
							{climateView && climate
								? averages.climateYears < GCM_AVERAGES.CLIMATE_YEARS
									? I18N.t(
											"{label} · {years}-year monthly climatology (building to 10 years)",
											{
												label: climateDefinition.label,
												years: averages.climateYears,
											},
										)
									: I18N.t("{label} · {years}-year monthly climatology", {
											label: climateDefinition.label,
											years: averages.climateYears,
										})
								: terrainView
									? I18N.t("Terrain elevation")
									: selection.label}
						</div>
						<GcmHoverReadout
							point={hover}
							readLayer={readLayer}
							readMonths={readMonths}
							unitSystem={unitSystem}
						/>
					</div>
				</header>
				<div className="flex flex-wrap gap-1">
					{modeGroups
						.filter(
							(group) =>
								gcm.config.stormclim ||
								!GCM_FIELDS.stormMode(group.defaultView),
						)
						.map((group) => (
							<Button
								key={group.defaultView}
								selected={group === modeGroup}
								disabled={group.defaultView === "koppen" && !averages.koppen}
								title={
									group.defaultView === "koppen"
										? averages.koppen
											? I18N.t(
													"Climate classes averaged over {years} complete years (up to 10)",
													{ years: averages.climateYears },
												)
											: I18N.t("Available after the first complete model year")
										: group.label
								}
								onClick={() => setView(group.defaultView)}
							>
								{group.label}
							</Button>
						))}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{!terrainView && (
						<SegmentedControl
							options={PERIOD_OPTIONS.map((option) => ({
								...option,
								label: I18N.t(option.label),
							}))}
							value={climateView ? "year" : period}
							onChange={(next) => {
								setPeriod(next)
								if (climateView) setView("airTemperature")
							}}
						/>
					)}
					{!terrainView && (
						<SegmentedControl
							options={DETAIL_OPTIONS.map((option) => ({
								...option,
								label: I18N.t(option.label),
							}))}
							value={detail}
							onChange={setDetail}
						/>
					)}
					{modeGroup && modeGroup.children.length > 0 && (
						<div className={cx("flex border-l pl-2", uiTokens.border.default)}>
							<SegmentedControl
								options={modeGroup.children.filter(
									(child) =>
										gcm.engine !== "gpu" ||
										child.value === "elevation" ||
										child.value === "koppen" ||
										child.value === "pasta" ||
										GCM_FIELDS.gpuSupports(child.value),
								)}
								value={groupView}
								onChange={setView}
							/>
						</div>
					)}
					{atmosphere && (
						<div className="flex items-center gap-2">
							<span className={uiTokens.type.label}>
								{I18N.t("Model layer")}
							</span>
							<SegmentedControl
								options={levelOptions}
								value={String(atmosphere.level)}
								onChange={(value) =>
									setView(
										GCM_FIELDS.layerMode({
											variable: atmosphere.variable,
											level: Number(value) as GcmLevel,
										}),
									)
								}
							/>
						</div>
					)}
					{!terrainView && period === "month" && !climateView && (
						<div className="flex flex-wrap gap-1">
							{calendarMonths.map(({ month, index }) => (
								<Button
									key={`${month.year}-${month.month}`}
									size="sm"
									selected={
										index === (monthIndex ?? averages.months.length - 1)
									}
									onClick={() =>
										setMonthIndex(
											index === averages.months.length - 1 ? null : index,
										)
									}
								>
									{GCM_PERIOD_VIEW.monthName(month.month)}
								</Button>
							))}
						</div>
					)}
				</div>
				<div className="relative min-h-0 flex-1">
					{climateView && (climateMap.pending || climateMap.error) && (
						<p role="status" className={uiTokens.field.note}>
							{climateMap.error ?? I18N.t("Updating climate map…")}
						</p>
					)}
					<GcmMap
						loading={status === "loading" || (status === "running" && !latest)}
						onHover={setHover}
						readLayer={readLayer}
						readCoastlines={readCoastlines}
						readStarPoints={readStarPoints}
						readZoneCircles={readZoneCircles}
						emptyMessage={
							terrainView
								? I18N.t("Import terrain in the settings panel to view it")
								: active && period === "now"
									? statusText(gcm.state.message)
									: selection.emptyMessage
						}
					/>
					{!sidebarOpen && (
						<div className="absolute top-3 right-3 z-20">
							<Tooltip
								content={I18N.t("Show settings panel")}
								position="bottom"
								align="end"
							>
								<IconButton
									tone="overlay"
									size="sm"
									aria-label={I18N.t("Show settings panel")}
									aria-expanded={false}
									aria-controls="gcm-sidebar"
									onClick={() => setSidebarOpen(true)}
								>
									<DetailsIcon className="h-4 w-4 text-white" />
								</IconButton>
							</Tooltip>
						</div>
					)}
				</div>
				{terrainView ? (
					gcm.displayTerrain && terrainSummary ? (
						<ContinuousLegend
							min={0}
							max={terrainSummary.maxM}
							title={I18N.t("Elevation")}
							steps={24}
							colorForValue={(value) =>
								rgbToCss(
									GCM_DISPLAY.terrainColor({
										value,
										min: 0,
										max: terrainSummary.maxM,
										land: 1,
									}),
								)
							}
							formatValue={(value) => `${Math.round(value).toLocaleString()} m`}
						/>
					) : null
				) : climateView && climate ? (
					<GcmClimateLegend readClasses={readClasses} scheme={scheme} />
				) : (
					<ContinuousLegend
						min={definition.min}
						max={definition.max}
						title={GCM_DISPLAY.label(mode)}
						steps={24}
						colorForValue={(value) =>
							rgbToCss(GCM_DISPLAY.color({ mode, value }))
						}
						formatValue={(value) =>
							GCM_DISPLAY.format({ mode, value, unitSystem })
						}
					/>
				)}
			</main>
			<aside
				id="gcm-sidebar"
				hidden={!sidebarOpen}
				className={cx(
					sidebarOpen
						? "flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4"
						: "hidden",
					uiTokens.border.default,
					uiTokens.surface.panel,
				)}
			>
				<section>
					<PanelHeader
						title={I18N.t("Run")}
						action={
							<IconButton
								tone="borderless"
								size="xs"
								title={I18N.t("Hide settings panel")}
								aria-label={I18N.t("Hide settings panel")}
								aria-expanded={true}
								aria-controls="gcm-sidebar"
								onClick={() => setSidebarOpen(false)}
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									aria-hidden="true"
								>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</IconButton>
						}
					/>
					<div className="flex flex-wrap gap-2">
						{active ? (
							status === "paused" ? (
								<Button onClick={gcm.resume}>{I18N.t("Resume")}</Button>
							) : (
								<Button onClick={gcm.pause} disabled={status !== "running"}>
									{I18N.t("Pause")}
								</Button>
							)
						) : (
							<Button selected onClick={() => void gcm.start()}>
								{I18N.t("Start")}
							</Button>
						)}
						<Button
							onClick={gcm.save}
							disabled={status !== "running" && status !== "paused"}
							title={I18N.t(
								"Save the model state and climate averages to a file, preserving the current pause state",
							)}
						>
							{I18N.t("Save")}
						</Button>
						<Button onClick={() => checkpointFile.current?.click()}>
							{I18N.t("Load")}
						</Button>
						<Button
							onClick={() => {
								gcm.clear()
								setPeriod("now")
								setMonthIndex(null)
								setView("airTemperature")
								setHover(null)
							}}
							disabled={status === "idle" && !latest}
							title={I18N.t(
								"Stops the run and clears results so settings can be changed",
							)}
						>
							{I18N.t("Clear")}
						</Button>
						<input
							ref={checkpointFile}
							type="file"
							accept=".ckpt"
							className="hidden"
							onChange={(event) => {
								const file = event.target.files?.[0]
								event.target.value = ""
								if (file) void gcm.load(file)
							}}
						/>
					</div>
					<div className="mt-3 space-y-1">
						<LabeledValueRow
							label={I18N.t("Status")}
							value={statusText(gcm.state.message).split("\n")[0]}
						/>
						{gcm.state.device && (
							<LabeledValueRow
								label={gcm.engine === "gpu" ? "GPU" : I18N.t("Workers")}
								value={gcm.state.device}
							/>
						)}
						{gcm.state.stepsPerSecond > 0 && (
							<LabeledValueRow
								label={I18N.t("Speed")}
								value={I18N.t("{speed} model days/s", {
									speed: (
										(gcm.state.stepsPerSecond * gcm.config.timestepMinutes) /
										1440
									).toFixed(2),
								})}
							/>
						)}
						{latest &&
							balance.map((row) => (
								<LabeledValueRow
									key={row.label}
									label={row.label}
									value={row.value}
								/>
							))}
					</div>
					{gcm.targeting && (
						<div
							className="mt-3 space-y-1"
							aria-label={I18N.t("Temperature targeting progress")}
							aria-live="polite"
						>
							{GCM_TARGETING_VIEW.rows({
								state: gcm.targeting,
								targetK: gcm.config.targetTemperatureK,
								unitSystem,
							}).map((row) => (
								<LabeledValueRow
									key={row.label}
									label={row.label}
									value={row.value}
								/>
							))}
							<p className={uiTokens.field.note}>{gcm.targeting.message}</p>
						</div>
					)}
					{status === "failed" && (
						<pre
							className={cx(
								"mt-2 max-h-40 overflow-auto whitespace-pre-wrap",
								uiTokens.type.valueSm,
								uiTokens.text.muted,
							)}
						>
							{statusText(gcm.state.message)}
						</pre>
					)}
				</section>
				<section>
					<PanelHeader
						title={
							period === "now" || climateView
								? I18N.t("Global means")
								: period === "month"
									? I18N.t("Global means · monthly")
									: I18N.t("Global means · annual")
						}
						action={
							<SegmentedControl
								size="xs"
								options={UNIT_OPTIONS.map((option) => ({
									...option,
									label: I18N.t(option.label),
								}))}
								value={unitSystem}
								onChange={setUnitSystem}
							/>
						}
					/>
					<div className="space-y-1">
						{means.length === 0 && (
							<p className={uiTokens.field.note}>
								{I18N.t("Appears once the model is running")}
							</p>
						)}
						{means.map((entry) => (
							<LabeledValueRow
								key={entry.mode}
								label={GCM_DISPLAY.label(entry.mode)}
								value={GCM_DISPLAY.format({
									mode: entry.mode,
									value: entry.value,
									unitSystem,
								})}
							/>
						))}
					</div>
				</section>
				<section>
					<PanelHeader title={I18N.t("Settings")} />
					{active && (
						<p className={cx("-mt-2 mb-3", uiTokens.field.note)}>
							{I18N.t(
								"Pause to edit climate settings, then resume to apply them. Model and structural settings stay locked until you clear the run.",
							)}
						</p>
					)}
					<GcmConfigPanel
						config={gcm.config}
						hasTerrain={gcm.terrain !== null}
						latitudes={
							gcm.resolutions.find(
								(entry) =>
									entry.truncation === gcm.config.truncation &&
									entry.layers === gcm.config.layers,
							)?.latitudes ?? 32
						}
						unitSystem={unitSystem}
						resolutions={gcm.resolutions}
						maxElevationKm={terrainSummary ? terrainSummary.maxM / 1000 : 8.849}
						engine={gcm.engine}
						gpuAvailable={gcm.gpuAvailable}
						onEngineChange={gcm.setEngine}
						workerChoice={gcm.workerChoice}
						workerOptions={gcm.workerOptions}
						onWorkerChange={gcm.setWorkerChoice}
						locked={gcm.locked}
						disabled={gcm.locked && status !== "paused"}
						onChange={gcm.setConfig}
						onTerrainChange={gcm.setTerrain}
						showStarPoints={showStarPoints}
						onShowStarPointsChange={setShowStarPoints}
						starPoints={starPoints}
						showZoneCircles={showZoneCircles}
						onShowZoneCirclesChange={setShowZoneCircles}
						zoneCircles={zoneCircles}
					/>
				</section>
			</aside>
		</div>
	)
}
