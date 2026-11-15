import { useId } from "react"
import { uiPalette } from "@/ui/components/tokens"
import type { GcmOrbitDiagramProps } from "@/ui/gcm/system/types"
import { I18N } from "@/ui/i18n"

const CENTER = { x: 160, y: 92 } as const
const MAX_RADIUS = 60
const PLOT = { left: 16, right: 304, top: 26, bottom: 160 } as const
const STRIP = {
	axisY: 208,
	top: 198,
	bottom: 216,
	left: 16,
	right: 304,
} as const
const AXIS_MIN_AU = 0.1
const AXIS_MAX_AU = 3

function au(value: number): string {
	return `${value < 0.1 ? value.toFixed(3) : value.toFixed(2)} AU`
}

function xOf(value: number): number {
	const clamped = Math.min(AXIS_MAX_AU, Math.max(AXIS_MIN_AU, value))
	const t =
		(Math.log10(clamped) - Math.log10(AXIS_MIN_AU)) /
		(Math.log10(AXIS_MAX_AU) - Math.log10(AXIS_MIN_AU))
	return STRIP.left + t * (STRIP.right - STRIP.left)
}

function circlePath({
	x,
	y,
	radius,
}: {
	x: number
	y: number
	radius: number
}) {
	return `M ${x - radius},${y} A ${radius},${radius} 0 1 0 ${x + radius},${y} A ${radius},${radius} 0 1 0 ${x - radius},${y} Z`
}

