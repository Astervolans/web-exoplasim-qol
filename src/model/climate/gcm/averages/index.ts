import type {
	GcmAverageMerge,
	GcmAverager,
	GcmAveragerSample,
	GcmAveragerSave,
	GcmAverageState,
	GcmAveragesRequest,
	GcmClimateCache,
	GcmClimateMerge,
	GcmClimatology,
	GcmMonthAccumulator,
	GcmMonthlyMean,
	GcmMonthMerge,
} from "@/model/climate/gcm/averages/types"
import type { GcmYearlyBalance } from "@/model/climate/gcm/balance/types"
import { GCM_CLASSIFICATION } from "@/model/climate/gcm/classification"
import { GCM_FIELDS } from "@/model/climate/gcm/fields"
import type { GcmFieldId } from "@/model/climate/gcm/fields/types"
import { GCM_GRID } from "@/model/climate/gcm/grid"
import type { GcmSnapshot } from "@/model/climate/gcm/types"

const MONTHS_PER_YEAR = 12
const CLIMATE_YEARS = 10
const MAX_HISTORY_YEARS = CLIMATE_YEARS + 1
const HISTORY_MONTHS = MAX_HISTORY_YEARS * MONTHS_PER_YEAR
const climateCache = new WeakMap<GcmAverager, GcmClimateCache>()
// PlaSim divides its calendar into twelve equally weighted sampling months.

function create(): GcmAverager {
	return { current: null, months: [], years: [], climate: null }
}

function yearly(averager: GcmAverager): GcmYearlyBalance | null {
	const months = averager.months.slice(-MONTHS_PER_YEAR)
	const last = months[months.length - 1]
	if (
		months.length < MONTHS_PER_YEAR ||
		last.month !== MONTHS_PER_YEAR ||
		months.some((month) => month.year !== last.year)
	) {
		return null
	}
	const snapshot = annual(averager) as GcmSnapshot
	const mean = (field: GcmFieldId) =>
		GCM_GRID.globalMean(GCM_FIELDS.field({ snapshot, field }))
	return {
		year: last.year,
		toaNetRadiation: mean("toaNetRadiation"),
		surfaceNetHeat: mean("surfaceNetHeat"),
		surfaceTemperature: mean("surfaceTemperature"),
	}
}

function close(accumulator: GcmMonthAccumulator): GcmMonthlyMean {
	const values = new Float32Array(accumulator.sum.length)
	for (let index = 0; index < values.length; index++) {
		values[index] = accumulator.sum[index] / accumulator.samples
	}
	return {
		year: accumulator.year,
		month: accumulator.month,
		snapshot: {
			layers: accumulator.last.layers,
			step: accumulator.last.step,
			date: {
				year: accumulator.year,
				month: accumulator.month,
				day: 1,
				hour: 0,
				minute: 0,
			},
			values,
			currents: accumulator.last.currents,
		},
	}
}

function open(snapshot: GcmSnapshot): GcmMonthAccumulator {
	return {
		year: snapshot.date.year,
		month: snapshot.date.month,
		sum: new Float64Array(snapshot.values),
		samples: 1,
		last: snapshot,
	}
}

// Returns true when a month closed, so callers redraw averages only then.
function add({ averager, snapshot }: GcmAveragerSample): boolean {
	const current = averager.current
	if (
		current &&
		current.month === snapshot.date.month &&
		current.year === snapshot.date.year
	) {
		for (let index = 0; index < current.sum.length; index++) {
			current.sum[index] += snapshot.values[index]
		}
		current.samples++
		current.last = snapshot
		return false
	}
	averager.current = open(snapshot)
	if (!current) return false
	averager.months = [...averager.months, close(current)].slice(-HISTORY_MONTHS)
	const year = yearly(averager)
	if (year) averager.years = [...averager.years, year]
	dropSavedClimate(averager)
	return true
}

function annual(averager: GcmAverager): GcmSnapshot | null {
	if (averager.months.length < MONTHS_PER_YEAR) return null
	const months = averager.months.slice(-MONTHS_PER_YEAR)
	const [first] = months
	const last = months[months.length - 1]
	const values = new Float32Array(first.snapshot.values.length)
	for (const month of months) {
		for (let index = 0; index < values.length; index++) {
			values[index] += month.snapshot.values[index] / MONTHS_PER_YEAR
		}
	}
	const snapshot: GcmSnapshot = {
		layers: last.snapshot.layers,
		step: last.snapshot.step,
		date: last.snapshot.date,
		values,
		currents: last.snapshot.currents,
	}
	const range = GCM_FIELDS.field({
		snapshot,
		field: "dailyTemperatureRangeSum",
	})
	range.fill(0)
	for (const month of months) {
		const daily = GCM_FIELDS.values({
			snapshot: month.snapshot,
			mode: "diurnalTemperatureRange",
		})
		for (let point = 0; point < range.length; point++)
			range[point] += daily[point] / MONTHS_PER_YEAR
	}
	GCM_FIELDS.field({ snapshot, field: "dailyTemperatureRangeDays" }).fill(1)
	GCM_FIELDS.field({ snapshot, field: "diurnalTemperatureRange" }).set(range)
	return snapshot
}

export const GCM_AVERAGES = {
	MONTHS_PER_YEAR,
	CLIMATE_YEARS,
	MAX_HISTORY_YEARS,
	create,
	add,
	annual,
	view: averages,
	merge,
	mergeMonths,
	saved,
}

