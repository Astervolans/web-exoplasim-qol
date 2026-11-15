import { GCM_AVERAGES } from "@/model/climate/gcm/averages"
import type { GcmDate } from "@/model/climate/gcm/types"
import type {
	GcmClimateEntry,
	GcmPeriodRequest,
	GcmPeriodView,
} from "@/ui/gcm/types"
import { I18N } from "@/ui/i18n"

const OCEAN_CLASS = 0
const MONTH_FORMATS = {
	en: new Intl.DateTimeFormat("en", { month: "short" }),
	zh: new Intl.DateTimeFormat("zh-CN", { month: "short" }),
} as const

function pad(value: number): string {
	return String(value).padStart(2, "0")
}

function monthName(month: number): string {
	return MONTH_FORMATS[I18N.language()].format(new Date(2000, month - 1, 1))
}

function instant(date: GcmDate): string {
	return I18N.t("Year {year} · {stamp}", {
		year: date.year,
		stamp: `${pad(date.month)}-${pad(date.day)} ${pad(date.hour)}:${pad(date.minute)}`,
	})
}

function select({
	period,
	monthIndex,
	snapshot,
	averages,
}: GcmPeriodRequest): GcmPeriodView {
	if (period === "now") {
		return {
			snapshot,
			label: snapshot ? instant(snapshot.date) : "—",
			emptyMessage: I18N.t("Press Start to spin up the model"),
		}
	}
	if (period === "month") {
		const { months } = averages
		const month = months[monthIndex ?? months.length - 1]
		return {
			snapshot: month?.snapshot ?? null,
			label: month
				? I18N.t("{month} mean · year {year}", {
						month: monthName(month.month),
						year: month.year,
					})
				: "—",
			emptyMessage: I18N.t(
				"Monthly means appear when the first model month ends",
			),
		}
	}
	const last = averages.months[averages.months.length - 1]
	return {
		snapshot: averages.annual,
		label: last
			? I18N.t("12-month mean ending {month} · year {year}", {
					month: monthName(last.month),
					year: last.year,
				})
			: "—",
		emptyMessage: I18N.t(
			"Annual means need {needed} model months ({done} done)",
			{
				needed: GCM_AVERAGES.MONTHS_PER_YEAR,
				done: averages.months.length,
			},
		),
	}
}

function climateEntries(classes: Uint8Array): GcmClimateEntry[] {
	const counts = new Map<number, number>()
	for (const classId of classes) {
		if (classId !== OCEAN_CLASS)
			counts.set(classId, (counts.get(classId) ?? 0) + 1)
	}
	return [...counts]
		.map(([classId, cells]) => ({ classId, cells }))
		.toSorted((a, b) => a.classId - b.classId)
}

export const GCM_PERIOD_VIEW = {
	monthName,
	select,
	climateEntries,
}
