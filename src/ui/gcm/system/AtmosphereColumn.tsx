import { uiPalette } from "@/ui/components/tokens"
import type { GcmAtmosphereColumnProps } from "@/ui/gcm/system/types"

const TICK_LADDER = [1, 2, 5, 10, 20, 50, 100, 200, 500] as const
const HEIGHT_EXPONENT = 0.55
const TEMPERATURE_FLOOR_K = 200
const TEMPERATURE_LADDER = [10, 20, 25, 50, 100, 200, 250, 500, 1000] as const
const AXIS = {
	temperatureTickY: 296,
	temperatureLabelY: 307,
	pressureLineY: 315,
	pressureLabelY: 326,
	captionY: 339,
	tickLength: 3,
	minimumLabelGap: 26,
} as const
const PLOT = {
	left: 36,
	right: 190,
	top: 40,
	bottom: 292,
	height: 252,
	curveLeft: 96,
	curveRight: 184,
} as const
const LABEL_X = 198
const LABEL_PITCH = 12
const SAMPLES = 60

function clampCurveX(value: number): number {
	if (!Number.isFinite(value)) return PLOT.curveLeft
	return Math.min(PLOT.curveRight, Math.max(PLOT.curveLeft, value))
}

function spacedTicks({
	values,
	xOf,
	minimumGap,
}: {
	values: ReadonlyArray<number>
	xOf: (value: number) => number
	minimumGap: number
}): ReadonlyArray<number> {
	const ordered = [...values].sort((left, right) => xOf(left) - xOf(right))
	const kept: number[] = []
	let previousX = Number.NEGATIVE_INFINITY
	for (const value of ordered) {
		const x = xOf(value)
		if (x - previousX < minimumGap) continue
		kept.push(value)
		previousX = x
	}
	return kept
}

function barLabel(value: number): string {
	if (value >= 0.01) return String(Number(value.toPrecision(2)))
	return value.toExponential(0)
}

