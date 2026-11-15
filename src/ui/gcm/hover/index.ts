import { GCM_CLASSIFICATION } from "@/model/climate/gcm/classification"
import { GCM_DISPLAY } from "@/ui/gcm/field-display"
import { GCM_FIELD_SAMPLE } from "@/ui/gcm/field-sample"
import type {
	GcmHoverMonthlyRequest,
	GcmHoverMonthlyValue,
	GcmHoverRequest,
	GcmHoverRow,
} from "@/ui/gcm/hover/types"
import { COORDINATES } from "@/ui/genesis/shared/coordinates"
import { rgbToCss } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

function rows({ point, layer, unitSystem }: GcmHoverRequest): GcmHoverRow[] {
	const [latitude, longitude] = COORDINATES.format(point)
	const value = GCM_FIELD_SAMPLE.value({ layer, point })
	const field =
		layer.kind === "terrain"
			? {
					label: I18N.t("Elevation"),
					value: `${Math.round(value).toLocaleString()} m`,
				}
			: layer.kind === "field" || layer.kind === "downscaled-field"
				? {
						label: GCM_DISPLAY.label(layer.mode),
						value: GCM_DISPLAY.format({ mode: layer.mode, value, unitSystem }),
					}
				: {
						label: GCM_CLASSIFICATION.definition(layer.scheme).label,
						value: GCM_CLASSIFICATION.definition(layer.scheme).name(value),
					}
	return [
		{
			label: I18N.t("Lat"),
			value: latitude,
		},
		{
			label: I18N.t("Lon"),
			value: longitude,
		},
		field,
	]
}

function monthly({
	point,
	months,
	unitSystem,
}: GcmHoverMonthlyRequest): GcmHoverMonthlyValue[] {
	return months.flatMap(({ month, year, layer }) => {
		if (layer.kind !== "field" && layer.kind !== "downscaled-field") return []
		const value = GCM_FIELD_SAMPLE.value({ layer, point })
		if (!Number.isFinite(value)) return []
		const formatted = GCM_DISPLAY.format({
			mode: layer.mode,
			value,
			unitSystem,
		})
		if (formatted === I18N.t("Unavailable")) return []
		return [
			{
				month,
				year,
				value,
				formatted,
				color: rgbToCss(GCM_DISPLAY.color({ mode: layer.mode, value })),
			},
		]
	})
}

export const GCM_HOVER = { rows, monthly }
