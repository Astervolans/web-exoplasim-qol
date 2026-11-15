import { useId } from "react"
import type { GcmEnergyFlowViewProps } from "@/ui/gcm/types"

const DW = 1120
const DH = 780
const SPACE = 152
const CLOUD_TOP = 196
const CLOUD_BOTTOM = 268
const LOOP_TOP = 336
const LOOP_BOTTOM = 610
const BOTTOM_Y = 660
const GROUND = 720
const SUN_X = 200
const REFLECT_X = 96
const LOOP_LEFT = 336
const LOOP_RIGHT = 826
const OUT_X = 930
const STORE_X = 520
const PIPE_BORDER = "#0d0905"

const COLORS = {
	sun: "#e8a225",
	sunBright: "#f5b82e",
	reflected: "#cfc29d",
	loop: "#df7b32",
	space: "#d94c57",
	storage: "#2e8eb8",
	dim: "#9e7330",
	label: "#d49a35",
	cloud: "#7a828e",
} as const

function f(value: number): string {
	const magnitude = Math.abs(value)
	if (magnitude >= 10) return value.toFixed(0)
	if (magnitude >= 1) return value.toFixed(1)
	return value.toFixed(2)
}

function signed(value: number): string {
	return `${value >= 0 ? "+" : ""}${f(value)}`
}

function Pipe({
	d,
	width,
	color,
}: {
	d: string
	width: number
	color: string
}) {
	const stroke = Math.max(2, width)
	return (
		<g>
			<path
				d={d}
				fill="none"
				stroke={PIPE_BORDER}
				strokeWidth={stroke + 6}
				strokeLinejoin="round"
			/>
			<path
				d={d}
				fill="none"
				stroke={color}
				strokeWidth={stroke}
				strokeLinejoin="round"
			/>
			<path
				d={d}
				fill="none"
				stroke={PIPE_BORDER}
				strokeOpacity={0.42}
				strokeWidth={Math.max(1, stroke - 2)}
				strokeDasharray="1.5 10"
			/>
			<path
				d={d}
				fill="none"
				stroke={color}
				strokeOpacity={0.95}
				strokeWidth={Math.max(1.6, Math.min(6, stroke * 0.18))}
				strokeDasharray="7 1.4 5.4 1.5 4.2 1.7 3.2 1.8 2.4 2 1.8 2.2 1.3 2.6"
				className="gcm-energy-pulse"
				strokeLinejoin="round"
			/>
		</g>
	)
}

function Chevron({ points }: { points: string }) {
	return (
		<polyline
			points={points}
			fill="none"
			stroke={PIPE_BORDER}
			strokeWidth={3}
			strokeLinejoin="round"
		/>
	)
}