// A checkpoint can drop older months; the climatology they were reduced to
// keeps the climate maps of a resumed run unchanged.
function saved({ averager, climate, years }: GcmAveragerSave): GcmAverager {
	const months = averager.months.slice(-Math.max(1, years) * MONTHS_PER_YEAR)
	return {
		...averager,
		months,
		climate:
			completeYears(months).length >= CLIMATE_YEARS
				? null
				: (climate ?? averager.climate),
	}
}

function merge({ averager, months, years }: GcmAverageMerge): void {
	averager.months = mergeMonths({
		months: averager.months,
		incoming: months,
		limit: HISTORY_MONTHS,
	})
	averager.years = years
	dropSavedClimate(averager)
}

function mergeMonths({
	months,
	incoming,
	limit,
}: GcmMonthMerge): GcmMonthlyMean[] {
	const history = new Map(
		months.map((month) => [`${month.year}/${month.month}`, month]),
	)
	for (const month of incoming)
		history.set(`${month.year}/${month.month}`, month)
	return [...history.values()]
		.sort((a, b) => a.year - b.year || a.month - b.month)
		.slice(-limit)
}

function completeYears(
	months: ReadonlyArray<GcmMonthlyMean>,
): GcmMonthlyMean[][] {
	const grouped = new Map<number, GcmMonthlyMean[]>()
	for (const month of months) {
		const year = grouped.get(month.year) ?? []
		year.push(month)
		grouped.set(month.year, year)
	}
	return [...grouped.values()]
		.filter(
			(year) =>
				year.length === MONTHS_PER_YEAR &&
				new Set(year.map((month) => month.month)).size === MONTHS_PER_YEAR,
		)
		.sort((a, b) => a[0].year - b[0].year)
		.slice(-CLIMATE_YEARS)
}

function monthlyMean(years: ReadonlyArray<GcmMonthlyMean[]>): GcmMonthlyMean[] {
	return [...Array(MONTHS_PER_YEAR).keys()].map((index) => {
		const samples = years.map(
			(year) =>
				year.find((month) => month.month === index + 1) as GcmMonthlyMean,
		)
		const last = samples[samples.length - 1]
		const sum = new Float64Array(last.snapshot.values.length)
		for (const sample of samples)
			for (let field = 0; field < sum.length; field++)
				sum[field] += sample.snapshot.values[field]
		const snapshot = {
			...last.snapshot,
			values: Float32Array.from(sum, (value) => value / samples.length),
		}
		return { ...last, snapshot }
	})
}

// The saved climatology covers the years the live window lost, so it carries
// the window's remaining weight.
function mergeClimate({
	stored,
	live,
	liveYears,
	olderYears,
}: GcmClimateMerge): GcmMonthlyMean[] {
	const total = liveYears + olderYears
	return live.map((month, index) => {
		const values = month.snapshot.values
		const older = stored.months[index].snapshot.values
		const merged = new Float32Array(values.length)
		for (let field = 0; field < merged.length; field++)
			merged[field] =
				(values[field] * liveYears + older[field] * olderYears) / total
		return {
			...month,
			snapshot: { ...month.snapshot, values: merged },
		}
	})
}

// Older months dropped at save time can never come back, so the saved
// climatology stands in until the live months have covered its years.
function dropSavedClimate(averager: GcmAverager): void {
	if (
		averager.climate &&
		completeYears(averager.months).length >= CLIMATE_YEARS
	)
		averager.climate = null
}

function climatology(averager: GcmAverager): GcmClimatology {
	const stored = averager.climate
	const years = completeYears(averager.months)
	const cached = climateCache.get(averager)?.climate
	if (!years.length)
		return stored ?? (cached?.years === 0 ? cached : { months: [], years: 0 })
	const lastYear = years[years.length - 1]
	const lastMonth = lastYear.find(
		(month) => month.month === MONTHS_PER_YEAR,
	) as GcmMonthlyMean
	const olderYears = stored
		? Math.min(stored.years, CLIMATE_YEARS - years.length)
		: 0
	const total = years.length + olderYears
	if (
		cached?.years === total &&
		cached.months[MONTHS_PER_YEAR - 1]?.snapshot.step ===
			lastMonth.snapshot.step &&
		cached.months[0].year === lastMonth.year
	)
		return cached
	const live = monthlyMean(years)
	return {
		months:
			stored && olderYears > 0
				? mergeClimate({ stored, live, liveYears: years.length, olderYears })
				: live,
		years: total,
	}
}

function averages({ averager, config }: GcmAveragesRequest): GcmAverageState {
	const climate = climatology(averager)
	let cached = climateCache.get(averager)
	if (cached?.climate !== climate || cached.config !== config) {
		cached = {
			climate,
			config,
			pasta: GCM_CLASSIFICATION.classes({
				config,
				months: climate.months,
				downscale: null,
				scheme: "pasta",
			}),
			koppen: GCM_CLASSIFICATION.classes({
				config,
				months: climate.months,
				downscale: null,
				scheme: "koppen",
			}),
		}
		climateCache.set(averager, cached)
	}
	return {
		months: averager.months.slice(-MONTHS_PER_YEAR),
		climateMonths: climate.months,
		climateYears: climate.years,
		years: averager.years,
		annual: annual(averager),
		pasta: cached.pasta,
		koppen: cached.koppen,
	}
}
