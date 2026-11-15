import { CELESTIAL_ATMOSPHERE } from "@/model/celestial/atmosphere"
import type { AtmosphereGas } from "@/model/celestial/atmosphere/types"
import { LabeledValueRow } from "@/ui/components/primitives/LabeledValueRow"
import { uiPalette, uiTokens } from "@/ui/components/tokens"
import { GcmAtmosphereControls } from "@/ui/gcm/GcmAtmosphereControls"
import { AtmosphereColumn } from "@/ui/gcm/system/AtmosphereColumn"
import type { GcmAtmospherePanelProps } from "@/ui/gcm/system/types"
import { GCM_SYSTEM_VIEW } from "@/ui/gcm/system/view"
import { I18N } from "@/ui/i18n"

const VISIBLE_SHARE = 0.005

function percentLabel(value: number): string {
	const percent = value * 100
	if (percent >= 10) return `${percent.toFixed(1)}%`
	if (percent >= 0.01) return `${percent.toFixed(2)}%`
	return `${percent.toExponential(1)}%`
}

export function AtmospherePanel({
	config,
	summary,
	disabled,
	locked,
	onChange,
	maxElevationKm,
	unitSystem,
}: GcmAtmospherePanelProps) {
	const { atmosphere, profile } = summary
	const mixture = (
		Object.entries(atmosphere.moleFractions) as Array<[AtmosphereGas, number]>
	).toSorted((a, b) => b[1] - a[1])
	return (
		<div className="space-y-3">
			<AtmosphereColumn
				profile={profile}
				surfaceTemperatureK={atmosphere.surfaceTemperatureK}
				surfacePressureBar={atmosphere.pressureBar}
				scaleHeightKm={atmosphere.scaleHeightKm}
				regime={atmosphere.regime}
				maxElevationKm={maxElevationKm}
			/>
			<div className="space-y-1">
				<div className="flex h-4 w-full overflow-hidden rounded-sm border border-slate-200">
					{mixture
						.filter(([, share]) => share >= VISIBLE_SHARE)
						.map(([gas, share]) => (
							<span
								key={gas}
								title={`${CELESTIAL_ATMOSPHERE.speciesLabel({ gas })} ${percentLabel(share)}`}
								style={{
									width: `${share * 100}%`,
									backgroundColor: uiPalette.atmosphere.gas[gas],
								}}
							/>
						))}
				</div>
				<p className={uiTokens.field.note}>
					{mixture
						.filter(([, share]) => share >= VISIBLE_SHARE)
						.map(
							([gas, share]) =>
								`${CELESTIAL_ATMOSPHERE.speciesLabel({ gas })} ${percentLabel(share)}`,
						)
						.join(" · ")}
				</p>
			</div>
			<div className="space-y-1">
				{GCM_SYSTEM_VIEW.atmosphereRows({ summary, unitSystem }).map((row) => (
					<LabeledValueRow
						key={row.label}
						size="md"
						label={row.label}
						value={row.value}
					/>
				))}
			</div>
			<GcmAtmosphereControls
				locked={locked}
				config={config.atmosphere}
				disabled={disabled}
				onChange={(next) => onChange({ ...config, atmosphere: next })}
			/>
			<p className={uiTokens.field.note}>
				{I18N.t(
					"Profile, greenhouse and atmospheric height are zero-dimensional estimates at a wet surface; the map's energy-flow view shows the model's own global-mean fluxes instead. ExoPlaSim's radiation responds only to CO₂, water vapour and ozone, so the gas mix changes the bulk air properties rather than adding absorption.",
				)}
			</p>
		</div>
	)
}
