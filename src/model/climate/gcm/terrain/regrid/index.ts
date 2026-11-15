import { GCM_TERRAIN_ORIENTATION } from "@/model/climate/gcm/terrain/orientation"
import type {
	GcmTerrainCell,
	GcmTerrainCellRequest,
} from "@/model/climate/gcm/terrain/regrid/types"

// Rotated cells are integrated with at most 16 samples per axis, which keeps
// them close to the aligned path's cost while still sampling near the source
// raster's own pixel spacing.
const MIN_AXIS_SAMPLES = 2
const MAX_AXIS_SAMPLES = 16
const DEGREES_PER_RADIAN = Math.PI / 180

function alignedCell({
	terrain,
	north,
	south,
	west,
	east,
}: GcmTerrainCellRequest): GcmTerrainCell {
	const { width, height, elevationM, land } = terrain
	const top = ((90 - north) * height) / 180
	const bottom = ((90 - south) * height) / 180
	const left = ((west + 180) * width) / 360
	const right = ((east + 180) * width) / 360
	let area = 0
	let landArea = 0
	let elevationSum = 0
	for (
		let y = Math.max(0, Math.floor(top));
		y < Math.ceil(bottom) && y < height;
		y++
	) {
		const pixelNorth = 90 - (Math.max(top, y) * 180) / height
		const pixelSouth = 90 - (Math.min(bottom, y + 1) * 180) / height
		const latitudeWeight =
			Math.sin((pixelNorth * Math.PI) / 180) -
			Math.sin((pixelSouth * Math.PI) / 180)
		for (let x = Math.floor(left); x < Math.ceil(right); x++) {
			const weight =
				latitudeWeight * (Math.min(right, x + 1) - Math.max(left, x))
			const i = y * width + (((x % width) + width) % width)
			area += weight
			landArea += weight * land[i]
			elevationSum += weight * land[i] * elevationM[i]
		}
	}
	return {
		landFraction: Math.min(1, Math.max(0, landArea / area)),
		elevationM: elevationSum / area,
	}
}

function rotatedCell({
	terrain,
	rotation,
	north,
	south,
	west,
	east,
}: GcmTerrainCellRequest): GcmTerrainCell {
	const { width, height, elevationM, land } = terrain
	const pixelDegrees = 180 / height
	const latitudeSpan = north - south
	const longitudeSpan = east - west
	const rows = Math.min(
		MAX_AXIS_SAMPLES,
		Math.max(MIN_AXIS_SAMPLES, Math.ceil(latitudeSpan / pixelDegrees)),
	)
	const middle = ((north + south) / 2) * DEGREES_PER_RADIAN
	const columns = Math.min(
		MAX_AXIS_SAMPLES,
		Math.max(
			MIN_AXIS_SAMPLES,
			Math.ceil((longitudeSpan * Math.cos(middle)) / pixelDegrees),
		),
	)
	let area = 0
	let landArea = 0
	let elevationSum = 0
	for (let row = 0; row < rows; row++) {
		const latitude = north - ((row + 0.5) / rows) * latitudeSpan
		const weight = Math.cos(latitude * DEGREES_PER_RADIAN)
		for (let column = 0; column < columns; column++) {
			const longitude = west + ((column + 0.5) / columns) * longitudeSpan
			const source = GCM_TERRAIN_ORIENTATION.toSource({
				rotation,
				latitude,
				longitude,
			})
			const x = ((source.longitude + 180) / 360) * width - 0.5
			const y = ((90 - source.latitude) / 180) * height - 0.5
			const x0 = Math.floor(x)
			const y0 = Math.floor(y)
			const fx = x - x0
			const fy = y - y0
			const columnA = ((x0 % width) + width) % width
			const columnB = (columnA + 1) % width
			const rowA = Math.max(0, Math.min(height - 1, y0))
			const rowB = Math.max(0, Math.min(height - 1, y0 + 1))
			const indexA = rowA * width + columnA
			const indexB = rowA * width + columnB
			const indexC = rowB * width + columnA
			const indexD = rowB * width + columnB
			const landValue =
				land[indexA] * (1 - fx) * (1 - fy) +
				land[indexB] * fx * (1 - fy) +
				land[indexC] * (1 - fx) * fy +
				land[indexD] * fx * fy
			const elevation =
				elevationM[indexA] * (1 - fx) * (1 - fy) +
				elevationM[indexB] * fx * (1 - fy) +
				elevationM[indexC] * (1 - fx) * fy +
				elevationM[indexD] * fx * fy
			area += weight
			landArea += weight * landValue
			elevationSum += weight * landValue * elevation
		}
	}
	return {
		landFraction: Math.min(1, Math.max(0, landArea / area)),
		elevationM: elevationSum / area,
	}
}

function cell(request: GcmTerrainCellRequest): GcmTerrainCell {
	return GCM_TERRAIN_ORIENTATION.isIdentity(request.rotation)
		? alignedCell(request)
		: rotatedCell(request)
}

export const GCM_TERRAIN_REGRID = { cell }
