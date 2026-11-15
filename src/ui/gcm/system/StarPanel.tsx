import { STAR } from "@/model/celestial/star"
import { GCM_SYSTEM } from "@/model/climate/gcm/system"
import { LabeledValueRow } from "@/ui/components/primitives/LabeledValueRow"
import { uiTokens } from "@/ui/components/tokens"
import { GCM_INPUT_HELP } from "@/ui/gcm/input-help"
import { SpectralStrip } from "@/ui/gcm/system/SpectralStrip"
import { SystemSlider } from "@/ui/gcm/system/SystemSlider"
import type { GcmSystemPanelProps } from "@/ui/gcm/system/types"
import { GCM_SYSTEM_VIEW } from "@/ui/gcm/system/view"
import { formatWithUnit } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

export function StarPanel({
	config,
	summary,
	disabled,
	onChange,
}: GcmSystemPanelProps) {
	const star = summary.star
	return (
		<div className="space-y-3">
			<SpectralStrip
				swatches={STAR.SWATCHES}
				activeLetter={star.spectralClass.slice(0, 1)}
			/>
			<SystemSlider
				label={I18N.t("Stellar mass")}
				help={GCM_INPUT_HELP.starMassSolar}
				value={config.starMassSolar}
				display={formatWithUnit(
					config.starMassSolar,
					"M☉",
					config.starMassSolar < 1 ? 3 : 2,
				)}
				min={STAR.MIN_MASS_SOLAR}
				max={STAR.MAX_MASS_SOLAR}
				step={0.001}
				scale="log"
				disabled={disabled}
				onChange={(massSolar) =>
					onChange(
						GCM_SYSTEM.withStar({
							config,
							massSolar,
							ageGyr: config.starAgeGyr,
						}),
					)
				}
			/>
			<SystemSlider
				label={I18N.t("Stellar age")}
				help={GCM_INPUT_HELP.starAgeGyr}
				value={config.starAgeGyr}
				display={formatWithUnit(config.starAgeGyr, "Gyr", 2)}
				min={0.1}
				max={star.maxAgeGyr}
				step={0.01}
				scale="linear"
				disabled={disabled}
				onChange={(ageGyr) =>
					onChange(
						GCM_SYSTEM.withStar({
							config,
							massSolar: config.starMassSolar,
							ageGyr,
						}),
					)
				}
			/>
			<div className="space-y-1">
				{GCM_SYSTEM_VIEW.starRows({ summary }).map((row) => (
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
					"Main-sequence fits from Tout et al. (1996) at the star's age. ExoPlaSim receives the effective temperature and the flux at the planet's orbit; subgiants and remnants are not modelled.",
				)}
			</p>
		</div>
	)
}