export function OrbitDiagram({
	semiMajorAxisAu,
	eccentricity,
	zones,
	periodDays,
	planetRadiusEarth,
	planetColor,
	starColor,
}: GcmOrbitDiagramProps) {
	const clip = useId()
	const e = Math.min(Math.max(eccentricity, 0), 0.95)
	const semiPx = MAX_RADIUS / (1 + e)
	const starX = CENTER.x - semiPx * e
	const emptyFocusX = CENTER.x + semiPx * e
	const perihelionX = CENTER.x - semiPx
	const aphelionX = CENTER.x + semiPx
	const radiusY = semiPx * Math.sqrt(1 - e * e)
	const auPx = semiPx / Math.max(semiMajorAxisAu, 1e-6)
	const habitableInner = zones.habitableInnerAu * auPx
	const habitableOuter = zones.habitableOuterAu * auPx
	const snowLine = zones.snowLineAu * auPx
	const planetRadius = Math.max(
		3,
		Math.min(7, 2.4 + 2.2 * Math.log10(planetRadiusEarth + 1)),
	)
	return (
		<svg
			viewBox="0 0 320 236"
			className="h-auto w-full"
			role="img"
			aria-label={I18N.t("Orbit seen from above the ecliptic plane")}
		>
			<title>{I18N.t("Orbit seen from above the ecliptic plane")}</title>
			<defs>
				<clipPath id={clip}>
					<rect
						x={PLOT.left}
						y={PLOT.top}
						width={PLOT.right - PLOT.left}
						height={PLOT.bottom - PLOT.top}
					/>
				</clipPath>
			</defs>
			<text x={8} y={14} className="fill-slate-700 text-[9px] font-semibold">
				{I18N.t("orbit // from above the ecliptic")}
			</text>
			<text x={8} y={22} className="fill-slate-500 text-[9px]">
				a = {au(semiMajorAxisAu)} · e = {e.toFixed(3)} · P ={" "}
				{periodDays.toFixed(0)} d
			</text>
			<g clipPath={`url(#${clip})`}>
				{habitableOuter > habitableInner && (
					<path
						d={`${circlePath({ x: starX, y: CENTER.y, radius: habitableOuter })} ${circlePath({ x: starX, y: CENTER.y, radius: habitableInner })}`}
						fill={uiPalette.celestial.habitableZone}
						fillOpacity={0.09}
						fillRule="evenodd"
						stroke={uiPalette.celestial.habitableZone}
						strokeOpacity={0.55}
						strokeWidth={1}
						strokeDasharray="4 3"
					/>
				)}
				<circle
					cx={starX}
					cy={CENTER.y}
					r={snowLine}
					fill="none"
					stroke={uiPalette.celestial.snowLine}
					strokeOpacity={0.7}
					strokeWidth={1}
					strokeDasharray="2 3"
				/>
				<line
					x1={perihelionX}
					y1={CENTER.y}
					x2={aphelionX}
					y2={CENTER.y}
					stroke={uiPalette.celestial.axis}
					strokeWidth={1}
				/>
				<ellipse
					cx={CENTER.x}
					cy={CENTER.y}
					rx={semiPx}
					ry={radiusY}
					fill="none"
					stroke={uiPalette.celestial.orbit}
					strokeWidth={1.6}
				/>
			</g>
			<circle
				cx={starX}
				cy={CENTER.y}
				r={14}
				fill={starColor}
				fillOpacity={0.16}
			/>
			<circle cx={starX} cy={CENTER.y} r={8} fill={starColor} />
			<text
				x={starX}
				y={CENTER.y + 23}
				textAnchor="middle"
				className="fill-slate-500 text-[9px]"
			>
				{I18N.t("star")}
			</text>
			{e > 0.02 && (
				<g stroke={uiPalette.celestial.orbitFocus} strokeWidth={1}>
					<line
						x1={emptyFocusX - 4}
						y1={CENTER.y - 4}
						x2={emptyFocusX + 4}
						y2={CENTER.y + 4}
					/>
					<line
						x1={emptyFocusX - 4}
						y1={CENTER.y + 4}
						x2={emptyFocusX + 4}
						y2={CENTER.y - 4}
					/>
				</g>
			)}
			<circle
				cx={perihelionX}
				cy={CENTER.y}
				r={planetRadius}
				fill={planetColor}
			/>
			<circle
				cx={perihelionX}
				cy={CENTER.y}
				r={planetRadius}
				fill="none"
				stroke="rgba(15,23,42,0.35)"
				strokeWidth={1}
			/>
			<text
				x={perihelionX}
				y={CENTER.y - 10}
				textAnchor="middle"
				className="fill-slate-600 text-[9px]"
			>
				{I18N.t("planet")}
			</text>
			<text
				x={perihelionX}
				y={CENTER.y + 16}
				textAnchor="middle"
				className="fill-slate-400 text-[8px]"
			>
				{I18N.t("perihelion {distance}", {
					distance: au(semiMajorAxisAu * (1 - e)),
				})}
			</text>
			<text
				x={aphelionX}
				y={CENTER.y + 16}
				textAnchor="middle"
				className="fill-slate-400 text-[8px]"
			>
				{I18N.t("aphelion {distance}", {
					distance: au(semiMajorAxisAu * (1 + e)),
				})}
			</text>
			<text x={8} y={182} className="fill-slate-700 text-[9px] font-semibold">
				{I18N.t("distance from the star")}
			</text>
			<text x={8} y={194} className="text-[8px]">
				<tspan fill={uiPalette.celestial.habitableZone}>
					{I18N.t("shaded = habitable zone {inner}–{outer} AU", {
						inner: zones.habitableInnerAu.toFixed(2),
						outer: zones.habitableOuterAu.toFixed(2),
					})}
				</tspan>
				<tspan fill={uiPalette.celestial.snowLine}>
					{I18N.t("· dashed = snow line {distance} AU", {
						distance: zones.snowLineAu.toFixed(2),
					})}
				</tspan>
			</text>
			<rect
				x={xOf(zones.habitableInnerAu)}
				y={STRIP.top}
				width={Math.max(
					xOf(zones.habitableOuterAu) - xOf(zones.habitableInnerAu),
					1,
				)}
				height={STRIP.bottom - STRIP.top}
				fill={uiPalette.celestial.habitableZone}
				fillOpacity={0.16}
				stroke={uiPalette.celestial.habitableZone}
				strokeOpacity={0.6}
				strokeWidth={1}
			/>
			<line
				x1={xOf(zones.snowLineAu)}
				y1={STRIP.top - 2}
				x2={xOf(zones.snowLineAu)}
				y2={STRIP.bottom + 2}
				stroke={uiPalette.celestial.snowLine}
				strokeWidth={1}
				strokeDasharray="2 3"
			/>
			<line
				x1={STRIP.left}
				y1={STRIP.axisY}
				x2={STRIP.right}
				y2={STRIP.axisY}
				stroke={uiPalette.celestial.axis}
				strokeWidth={1}
			/>
			{[0.1, 0.3, 1, 3].map((value) => (
				<g key={value}>
					<line
						x1={xOf(value)}
						y1={STRIP.axisY}
						x2={xOf(value)}
						y2={STRIP.axisY + 4}
						stroke={uiPalette.celestial.axis}
						strokeWidth={1}
					/>
					<text
						x={xOf(value)}
						y={STRIP.axisY + 15}
						textAnchor="middle"
						className="fill-slate-400 text-[8px]"
					>
						{value}
					</text>
				</g>
			))}
			<circle
				cx={xOf(semiMajorAxisAu)}
				cy={STRIP.axisY}
				r={3.5}
				fill={planetColor}
			/>
			<text
				x={xOf(semiMajorAxisAu)}
				y={STRIP.axisY + 29}
				textAnchor="middle"
				className="fill-slate-500 text-[8px]"
			>
				{semiMajorAxisAu.toFixed(2)} AU
			</text>
		</svg>
	)
}
