import { useEffect, useRef } from "react"
import { cx } from "@/ui/components/lib"
import { uiTokens } from "@/ui/components/tokens"
import { GCM_TERRAIN_PREVIEW } from "@/ui/gcm/terrain/preview"
import type { GcmTerrainPreviewProps } from "@/ui/gcm/terrain/types"

export function TerrainPreview({
	readTerrain,
	label,
	starPoints,
	zoneCircles,
}: GcmTerrainPreviewProps) {
	const canvas = useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		const terrain = readTerrain()
		if (canvas.current && terrain)
			GCM_TERRAIN_PREVIEW.paint({
				terrain,
				boundary: null,
				starPoints,
				zoneCircles,
				canvas: canvas.current,
			})
	}, [readTerrain, starPoints, zoneCircles])
	return (
		<figure className="space-y-1">
			<canvas
				ref={canvas}
				role="img"
				aria-label={label}
				className={cx(
					"aspect-[2/1] w-full border",
					uiTokens.border.default,
					uiTokens.radius.sm,
				)}
			/>
			<figcaption className="space-y-1">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<span className={uiTokens.type.valueSm}>{label}</span>
					<span className={uiTokens.field.note}>
						White is land; black is ocean.
					</span>
				</div>
				<p className={uiTokens.field.note}>
					Gray dashes: imported grid. Cyan: model grid, with dots at its poles.
				</p>
				{starPoints.length > 0 && (
					<p className={uiTokens.field.note}>
						Amber sun: sub-stellar point. Dark dot: anti-stellar point.
					</p>
				)}
				{zoneCircles.length > 0 && (
					<p className={uiTokens.field.note}>
						Orange dashes: tropics. Violet dashes: polar circles.
					</p>
				)}
			</figcaption>
		</figure>
	)
}
