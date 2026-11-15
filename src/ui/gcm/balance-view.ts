import { GCM_BALANCE } from "@/model/climate/gcm/balance"
import { GCM_FIELDS } from "@/model/climate/gcm/fields"
import type { GcmFieldId } from "@/model/climate/gcm/fields/types"
import { GCM_GRID } from "@/model/climate/gcm/grid"
import type { GcmBalanceRow, GcmBalanceViewRequest } from "@/ui/gcm/types"
import { formatWithUnit } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

const MILLIWATTS_PER_WATT = 1000

function signed(value: number): string {
	return `${value >= 0 ? "+" : ""}${formatWithUnit(value, "W/m²", 2)}`
}

function rows({ averages, targeting }: GcmBalanceViewRequest): GcmBalanceRow[] {
	const month = averages.months[averages.months.length - 1]
	const monthMean = (field: GcmFieldId) =>
		month
			? GCM_GRID.globalMean(
					GCM_FIELDS.field({ snapshot: month.snapshot, field }),
				)
			: Number.NaN
	const assessment = GCM_BALANCE.assess(
		targeting
			? averages.years.filter(
					(year) =>
						targeting.trialStartYear !== null &&
						year.year > targeting.trialStartYear,
				)
			: averages.years,
	)
	const drift =
		assessment.status === "spinning-up"
			? I18N.t(
					assessment.yearsNeeded === 1
						? "needs {years} more year"
						: "needs {years} more years",
					{ years: assessment.yearsNeeded },
				)
			: `${I18N.t(assessment.status === "balanced" ? "balanced" : "drifting")} · ${formatWithUnit(
					Math.max(assessment.toaDriftPerYear, assessment.surfaceDriftPerYear) *
						MILLIWATTS_PER_WATT,
					"mW/m²/yr",
					1,
				)}`
	return [
		{
			label: I18N.t("Top of atmosphere"),
			value: month
				? I18N.t("{value} last month", {
						value: signed(monthMean("toaNetRadiation")),
					})
				: "—",
		},
		{
			label: I18N.t("Surface"),
			value: month
				? I18N.t("{value} last month", {
						value: signed(monthMean("surfaceNetHeat")),
					})
				: "—",
		},
		{ label: I18N.t("Equilibrium"), value: drift },
	]
}

export const GCM_BALANCE_VIEW = {
	rows,
}
