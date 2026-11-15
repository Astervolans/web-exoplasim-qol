import type { GcmTargetViewRequest } from "@/ui/gcm/targeting-view/types"
import type { GcmBalanceRow } from "@/ui/gcm/types"
import {
	formatTemperature,
	formatWithUnit,
} from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

function signedPpm(value: number): string {
	return `${value >= 0 ? "+" : ""}${formatWithUnit(value, "ppm", 3)}`
}

function rows({
	state,
	targetK,
	unitSystem,
}: GcmTargetViewRequest): GcmBalanceRow[] {
	const last = state.history[state.history.length - 1]
	const adjustments = I18N.t(
		state.history.length === 1 ? "{count} adjustment" : "{count} adjustments",
		{ count: state.history.length },
	)
	const yearsAtForcing = I18N.t(
		state.yearsAtForcing === 1
			? "{count} year at this CO₂"
			: "{count} years at this CO₂",
		{ count: state.yearsAtForcing },
	)
	return [
		{
			label: I18N.t("Temperature target"),
			value: formatTemperature(targetK - 273.15, unitSystem),
		},
		{
			label: I18N.t("Trial mean"),
			value:
				state.meanTemperatureK === null
					? I18N.t("Waiting for complete years")
					: formatTemperature(state.meanTemperatureK - 273.15, unitSystem),
		},
		{
			label: I18N.t("Current CO₂"),
			value: formatWithUnit(state.co2Ppm, "ppm", 3),
		},
		{
			label: I18N.t(
				state.status === "adjusting" ? "Next CO₂ change" : "Last CO₂ change",
			),
			value: last
				? `${formatWithUnit(last.fromCo2Ppm, "ppm", 3)} → ${formatWithUnit(last.toCo2Ppm, "ppm", 3)} (${signedPpm(last.toCo2Ppm - last.fromCo2Ppm)})`
				: I18N.t("No adjustments yet"),
		},
		{
			label: I18N.t("Total CO₂ change"),
			value: signedPpm(state.co2Ppm - state.initialCo2Ppm),
		},
		{
			label: I18N.t("Targeting"),
			value: `${I18N.t(state.status)} · ${adjustments} · ${yearsAtForcing}`,
		},
	]
}

export const GCM_TARGETING_VIEW = { rows }
