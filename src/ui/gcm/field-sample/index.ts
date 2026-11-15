import { GCM_FIELDS } from "@/model/climate/gcm/fields"
import { GCM_TERRAIN_ORIENTATION } from "@/model/climate/gcm/terrain/orientation"
import type {
	GcmFieldSampleRequest,
	GcmGridSampleRequest,
} from "@/ui/gcm/field-sample/types"
import type {
	GcmColumnLookup,
	GcmLatitudeLookup,
	GcmLongitudeLookup,
	GcmMapLayer,
} from "@/ui/gcm/types"

const RASTER_ROWS = 180
const fields = new WeakMap<GcmMapLayer, Float32Array>()

function modelColumn({ grid, column }: GcmColumnLookup): number {
	return (column + grid.longitudes / 2) % grid.longitudes
}

function rowBlend({
	grid,
	latitude,
}: GcmLatitudeLookup): [number, number, number] {
	const latitudes = grid.latitudesDeg
	if (latitude >= latitudes[0]) return [0, 0, 0]
	const last = latitudes.length - 1
	if (latitude <= latitudes[last]) return [last, last, 0]
	let row = 0
	while (latitudes[row + 1] > latitude) row++
	const t = (latitudes[row] - latitude) / (latitudes[row] - latitudes[row + 1])
	return [row, row + 1, t]
}

function columnBlend({
	grid,
	longitude,
}: GcmLongitudeLookup): [number, number, number] {
	const position = ((((longitude % 360) + 360) % 360) / 360) * grid.longitudes
	const west = Math.floor(position) % grid.longitudes
	return [west, (west + 1) % grid.longitudes, position - Math.floor(position)]
}

function sample({
	grid,
	values,
	latitude,
	longitude,
}: GcmGridSampleRequest): number {
	const [north, south, t] = rowBlend({ grid, latitude })
	const [west, east, s] = columnBlend({ grid, longitude })
	const top =
		values[north * grid.longitudes + west] * (1 - s) +
		values[north * grid.longitudes + east] * s
	const bottom =
		values[south * grid.longitudes + west] * (1 - s) +
		values[south * grid.longitudes + east] * s
	return top * (1 - t) + bottom * t
}

function value({ layer, point }: GcmFieldSampleRequest): number {
	if (layer.kind === "terrain") {
		const longitude = (((point.longitude + 180) % 360) + 360) % 360
		const column = Math.min(
			layer.terrain.width - 1,
			Math.floor((longitude / 360) * layer.terrain.width),
		)
		const row = Math.max(
			0,
			Math.min(
				layer.terrain.height - 1,
				Math.floor(((90 - point.latitude) / 180) * layer.terrain.height),
			),
		)
		return layer.terrain.elevationM[row * layer.terrain.width + column]
	}
	const rotation = GCM_TERRAIN_ORIENTATION.rotation(layer.orientation)
	const model = GCM_TERRAIN_ORIENTATION.toModel({
		rotation,
		latitude: point.latitude,
		longitude: point.longitude,
	})
	if (
		layer.kind === "downscaled-field" ||
		layer.kind === "downscaled-classes"
	) {
		const longitude = (((model.longitude + 180) % 360) + 360) % 360
		const column = Math.min(
			layer.width - 1,
			Math.floor((longitude / 360) * layer.width),
		)
		const row = Math.max(
			0,
			Math.min(
				layer.height - 1,
				Math.floor(((90 - model.latitude) / 180) * layer.height),
			),
		)
		const index = row * layer.width + column
		return layer.kind === "downscaled-field"
			? layer.values[index]
			: layer.classes[index]
	}
	const grid = GCM_FIELDS.grid(layer.snapshot)
	if (layer.kind === "classes") {
		const [north, south, t] = rowBlend({ grid, latitude: model.latitude })
		const [west, east, s] = columnBlend({ grid, longitude: model.longitude })
		return layer.classes[
			(t < 0.5 ? north : south) * grid.longitudes + (s < 0.5 ? west : east)
		]
	}
	let values = fields.get(layer)
	if (!values) {
		values = GCM_FIELDS.values(layer)
		fields.set(layer, values)
	}
	return sample({
		grid,
		values,
		latitude: model.latitude,
		longitude: model.longitude,
	})
}

export const GCM_FIELD_SAMPLE = {
	RASTER_ROWS,
	modelColumn,
	rowBlend,
	sample,
	value,
}