export function AtmosphereColumn(props: GcmAtmosphereColumnProps) {
	const { profile } = props
	const maxAltitudeKm = Number.isFinite(profile.maxAltitudeKm)
		? Math.max(profile.maxAltitudeKm, 0)
		: 0
	const yMax = Math.max(maxAltitudeKm, 1)
	const yOf = (km: number): number => {
		const share = Math.min(Math.max(km / yMax, 0), 1) ** HEIGHT_EXPONENT
		return PLOT.bottom - share * PLOT.height
	}
	const surfaceK = Number.isFinite(props.surfaceTemperatureK)
		? props.surfaceTemperatureK
		: 200
	const surfacePressure =
		Number.isFinite(props.surfacePressureBar) && props.surfacePressureBar > 0
			? props.surfacePressureBar
			: 1
	const scaleHeight = Number.isFinite(props.scaleHeightKm)
		? Math.max(props.scaleHeightKm, 1e-6)
		: 1
	const logSurface = Math.log10(surfacePressure)
	const topPressure = surfacePressure * Math.exp(-yMax / scaleHeight)
	const logSpan = Math.log10(Math.max(topPressure, 1e-9)) - logSurface
	const pressureSpan = Number.isFinite(logSpan) && logSpan !== 0 ? logSpan : -1
	const temperaturePoints: Array<string> = []
	const pressurePoints: Array<string> = []
	const temperatureFloor = Math.min(TEMPERATURE_FLOOR_K, surfaceK)
	const temperatureCeiling = Math.max(TEMPERATURE_FLOOR_K, surfaceK)
	const xOfTemperature = (temperature: number): number =>
		clampCurveX(
			PLOT.curveLeft +
				(PLOT.curveRight - PLOT.curveLeft) *
					((temperature - temperatureFloor) /
						Math.max(temperatureCeiling - temperatureFloor, 1)),
		)
	const xOfPressure = (pressure: number): number =>
		clampCurveX(
			PLOT.curveLeft +
				(PLOT.curveRight - PLOT.curveLeft) *
					((Math.log10(Math.max(pressure, 1e-9)) - logSurface) / pressureSpan),
		)
	for (let index = 0; index <= SAMPLES; index++) {
		const km = (index / SAMPLES) * yMax
		const temperature = Math.max(surfaceK - profile.lapseRateKperKm * km, 210)
		const temperatureX = xOfTemperature(temperature)
		const pressure = surfacePressure * Math.exp(-km / scaleHeight)
		const pressureX = xOfPressure(pressure)
		const y = yOf(km).toFixed(1)
		temperaturePoints.push(`${temperatureX.toFixed(1)},${y}`)
		pressurePoints.push(`${pressureX.toFixed(1)},${y}`)
	}
	const temperatureSpan = temperatureCeiling - temperatureFloor
	const temperatureStep =
		TEMPERATURE_LADDER.find((candidate) => candidate >= temperatureSpan / 3) ??
		1000
	const temperatureTickValues: number[] = []
	const firstTemperatureTick =
		Math.ceil(temperatureFloor / temperatureStep) * temperatureStep
	for (
		let value = firstTemperatureTick;
		value <= temperatureCeiling;
		value += temperatureStep
	)
		temperatureTickValues.push(Math.round(value))
	for (const edge of [Math.round(surfaceK), Math.round(temperatureCeiling)]) {
		if (!temperatureTickValues.includes(edge)) temperatureTickValues.push(edge)
	}
	const temperatureTicks = spacedTicks({
		values: temperatureTickValues,
		xOf: xOfTemperature,
		minimumGap: AXIS.minimumLabelGap,
	})
	const pressureTickValues: number[] = []
	for (
		let exponent = Math.ceil(Math.log10(Math.max(topPressure, 1e-9)));
		exponent <= Math.floor(logSurface);
		exponent++
	)
		pressureTickValues.push(10 ** exponent)
	pressureTickValues.push(surfacePressure)
	const pressureTicks = spacedTicks({
		values: pressureTickValues,
		xOf: xOfPressure,
		minimumGap: AXIS.minimumLabelGap,
	})
	const ticks = [0, ...TICK_LADDER.filter((candidate) => candidate <= yMax)]
	const breathable = profile.breathable
	const breathableTopY = breathable ? yOf(breathable.topKm) : 0
	const breathableHeight = breathable
		? Math.max(0, yOf(breathable.bottomKm) - breathableTopY)
		: 0
	const cloudTopY = yOf(profile.cloud.topKm)
	const cloudHeight = Math.max(0, yOf(profile.cloud.bottomKm) - cloudTopY)
	const planes: Array<{ y: number; color: string; label: string }> = [
		{
			y: yOf(profile.tropopauseKm),
			color: uiPalette.atmosphere.tropopause,
			label: `Tropopause ${Math.round(profile.tropopauseKm)} km`,
		},
		{
			y: yOf(profile.emissionKm),
			color: uiPalette.atmosphere.emission,
			label: `IR emission ${Math.round(profile.emissionKm)} km`,
		},
		{
			y: yOf(profile.atmosphereTopKm),
			color: uiPalette.atmosphere.marker,
			label: `Top ${Math.round(profile.atmosphereTopKm)} km`,
		},
	]
	if (profile.armstrongKm !== null) {
		planes.push({
			y: yOf(profile.armstrongKm),
			color: uiPalette.atmosphere.armstrong,
			label: `Armstrong line ${Math.round(profile.armstrongKm)} km`,
		})
	}
	if (profile.hypoxiaKm !== null) {
		planes.push({
			y: yOf(profile.hypoxiaKm),
			color: uiPalette.atmosphere.hypoxia,
			label: `Hypoxia ${Math.round(profile.hypoxiaKm)} km`,
		})
	}
	const labelEntries: typeof planes = [...planes]
	if (breathable) {
		labelEntries.push({
			y: breathableTopY,
			color: uiPalette.atmosphere.breathable,
			label: `Breathable ${Math.round(breathable.bottomKm)}–${Math.round(breathable.topKm)} km`,
		})
	}
	labelEntries.sort((left, right) => left.y - right.y)
	const placed: typeof planes = []
	let previousY = Number.NEGATIVE_INFINITY
	for (const entry of labelEntries) {
		const y = Math.max(entry.y, 34, previousY + LABEL_PITCH)
		placed.push({ ...entry, y })
		previousY = y
	}
	const lastY = placed.length > 0 ? placed[placed.length - 1].y : 0
	const shift = lastY > PLOT.bottom + 4 ? lastY - (PLOT.bottom + 4) : 0
	const labels = placed.map((entry) => ({ ...entry, y: entry.y - shift }))
	const terrainBase = PLOT.bottom + 2
	const terrainPeak =
		terrainBase -
		yOf(
			Math.min(
				Number.isFinite(props.maxElevationKm)
					? Math.max(props.maxElevationKm, 0)
					: 0,
				yMax,
			),
		)
	const terrainPoints = [
		[PLOT.left, terrainBase],
		[58, terrainBase - terrainPeak * 0.45],
		[78, terrainBase - terrainPeak * 0.85],
		[108, terrainBase - terrainPeak * 0.55],
		[136, terrainBase - terrainPeak],
		[166, terrainBase - terrainPeak * 0.7],
		[PLOT.right, terrainBase],
	]
		.map(([x, y]) => `${x},${y.toFixed(1)}`)
		.join(" ")
	let badgeColor = "#475569"
	if (props.regimeLabel.includes("Runaway")) badgeColor = "#b91c1c"
	else if (
		props.regimeLabel.includes("Snowball") ||
		props.regimeLabel.includes("Vacuum")
	)
		badgeColor = "#0369a1"
	else if (props.regimeLabel.includes("Habitable")) badgeColor = "#15803d"

	return (
		<svg
			viewBox="0 0 320 344"
			className="h-auto w-full"
			role="img"
			aria-label="Atmospheric profile"
		>
			<title>Atmospheric profile</title>
			{breathable ? (
				<rect
					x={PLOT.left}
					y={breathableTopY}
					width={PLOT.right - PLOT.left}
					height={breathableHeight}
					fill={uiPalette.atmosphere.breathable}
					fillOpacity={0.12}
					stroke={uiPalette.atmosphere.breathable}
					strokeWidth={1}
					strokeDasharray="3 3"
				/>
			) : null}
			<rect
				x={PLOT.left}
				y={cloudTopY}
				width={PLOT.right - PLOT.left}
				height={cloudHeight}
				fill={uiPalette.atmosphere.cloud}
				fillOpacity={0.12}
				stroke={uiPalette.atmosphere.cloud}
				strokeOpacity={0.4}
				strokeWidth={1}
				strokeDasharray="3 3"
			/>
			<line
				x1={PLOT.left}
				y1={PLOT.top}
				x2={PLOT.left}
				y2={PLOT.bottom}
				stroke="rgba(15,23,42,0.2)"
				strokeWidth={1}
			/>
			{ticks.map((km) => (
				<g key={km}>
					<line
						x1={PLOT.left}
						y1={yOf(km)}
						x2={PLOT.right}
						y2={yOf(km)}
						stroke="rgba(15,23,42,0.08)"
						strokeWidth={1}
						strokeDasharray="2 3"
					/>
					<text
						x={PLOT.left - 5}
						y={yOf(km) + 3}
						textAnchor="end"
						className="fill-slate-400 text-[8px]"
					>
						{km}
					</text>
				</g>
			))}
			<text
				x={PLOT.left - 5}
				y={26}
				textAnchor="end"
				className="fill-slate-400 text-[8px]"
			>
				km
			</text>
			<polygon
				points={terrainPoints}
				fill={uiPalette.atmosphere.terrain}
				fillOpacity={0.35}
				stroke={uiPalette.atmosphere.terrain}
				strokeOpacity={0.75}
				strokeWidth={0.8}
			/>
			<polyline
				points={temperaturePoints.join(" ")}
				fill="none"
				stroke={uiPalette.atmosphere.temperature}
				strokeWidth={1.8}
			/>
			<polyline
				points={pressurePoints.join(" ")}
				fill="none"
				stroke={uiPalette.atmosphere.pressure}
				strokeWidth={1.4}
			/>
			{planes.map((entry) => (
				<line
					key={entry.color}
					x1={PLOT.left}
					y1={entry.y}
					x2={PLOT.right}
					y2={entry.y}
					stroke={entry.color}
					strokeWidth={1}
					strokeDasharray="3 3"
				/>
			))}
			<text
				x={PLOT.curveLeft + 12}
				y={PLOT.top + 10}
				textAnchor="end"
				className="text-[9px]"
				fill={uiPalette.atmosphere.temperature}
			>
				temperature K
			</text>
			<text
				x={PLOT.curveRight - 8}
				y={PLOT.top + 40}
				textAnchor="end"
				className="text-[9px]"
				fill={uiPalette.atmosphere.pressure}
			>
				pressure bar
			</text>
			<text
				x={PLOT.right}
				y={cloudTopY - 3}
				textAnchor="end"
				className="text-[9px]"
				fill={uiPalette.atmosphere.cloud}
			>
				{`Cloud ${Math.round(profile.cloud.bottomKm)}–${Math.round(profile.cloud.topKm)} km`}
			</text>
			{labels.map((entry) => (
				<text
					key={entry.label}
					x={LABEL_X}
					y={entry.y}
					textAnchor="start"
					className="text-[9px]"
					fill={entry.color}
				>
					{entry.label}
				</text>
			))}
			<line
				x1={PLOT.left}
				y1={PLOT.bottom}
				x2={PLOT.right}
				y2={PLOT.bottom}
				stroke="rgba(15,23,42,0.45)"
				strokeWidth={1.2}
			/>
			{temperatureTicks.map((value) => {
				const x = xOfTemperature(value)
				return (
					<g key={`temperature-${value}`}>
						<line
							x1={x}
							y1={AXIS.temperatureTickY}
							x2={x}
							y2={AXIS.temperatureTickY + AXIS.tickLength}
							stroke={uiPalette.atmosphere.temperature}
							strokeWidth={1}
						/>
						<text
							x={x}
							y={AXIS.temperatureLabelY}
							textAnchor="middle"
							className="text-[8px]"
							fill={uiPalette.atmosphere.temperature}
						>
							{Math.round(value)}
						</text>
					</g>
				)
			})}
			<line
				x1={xOfPressure(
					pressureTicks[pressureTicks.length - 1] ?? surfacePressure,
				)}
				y1={AXIS.pressureLineY}
				x2={xOfPressure(pressureTicks[0] ?? surfacePressure)}
				y2={AXIS.pressureLineY}
				stroke={uiPalette.atmosphere.pressure}
				strokeOpacity={0.35}
				strokeWidth={1}
			/>
			{pressureTicks.map((value) => {
				const x = xOfPressure(value)
				return (
					<g key={`pressure-${value}`}>
						<line
							x1={x}
							y1={AXIS.pressureLineY}
							x2={x}
							y2={AXIS.pressureLineY + AXIS.tickLength}
							stroke={uiPalette.atmosphere.pressure}
							strokeWidth={1}
						/>
						<text
							x={x}
							y={AXIS.pressureLabelY}
							textAnchor="middle"
							className="text-[8px]"
							fill={uiPalette.atmosphere.pressure}
						>
							{barLabel(value)}
						</text>
					</g>
				)
			})}
			<text
				x={PLOT.left}
				y={AXIS.captionY}
				className="fill-slate-400 text-[8px]"
			>
				height axis exaggerated near the surface
			</text>
			<text x={8} y={16} className="fill-slate-700 text-[10px] font-semibold">
				atmosphere // profile
			</text>
			<text
				x={312}
				y={16}
				textAnchor="end"
				className="text-[10px] font-semibold"
				fill={badgeColor}
			>
				{props.regimeLabel}
			</text>
		</svg>
	)
}
