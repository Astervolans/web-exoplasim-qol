import { cx } from "@/ui/components/lib"
import type { GcmSpectralStripProps } from "@/ui/gcm/system/types"
import { rgbToCss } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

export function SpectralStrip({
	swatches,
	activeLetter,
}: GcmSpectralStripProps) {
	return (
		<div
			className="flex items-end gap-1"
			role="img"
			aria-label={I18N.t("Spectral classes, current class {letter}", {
				letter: activeLetter,
			})}
		>
			{swatches.map((swatch) => {
				const active = swatch.letter === activeLetter
				return (
					<div
						key={swatch.letter}
						className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
					>
						<span
							className={cx(
								"font-mono text-[9px] leading-none",
								active ? "font-semibold text-slate-900" : "text-slate-400",
							)}
						>
							{swatch.letter}
						</span>
						<span
							className={cx(
								"h-6 w-full rounded-sm border",
								active
									? "border-slate-900 ring-1 ring-slate-900"
									: "border-slate-200",
							)}
							style={{ backgroundColor: rgbToCss(swatch.color) }}
						/>
					</div>
				)
			})}
		</div>
	)
}