export function GcmEnergyMapView({
	flows,
	label,
	estimated,
}: GcmEnergyFlowViewProps) {
	const ids = {
		scan: useId(),
		cloud: useId(),
		land: useId(),
		ocean: useId(),
	}
	const k = Math.min(0.24, 76 / Math.max(flows.upward, flows.incoming, 1))
	const w = (value: number) => Math.max(2, k * Math.max(value, 0))
	const wSun = w(flows.incoming)
	const wAfterCloud = w(flows.incoming - flows.reflectedAir)
	const wAfterAir = w(flows.incoming - flows.reflectedAir - flows.airAbsorbed)
	const wSurface = w(flows.surfaceAbsorbed)
	const wReflected = w(flows.reflected)
	const wCloudReflected = w(flows.reflectedAir)
	const wSurfaceReflected = w(flows.reflectedSurface)
	const wUp = w(flows.upward)
	const wTurn = w(flows.turn)
	const wBack = w(flows.backRadiation)
	const wBottom = w(flows.surfaceAbsorbed + flows.backRadiation)
	const wOut = w(flows.outgoing)
	const wStore = w(Math.abs(flows.stored))
	const settled = Math.abs(flows.stored) < 1.5
	const status = settled
		? { text: "settled", color: "#4aa3cc" }
		: flows.stored > 0
			? { text: "warming", color: COLORS.loop }
			: { text: "cooling", color: COLORS.storage }
	const half = (value: number) => value / 2
	const ridge = Array.from({ length: 33 }, (_, index) => {
		const t = index / 32
		return {
			x: 30 + t * 1060,
			y:
				GROUND -
				22 *
					(0.6 * Math.sin(t * 6.1 + 0.9) +
						0.3 * Math.sin(t * 14.3 + 2.2) +
						0.1 * Math.sin(t * 27.7 + 0.4)),
		}
	})
	const ridgePath = ridge
		.map(
			(point, index) =>
				`${index === 0 ? "M" : "L"} ${point.x.toFixed(1)},${point.y.toFixed(1)}`,
		)
		.join(" ")
	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-800 bg-[#0b0704]">
			<div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
				<div>
					<div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e8a838]">
						energy // flows
					</div>
					<div className="mt-1 text-[11px] text-[#9e7330]">
						global mean · W/m²
					</div>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-[11px] text-[#9e7330]">{label}</span>
					<span
						className="flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
						style={{ borderColor: status.color, color: status.color }}
					>
						<span
							className="h-1.5 w-1.5 rounded-full"
							style={{ backgroundColor: status.color }}
						/>
						{status.text}
					</span>
				</div>
			</div>
			<div className="min-h-0 flex-1 px-2 pb-1">
				<svg
					viewBox={`0 0 ${DW} ${DH}`}
					className="h-full w-full"
					preserveAspectRatio="xMidYMid meet"
					role="img"
					aria-label="Global mean energy flow"
				>
					<title>Global mean energy flow</title>
					<defs>
						<pattern
							id={ids.scan}
							width="4"
							height="4"
							patternUnits="userSpaceOnUse"
						>
							<line
								x1="0"
								y1="0"
								x2="4"
								y2="0"
								stroke="#e8a838"
								strokeWidth="1"
								strokeOpacity="0.035"
							/>
							<line
								x1="0"
								y1="2"
								x2="4"
								y2="2"
								stroke="#000000"
								strokeWidth="1"
								strokeOpacity="0.22"
							/>
						</pattern>
						<linearGradient id={ids.cloud} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="#2b2f36" stopOpacity="0.9" />
							<stop offset="0.5" stopColor="#363b44" stopOpacity="0.85" />
							<stop offset="1" stopColor="#23272e" stopOpacity="0.9" />
						</linearGradient>
						<linearGradient id={ids.land} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="#613019" />
							<stop offset="1" stopColor="#3d1c0d" />
						</linearGradient>
						<linearGradient id={ids.ocean} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="#27637d" />
							<stop offset="0.25" stopColor="#1b465c" />
							<stop offset="1" stopColor="#102b3a" />
						</linearGradient>
					</defs>
					<rect width={DW} height={DH} fill="#0b0704" />
					<rect width={DW} height={DH} fill={`url(#${ids.scan})`} />
					<rect
						x="10"
						y="10"
						width={DW - 20}
						height={DH - 20}
						fill="none"
						stroke="#3a2810"
					/>
					<line
						x1="30"
						y1={SPACE}
						x2={DW - 30}
						y2={SPACE}
						stroke="#7a561e"
						strokeWidth={2}
						strokeDasharray="3 4"
					/>
					<text
						x={DW - 40}
						y={SPACE - 8}
						textAnchor="end"
						fill={COLORS.dim}
						fontSize="12"
					>
						space
					</text>
					{[470, 700, 860, 1010, 120].map((x, index) => (
						<circle
							key={x}
							cx={x}
							cy={148 + index * 11}
							r="1.2"
							fill="#e8a838"
							opacity="0.4"
						/>
					))}
					<rect
						x="30"
						y={CLOUD_TOP}
						width={DW - 60}
						height={CLOUD_BOTTOM - CLOUD_TOP}
						fill={`url(#${ids.cloud})`}
					/>
					<line
						x1="30"
						y1={CLOUD_TOP}
						x2={DW - 30}
						y2={CLOUD_TOP}
						stroke={COLORS.cloud}
						strokeWidth={2}
						strokeDasharray="6 4"
					/>
					<line
						x1="30"
						y1={CLOUD_BOTTOM}
						x2={DW - 30}
						y2={CLOUD_BOTTOM}
						stroke={COLORS.cloud}
						strokeWidth={2}
						strokeDasharray="6 4"
					/>
					<rect
						x="262"
						y={CLOUD_TOP + 20}
						width="196"
						height="36"
						fill="#0d0a07"
						fillOpacity="0.78"
					/>
					<text
						x="272"
						y={CLOUD_TOP + 38}
						fill="#b8bec7"
						fontSize="13"
						fontWeight="700"
					>
						cloud deck
					</text>
					<text x="272" y={CLOUD_TOP + 52} fill={COLORS.dim} fontSize="11">
						reflective both ways
					</text>
					<text x={SUN_X - 30} y={SPACE - 8} fill={COLORS.dim} fontSize="11">
						stellar flux
					</text>
					<text x={SUN_X + 44} y={128} fill={COLORS.dim} fontSize="11">
						sunlight
					</text>
					<text
						x={SUN_X + 44}
						y={150}
						fill={COLORS.sunBright}
						fontSize="22"
						fontWeight="700"
					>
						{f(flows.incoming)}
					</text>
					<text
						x={REFLECT_X - 26}
						y={128}
						textAnchor="end"
						fill={COLORS.reflected}
						fontSize="13"
						fontWeight="600"
					>
						reflected
					</text>
					<text
						x={REFLECT_X - 26}
						y={150}
						textAnchor="end"
						fill={COLORS.reflected}
						fontSize="20"
						fontWeight="700"
					>
						{f(flows.reflected)}
					</text>
					<text
						x={REFLECT_X - 26}
						y={172}
						textAnchor="end"
						fill={COLORS.dim}
						fontSize="11"
					>
						cloud {f(flows.reflectedAir)} · ground {f(flows.reflectedSurface)}
					</text>
					<text
						x={REFLECT_X - 26}
						y={186}
						textAnchor="end"
						fill={COLORS.dim}
						fontSize="11"
					>
						albedo {(flows.albedo * 100).toFixed(0)}%
					</text>
					<text
						x={OUT_X + 118}
						y={128}
						textAnchor="end"
						fill={COLORS.space}
						fontSize="13"
						fontWeight="600"
					>
						to space
					</text>
					<text
						x={OUT_X + 118}
						y={150}
						textAnchor="end"
						fill={COLORS.space}
						fontSize="20"
						fontWeight="700"
					>
						{f(flows.outgoing)}
					</text>
					<text
						x={OUT_X + 118}
						y={172}
						textAnchor="end"
						fill={COLORS.dim}
						fontSize="11"
					>
						atmosphere + window
					</text>
					<rect
						x="30"
						y={GROUND}
						width={DW - 60}
						height={DH - GROUND - 20}
						fill="#0d0905"
					/>
					<rect
						x="30"
						y={GROUND}
						width={DW - 60}
						height="66"
						fill={`url(#${ids.ocean})`}
					/>
					<path
						d={`${ridgePath} L ${DW - 30},${GROUND} L 30,${GROUND} Z`}
						fill={`url(#${ids.land})`}
					/>
					<polygon
						points={`30,${GROUND} 104,${GROUND} 100,${GROUND + 9} 30,${GROUND + 9}`}
						fill="#d9ebf2"
					/>
					<polygon
						points={`${DW - 30},${GROUND} ${DW - 104},${GROUND} ${DW - 100},${GROUND + 9} ${DW - 30},${GROUND + 9}`}
						fill="#d9ebf2"
					/>
					<text x="40" y={DH - 30} fill={COLORS.dim} fontSize="11">
						ground · ocean takes up or gives back heat
					</text>
					{/* sunlight column, narrowing at each branch */}
					<Pipe
						d={`M ${SUN_X},${SPACE} L ${SUN_X},${CLOUD_TOP + 34}`}
						width={wSun}
						color={COLORS.sun}
					/>
					<Pipe
						d={`M ${SUN_X},${CLOUD_TOP + 34} L ${SUN_X},${CLOUD_BOTTOM}`}
						width={wAfterCloud}
						color={COLORS.sun}
					/>
					<Pipe
						d={`M ${SUN_X},${CLOUD_BOTTOM} L ${SUN_X},${LOOP_TOP + 50}`}
						width={wAfterCloud}
						color={COLORS.sun}
					/>
					<Pipe
						d={`M ${SUN_X},${LOOP_TOP + 50} L ${SUN_X},${LOOP_BOTTOM - 50}`}
						width={wAfterAir}
						color={COLORS.sun}
					/>
					<Pipe
						d={`M ${SUN_X},${LOOP_BOTTOM - 50} L ${SUN_X},${LOOP_BOTTOM} A 50 50 0 0 0 ${SUN_X + 50},${BOTTOM_Y} L ${LOOP_LEFT + 50},${BOTTOM_Y}`}
						width={wSurface}
						color={COLORS.sun}
					/>
					{/* cloud reflection U-turn into the reflection column */}
					<Pipe
						d={`M ${SUN_X - half(wSun)},${CLOUD_TOP + 34} L 150,${CLOUD_TOP + 34} A 30 30 0 0 0 120,${CLOUD_TOP + 4} L 120,${SPACE}`}
						width={wCloudReflected}
						color={COLORS.reflected}
					/>
					{/* surface reflection U-turn */}
					<Pipe
						d={`M ${SUN_X - half(wAfterAir)},${LOOP_BOTTOM - 50} L 150,${LOOP_BOTTOM - 50} A 30 30 0 0 0 120,${LOOP_BOTTOM - 80} L 120,${CLOUD_TOP + 34}`}
						width={wSurfaceReflected}
						color={COLORS.reflected}
					/>
					<Pipe
						d={`M ${REFLECT_X},${CLOUD_TOP + 4} L ${REFLECT_X},${SPACE}`}
						width={wReflected}
						color={COLORS.reflected}
					/>
					<polygon
						points={`${REFLECT_X - half(wReflected) - 3},${SPACE + 10} ${REFLECT_X + half(wReflected) + 3},${SPACE + 10} ${REFLECT_X},${SPACE - 6}`}
						fill={COLORS.reflected}
					/>
					{/* atmosphere / surface loop */}
					<Pipe
						d={`M ${LOOP_RIGHT},${BOTTOM_Y} L ${LOOP_RIGHT},${LOOP_TOP}`}
						width={wUp}
						color={COLORS.loop}
					/>
					<Pipe
						d={`M ${LOOP_RIGHT},${LOOP_TOP} L ${LOOP_LEFT},${LOOP_TOP}`}
						width={wTurn}
						color={COLORS.loop}
					/>
					<Pipe
						d={`M ${LOOP_LEFT},${LOOP_TOP} L ${LOOP_LEFT},${LOOP_BOTTOM} A 50 50 0 0 0 ${LOOP_LEFT + 50},${BOTTOM_Y}`}
						width={wBack}
						color={COLORS.loop}
					/>
					<Pipe
						d={`M ${LOOP_LEFT + 50},${BOTTOM_Y} L ${LOOP_RIGHT},${BOTTOM_Y}`}
						width={wBottom}
						color={COLORS.loop}
					/>
					{/* air absorption enters the left leg */}
					<Pipe
						d={`M ${SUN_X},${LOOP_TOP + 50} L ${LOOP_LEFT},${LOOP_TOP + 50}`}
						width={w(flows.airAbsorbed)}
						color={COLORS.loop}
					/>
					{/* thermal emission to space */}
					<Pipe
						d={`M ${LOOP_RIGHT},${LOOP_TOP} L ${OUT_X},${LOOP_TOP} A 40 40 0 0 1 ${OUT_X + 40},${LOOP_TOP - 40} L ${OUT_X + 40},${SPACE}`}
						width={wOut}
						color={COLORS.space}
					/>
					<polygon
						points={`${OUT_X + 40 - half(wOut) - 3},${SPACE + 10} ${OUT_X + 40 + half(wOut) + 3},${SPACE + 10} ${OUT_X + 40},${SPACE - 6}`}
						fill={COLORS.space}
					/>
					{/* storage branch */}
					{Math.abs(flows.stored) >= 0.5 && (
						<Pipe
							d={`M ${STORE_X},${LOOP_BOTTOM + 50} L ${STORE_X},${GROUND + 34}`}
							width={wStore}
							color={flows.stored >= 0 ? COLORS.storage : "#4aa3cc"}
						/>
					)}
					<Chevron
						points={`${SUN_X - half(wSun) - 4},${CLOUD_TOP + 22} ${SUN_X},${CLOUD_TOP + 34} ${SUN_X + half(wSun) + 4},${CLOUD_TOP + 22}`}
					/>
					<Chevron
						points={`${SUN_X - 8},${LOOP_TOP + 38} ${LOOP_LEFT + 6},${LOOP_TOP + 50} ${SUN_X - 8},${LOOP_TOP + 58}`}
					/>
					<Chevron
						points={`${SUN_X - half(wAfterAir) - 4},${LOOP_BOTTOM - 62} ${SUN_X},${LOOP_BOTTOM - 50} ${SUN_X + half(wAfterAir) + 4},${LOOP_BOTTOM - 62}`}
					/>
					<Chevron
						points={`${SUN_X + 36},${LOOP_BOTTOM + 36} ${SUN_X + 50},${LOOP_BOTTOM + 50} ${SUN_X + 36},${LOOP_BOTTOM + 64}`}
					/>
					<Chevron
						points={`${LOOP_RIGHT - 10},${LOOP_BOTTOM + 36} ${LOOP_RIGHT},${LOOP_BOTTOM + 50} ${LOOP_RIGHT - 10},${LOOP_BOTTOM + 64}`}
					/>
					<Chevron
						points={`${STORE_X - 8},${LOOP_BOTTOM + 64} ${STORE_X},${LOOP_BOTTOM + 50} ${STORE_X + 8},${LOOP_BOTTOM + 64}`}
					/>
					<Chevron
						points={`${LOOP_RIGHT - 14},${LOOP_TOP + 4} ${LOOP_RIGHT},${LOOP_TOP} ${LOOP_RIGHT - 14},${LOOP_TOP - 4}`}
					/>
					{/* labels */}
					<rect
						x={LOOP_LEFT + 34}
						y={LOOP_TOP + 30}
						width="206"
						height="58"
						fill="#0d0a07"
						fillOpacity="0.78"
					/>
					<text
						x={LOOP_LEFT + 46}
						y={LOOP_TOP + 52}
						fill={COLORS.label}
						fontSize="13"
						fontWeight="600"
					>
						air absorbs +{f(flows.airAbsorbed)}
					</text>
					<text
						x={LOOP_LEFT + 46}
						y={LOOP_TOP + 74}
						fill={COLORS.loop}
						fontSize="13"
						fontWeight="600"
					>
						back radiation {f(flows.backRadiation)}
					</text>
					<rect
						x={LOOP_RIGHT - 196}
						y={LOOP_TOP - 96}
						width="176"
						height="44"
						fill="#0d0a07"
						fillOpacity="0.78"
					/>
					<text
						x={LOOP_RIGHT - 46}
						y={LOOP_TOP - 76}
						textAnchor="end"
						fill={COLORS.loop}
						fontSize="13"
						fontWeight="600"
					>
						turns back
					</text>
					<text
						x={LOOP_RIGHT - 46}
						y={LOOP_TOP - 58}
						textAnchor="end"
						fill={COLORS.loop}
						fontSize="18"
						fontWeight="700"
					>
						{f(flows.turn)}
					</text>
					<text
						x={(LOOP_LEFT + LOOP_RIGHT) / 2}
						y={(LOOP_TOP + LOOP_BOTTOM) / 2 + 8}
						textAnchor="middle"
						fill={COLORS.dim}
						fontSize="13"
					>
						surface · atmosphere cycle
					</text>
					<text
						x={(LOOP_LEFT + LOOP_RIGHT) / 2}
						y={(LOOP_TOP + LOOP_BOTTOM) / 2 + 56}
						textAnchor="middle"
						fill={COLORS.sunBright}
						fontSize="54"
						fontWeight="700"
					>
						{f(flows.upward)}
					</text>
					<text
						x={(LOOP_LEFT + LOOP_RIGHT) / 2 + 6}
						y={(LOOP_TOP + LOOP_BOTTOM) / 2 + 80}
						textAnchor="middle"
						fill={COLORS.loop}
						fontSize="12"
					>
						counterclockwise
					</text>
					<text
						x={(LOOP_LEFT + LOOP_RIGHT) / 2}
						y={(LOOP_TOP + LOOP_BOTTOM) / 2 + 104}
						textAnchor="middle"
						fill={COLORS.dim}
						fontSize="11"
					>
						IR {f(flows.surfaceEmission)} · LH+SH{" "}
						{f(flows.latent + flows.sensible)}
					</text>
					<rect
						x="30"
						y={LOOP_BOTTOM - 96}
						width="146"
						height="46"
						fill="#0d0a07"
						fillOpacity="0.78"
					/>
					<text
						x="42"
						y={LOOP_BOTTOM - 76}
						fill={COLORS.label}
						fontSize="13"
						fontWeight="600"
					>
						surface absorbs
					</text>
					<text
						x="42"
						y={LOOP_BOTTOM - 58}
						fill={COLORS.sunBright}
						fontSize="18"
						fontWeight="700"
					>
						{f(flows.surfaceAbsorbed)}
					</text>
					<text
						x={STORE_X + 14}
						y={GROUND + 22}
						fill={COLORS.storage}
						fontSize="13"
						fontWeight="600"
					>
						{flows.stored >= 0 ? "stored" : "released"} {signed(flows.stored)}
					</text>
					<text
						x={STORE_X + 14}
						y={GROUND + 38}
						fill={COLORS.dim}
						fontSize="11"
					>
						ocean and ice {flows.stored >= 0 ? "take up" : "give back"} heat
					</text>
					<text
						x={DW - 40}
						y={GROUND + 22}
						textAnchor="end"
						fill={COLORS.dim}
						fontSize="11"
					>
						width = power · pulses travel with the flow
					</text>
				</svg>
			</div>
			<div className="grid grid-cols-3 gap-2 border-t border-[#2a1d0e] px-4 py-3">
				{[
					{
						title: "input",
						value: f(flows.incoming),
						note: "stellar flux",
						color: "#f5b82e",
					},
					{
						title: "output",
						value: f(flows.reflected + flows.outgoing),
						note: `reflected ${f(flows.reflected)} · thermal ${f(flows.outgoing)}`,
						color: COLORS.space,
					},
					{
						title: "balance",
						value: signed(flows.stored),
						note: settled
							? "settled"
							: flows.stored > 0
								? "storing heat"
								: "releasing heat",
						color: settled
							? "#4aa3cc"
							: flows.stored > 0
								? COLORS.loop
								: COLORS.storage,
					},
				].map((tile) => (
					<div
						key={tile.title}
						className="border border-[#59401a] bg-[#1c1409] px-3 py-2"
					>
						<div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#9e7330]">
							{tile.title}
						</div>
						<div
							className="font-mono text-[20px] leading-tight"
							style={{ color: tile.color }}
						>
							{tile.value}
							<span className="ml-1 text-[10px] text-[#9e7330]">W/m²</span>
						</div>
						<div className="text-[10px] text-[#9e7330]">{tile.note}</div>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-4 border-t border-[#2a1d0e] px-4 py-2 text-[10px] text-[#9e7330]">
				{[
					{ text: "sunlight", color: "#e8a225" },
					{ text: "reflected", color: "#cfc29d" },
					{ text: "cycling heat", color: "#df7b32" },
					{ text: "to space", color: "#d94c57" },
					{ text: "ocean & ice", color: "#2e8eb8" },
				].map((entry) => (
					<span key={entry.text} className="flex items-center gap-1.5">
						<span
							className="h-2 w-4"
							style={{ backgroundColor: entry.color }}
						/>
						{entry.text}
					</span>
				))}
				{estimated && (
					<span>
						zero-dimensional estimate — start the model for measured fluxes
					</span>
				)}
			</div>
		</div>
	)
}
