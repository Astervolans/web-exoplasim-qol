import { useId } from "react"
import { uiPalette } from "@/ui/components/tokens"
import type { GcmInteriorDiagramProps } from "@/ui/gcm/system/types"
import { I18N } from "@/ui/i18n"

const CUTAWAY = { cx: 96, cy: 84, radius: 58 } as const
const PARALLELS = [-60, -30, 0, 30, 60]
const MERIDIANS = [30, 60, 90, 120, 150]
const SPHERE_SQUASH = 0.34
const KEY = {
	x: 172,
	labelX: 186,
	top: 26,
	pitch: 21,
	swatch: 9,
} as const

function arcPath({
	x,
	y,
	radius,
	degrees,
}: {
	x: number
	y: number
	radius: number
	degrees: number
}) {
	const radians = (degrees * Math.PI) / 180
	const endX = x + radius * Math.sin(radians)
	const endY = y - radius * Math.cos(radians)
	return `M ${x},${y - radius} A ${radius},${radius} 0 0 1 ${endX},${endY}`
}

export function InteriorDiagram(props: GcmInteriorDiagramProps) {
	const footer = I18N.t("Core {temperature} K · {pressure} GPa · estimated", {
		temperature: Math.round(props.coreTemperatureK),
		pressure: props.corePressureGPa.toFixed(0),
	})
	const clip = useId()
	const tilt = Math.min(Math.max(props.obliquityDeg, 0), 90)
	const tiltRadians = (tilt * Math.PI) / 180
	const axisReach = CUTAWAY.radius + 20
	const axisX = CUTAWAY.cx + axisReach * Math.sin(tiltRadians)
	const axisY = CUTAWAY.cy - axisReach * Math.cos(tiltRadians)
	const axisTailX = CUTAWAY.cx - (CUTAWAY.radius + 6) * Math.sin(tiltRadians)
	const axisTailY = CUTAWAY.cy + (CUTAWAY.radius + 6) * Math.cos(tiltRadians)
	const arcRadius = CUTAWAY.radius + 24
	return (
		<svg
			viewBox="0 0 320 168"
			className="h-auto w-full"
			role="img"
			aria-label={I18N.t(
				"Planet interior cutaway with its tilted rotation axis",
			)}
		>
			<title>
				{I18N.t("Planet interior cutaway with its tilted rotation axis")}
			</title>
			<defs>
				<clipPath id={clip}>
					<circle cx={CUTAWAY.cx} cy={CUTAWAY.cy} r={CUTAWAY.radius} />
					<rect
						x={CUTAWAY.cx}
						y={CUTAWAY.cy - CUTAWAY.radius}
						width={CUTAWAY.radius}
						height={CUTAWAY.radius * 2}
					/>
				</clipPath>
			</defs>
			<circle
				cx={CUTAWAY.cx}
				cy={CUTAWAY.cy}
				r={CUTAWAY.radius}
				fill="#f1f5f9"
			/>
			<g clipPath={`url(#${clip})`}>
				<g
					transform={`rotate(${tilt} ${CUTAWAY.cx} ${CUTAWAY.cy})`}
					fill="none"
					stroke="#94a3b8"
				>
					{PARALLELS.map((latitude) => {
						const radians = (latitude * Math.PI) / 180
						return (
							<ellipse
								key={`parallel-${latitude}`}
								cx={CUTAWAY.cx}
								cy={
									CUTAWAY.cy -
									CUTAWAY.radius * Math.sin(radians) * SPHERE_SQUASH
								}
								rx={CUTAWAY.radius * Math.cos(radians)}
								ry={CUTAWAY.radius * Math.cos(radians) * SPHERE_SQUASH}
								strokeOpacity={latitude === 0 ? 0.55 : 0.3}
								strokeWidth={0.9}
							/>
						)
					})}
					{MERIDIANS.map((longitude) => (
						<ellipse
							key={`meridian-${longitude}`}
							cx={CUTAWAY.cx}
							cy={CUTAWAY.cy}
							rx={CUTAWAY.radius * Math.sin((longitude * Math.PI) / 180)}
							ry={CUTAWAY.radius}
							strokeOpacity={0.3}
							strokeWidth={0.9}
						/>
					))}
				</g>
			</g>
			<line
				x1={CUTAWAY.cx}
				y1={CUTAWAY.cy - arcRadius}
				x2={CUTAWAY.cx}
				y2={CUTAWAY.cy + CUTAWAY.radius}
				stroke={uiPalette.celestial.axis}
				strokeWidth={1}
				strokeDasharray="3 3"
			/>
			<line
				x1={axisTailX}
				y1={axisTailY}
				x2={axisX}
				y2={axisY}
				stroke={uiPalette.celestial.orbitFocus}
				strokeWidth={1.4}
			/>
			<polygon
				points={`${axisX - 3.5},${axisY + 5} ${axisX + 3.5},${axisY + 5} ${axisX},${axisY - 3}`}
				fill={uiPalette.celestial.orbitFocus}
			/>
			<path
				d={arcPath({
					x: CUTAWAY.cx,
					y: CUTAWAY.cy,
					radius: arcRadius,
					degrees: tilt,
				})}
				fill="none"
				stroke={uiPalette.celestial.orbitFocus}
				strokeWidth={1}
			/>
			<text
				x={CUTAWAY.cx}
				y={CUTAWAY.cy + CUTAWAY.radius + 20}
				textAnchor="middle"
				className="fill-slate-500 text-[9px]"
			>
				{I18N.t("axial tilt {degrees}°", { degrees: tilt.toFixed(1) })}
			</text>
			{props.layers.map((layer, index) => {
				const outer = layer.outerRadius * CUTAWAY.radius
				const inner = layer.innerRadius * CUTAWAY.radius
				const start = `M ${CUTAWAY.cx},${CUTAWAY.cy - outer}`
				const outerArc = `A ${outer},${outer} 0 0 0 ${CUTAWAY.cx},${CUTAWAY.cy + outer}`
				const d =
					layer.innerRadius === 0
						? `${start} ${outerArc} Z`
						: `${start} ${outerArc} L ${CUTAWAY.cx},${CUTAWAY.cy + inner} A ${inner},${inner} 0 0 1 ${CUTAWAY.cx},${CUTAWAY.cy - inner} Z`
				return (
					<path
						key={`cutaway-${index}`}
						d={d}
						fill={layer.color}
						fillOpacity={0.42}
						stroke={layer.color}
						strokeOpacity={0.85}
						strokeWidth={0.9}
					/>
				)
			})}
			<circle
				cx={CUTAWAY.cx}
				cy={CUTAWAY.cy}
				r={CUTAWAY.radius}
				fill="none"
				stroke="rgba(15,23,42,0.25)"
				strokeWidth={1}
			/>
			{props.layers.map((layer, index) => {
				const midRadius =
					((layer.innerRadius + layer.outerRadius) / 2) * CUTAWAY.radius
				return (
					<text
						key={`number-${index}`}
						x={CUTAWAY.cx - midRadius}
						y={CUTAWAY.cy + 3}
						textAnchor="middle"
						className="fill-slate-700 text-[9px] font-semibold"
					>
						{index + 1}
					</text>
				)
			})}
			{props.layers.map((layer, index) => {
				const rowY = KEY.top + index * KEY.pitch
				const innerKm = Math.round(layer.innerRadius * props.radiusKm)
				const outerKm = Math.round(layer.outerRadius * props.radiusKm)
				const depth = `${innerKm.toLocaleString()}–${outerKm.toLocaleString()} km`
				const phase = layer.phase === "solid" ? "" : ` (${I18N.t(layer.phase)})`
				const label = `${index + 1} ${I18N.t(layer.name)}${phase}`
				return (
					<g key={`key-${index}`}>
						<rect
							x={KEY.x}
							y={rowY}
							width={KEY.swatch}
							height={KEY.swatch}
							fill={layer.color}
							fillOpacity={0.85}
						/>
						<text
							x={KEY.labelX}
							y={rowY + 8}
							className="text-[9px] fill-slate-700"
						>
							{label}
						</text>
						<text
							x={KEY.labelX}
							y={rowY + 17}
							className="text-[8px] fill-slate-400"
						>
							{depth}
						</text>
					</g>
				)
			})}
			<text
				x={KEY.x}
				y={KEY.top + props.layers.length * KEY.pitch + 6}
				className="text-[9px] fill-slate-400"
			>
				{footer}
			</text>
		</svg>
	)
}
