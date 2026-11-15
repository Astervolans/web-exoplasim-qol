import { GCM_TERRAIN_ORIENTATION } from "@/model/climate/gcm/terrain/orientation"
import type { GcmTerrainOrientation } from "@/model/climate/gcm/terrain/orientation/types"
import type {
	GcmMapProjection,
	GcmMapProjectionRequest,
	GcmMapResampleRequest,
} from "@/ui/gcm/map-orientation/types"

const RADIANS_PER_DEGREE = Math.PI / 180
const DEGREES_PER_RADIAN = 180 / Math.PI
// Orientations are replaced when the terrain changes, so old projections
// become unreachable. Animation reuses one orientation for many layers.
const projections = new WeakMap<
	GcmTerrainOrientation,
	Map<string, GcmMapProjection>
>()

// Where each imported-frame pixel lands in the model frame, in raster pixels.
// Building this is the expensive part of re-sampling, so it is cached per
// orientation and raster size.
function projection({
	orientation,
	width,
	height,
}: GcmMapProjectionRequest): GcmMapProjection {
	const key = `${width}x${height}`
	let sizes = projections.get(orientation)
	if (!sizes) {
		sizes = new Map()
		projections.set(orientation, sizes)
	}
	const cached = sizes.get(key)
	if (cached) return cached
	const u = new Float32Array(width * height)
	const v = new Float32Array(width * height)
	const m = GCM_TERRAIN_ORIENTATION.rotation(orientation).matrix
	for (let y = 0; y < height; y++) {
		const mapLatitude = (90 - ((y + 0.5) / height) * 180) * RADIANS_PER_DEGREE
		const rowCosine = Math.cos(mapLatitude)
		const rowSine = Math.sin(mapLatitude)
		for (let x = 0; x < width; x++) {
			const mapLongitude =
				(-180 + ((x + 0.5) / width) * 360) * RADIANS_PER_DEGREE
			const mapX = rowCosine * Math.cos(mapLongitude)
			const mapY = rowCosine * Math.sin(mapLongitude)
			const mapZ = rowSine
			const modelX = m[0] * mapX + m[1] * mapY + m[2] * mapZ
			const modelY = m[3] * mapX + m[4] * mapY + m[5] * mapZ
			const modelZ = m[6] * mapX + m[7] * mapY + m[8] * mapZ
			const latitude =
				Math.asin(Math.max(-1, Math.min(1, modelZ))) * DEGREES_PER_RADIAN
			const longitude = Math.atan2(modelY, modelX) * DEGREES_PER_RADIAN
			const index = y * width + x
			u[index] = ((longitude + 180) / 360) * width - 0.5
			v[index] = ((90 - latitude) / 180) * height - 0.5
		}
	}
	const built = { u, v }
	sizes.set(key, built)
	return built
}

// Re-samples an equirectangular model-frame raster into the imported map's
// coordinates: each output pixel reads the model raster where it lands.
function resample({
	orientation,
	width,
	height,
	source,
	nearest,
}: GcmMapResampleRequest): Uint8ClampedArray {
	const target = new Uint8ClampedArray(width * height * 4)
	if (width === 0 || height === 0) return target
	const { u, v } = projection({ orientation, width, height })
	for (let index = 0; index < width * height; index++) {
		const u0 = u[index]
		const v0 = v[index]
		const offset = index * 4
		if (nearest) {
			const sampleX = ((Math.round(u0) % width) + width) % width
			const sampleY = Math.max(0, Math.min(height - 1, Math.round(v0)))
			const sampleOffset = (sampleY * width + sampleX) * 4
			target[offset] = source[sampleOffset]
			target[offset + 1] = source[sampleOffset + 1]
			target[offset + 2] = source[sampleOffset + 2]
			target[offset + 3] = source[sampleOffset + 3]
			continue
		}
		const x0 = Math.floor(u0)
		const y0 = Math.floor(v0)
		const fx = u0 - x0
		const fy = v0 - y0
		const left = ((x0 % width) + width) % width
		const right = (left + 1) % width
		const top = Math.max(0, Math.min(height - 1, y0))
		const bottom = Math.max(0, Math.min(height - 1, y0 + 1))
		const topLeft = (top * width + left) * 4
		const topRight = (top * width + right) * 4
		const bottomLeft = (bottom * width + left) * 4
		const bottomRight = (bottom * width + right) * 4
		for (let channel = 0; channel < 4; channel++) {
			target[offset + channel] =
				source[topLeft + channel] * (1 - fx) * (1 - fy) +
				source[topRight + channel] * fx * (1 - fy) +
				source[bottomLeft + channel] * (1 - fx) * fy +
				source[bottomRight + channel] * fx * fy
		}
	}
	return target
}

export const GCM_MAP_ORIENTATION = { resample }
