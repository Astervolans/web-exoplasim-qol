import { GCM_AVERAGES } from "@/model/climate/gcm/averages"
import type {
	GcmCheckpoint,
	GcmCheckpointArray,
	GcmCheckpointMeta,
	GcmCheckpointSizeRequest,
} from "@/model/climate/gcm/checkpoint/types"
import { GCM_FIELDS } from "@/model/climate/gcm/fields"
import { GCM_GRID } from "@/model/climate/gcm/grid"
import type { GcmEngine } from "@/model/climate/gcm/runner/types"
import { GCM_TARGETING } from "@/model/climate/gcm/targeting"
import { GCM_TERRAIN } from "@/model/climate/gcm/terrain"

// File layout: magic, uint32 header length, JSON header, uint32 array bytes,
// terrain and diagnostic arrays, then the unchanged plasim_status restart file.
const MAGIC = "EXOPLASIM-CHECKPOINT\n"
const FORMATS: Record<GcmEngine, number> = { cpu: 24, gpu: 25 }
const GPU_PRECISION_BYTES = 4
const HEADER_LENGTH_BYTES = 4
// Measured JSON headers run 51-56 KB at T63 with 132 monthly means and up to
// 232 years of annual balances. Over-estimating only warns earlier.
const HEADER_ESTIMATE_BYTES = 64 * 1024

function serialize({
	meta,
	restart,
	diagnostics,
	terrain,
}: GcmCheckpoint): Uint8Array<ArrayBuffer>[] {
	const magic = new TextEncoder().encode(MAGIC)
	const arrays: Uint8Array<ArrayBuffer>[] = []
	let arrayBytes = 0
	const header = new TextEncoder().encode(
		JSON.stringify({ meta, diagnostics, terrain }, (...[, value]) => {
			if (value instanceof Float32Array || value instanceof Float64Array) {
				const descriptor: GcmCheckpointArray = {
					array:
						value instanceof Float32Array ? "Float32Array" : "Float64Array",
					offset: arrayBytes,
					bytes: value.byteLength,
				}
				arrays.push(
					new Uint8Array(
						// Saved fields always wrap a plain ArrayBuffer.
						value.buffer as ArrayBuffer,
						value.byteOffset,
						value.byteLength,
					),
				)
				arrayBytes += value.byteLength
				return descriptor
			}
			return value
		}),
	)
	const prefix = new Uint8Array(
		magic.length + HEADER_LENGTH_BYTES + header.length,
	)
	prefix.set(magic, 0)
	new DataView(prefix.buffer).setUint32(magic.length, header.length, true)
	prefix.set(header, magic.length + HEADER_LENGTH_BYTES)
	const lengths = new Uint8Array(HEADER_LENGTH_BYTES)
	new DataView(lengths.buffer).setUint32(0, arrayBytes, true)
	return [prefix, lengths, ...arrays, new Uint8Array(restart)]
}

function encode(checkpoint: GcmCheckpoint): ArrayBuffer {
	const pieces = serialize(checkpoint)
	const bytes = new Uint8Array(
		pieces.reduce((total, piece) => total + piece.byteLength, 0),
	)
	let offset = 0
	for (const piece of pieces) {
		bytes.set(piece, offset)
		offset += piece.byteLength
	}
	return bytes.buffer
}

function size(checkpoint: GcmCheckpoint): number {
	return serialize(checkpoint).reduce(
		(total, piece) => total + piece.byteLength,
		0,
	)
}

// Blob parts are copied once into browser-managed storage, so a large export
// never needs a second buffer its own size.
function blob(checkpoint: GcmCheckpoint): Blob {
	return new Blob(serialize(checkpoint))
}

// What a save of this resolution and history length will come to, for the
// panel's estimate and its memory warning.
function estimate({
	config,
	terrain,
	historyYears,
	restartBytes,
}: GcmCheckpointSizeRequest): number {
	const points = GCM_GRID.forTruncation(config.truncation).points
	const snapshot = points * GCM_FIELDS.fieldCount(config.layers) * 4
	const years = Math.max(
		1,
		Math.min(historyYears, GCM_AVERAGES.MAX_HISTORY_YEARS),
	)
	const monthlyMeans = years * GCM_AVERAGES.MONTHS_PER_YEAR
	const climate =
		years >= GCM_AVERAGES.CLIMATE_YEARS ? 0 : GCM_AVERAGES.MONTHS_PER_YEAR
	return (
		HEADER_ESTIMATE_BYTES +
		terrain.width * terrain.height * 8 +
		(monthlyMeans + climate) * snapshot +
		// The live snapshot, the open month's last sample, and its Float64 sum.
		4 * snapshot +
		(restartBytes ?? 0)
	)
}

function decode(buffer: ArrayBuffer): GcmCheckpoint {
	const magic = new TextEncoder().encode(MAGIC)
	const bytes = new Uint8Array(buffer)
	if (new TextDecoder().decode(bytes.subarray(0, magic.length)) !== MAGIC) {
		throw new Error("Not an ExoPlaSim checkpoint file")
	}
	if (buffer.byteLength < magic.length + HEADER_LENGTH_BYTES) {
		throw new Error("Truncated ExoPlaSim checkpoint")
	}
	const headerLength = new DataView(buffer).getUint32(magic.length, true)
	const headerStart = magic.length + HEADER_LENGTH_BYTES
	const headerEnd = headerStart + headerLength
	if (headerEnd + HEADER_LENGTH_BYTES > buffer.byteLength) {
		throw new Error("Truncated ExoPlaSim checkpoint")
	}
	const header = new TextDecoder().decode(
		bytes.subarray(headerStart, headerEnd),
	)
	const parsed = JSON.parse(header)
	const meta = parsed.meta as GcmCheckpointMeta
	if (!Object.values(FORMATS).includes(meta.format)) {
		throw new Error(
			`Unsupported checkpoint format ${meta.format}. Format ${FORMATS.cpu} (CPU) or ${FORMATS.gpu} (GPU) is required.`,
		)
	}
	const arrayBytes = new DataView(buffer).getUint32(headerEnd, true)
	const arrayStart = headerEnd + HEADER_LENGTH_BYTES
	const restartStart = arrayStart + arrayBytes
	if (restartStart >= buffer.byteLength)
		throw new Error("Truncated ExoPlaSim checkpoint")
	const { diagnostics, terrain } = JSON.parse(header, (...[, value]) => {
		if (value?.array === "Float32Array" || value?.array === "Float64Array") {
			const descriptor = value as GcmCheckpointArray
			if (
				!Number.isInteger(descriptor.offset) ||
				!Number.isInteger(descriptor.bytes) ||
				descriptor.offset < 0 ||
				descriptor.bytes < 0 ||
				descriptor.offset + descriptor.bytes > arrayBytes
			) {
				throw new Error("Invalid checkpoint diagnostic array")
			}
			const data = buffer.slice(
				arrayStart + descriptor.offset,
				arrayStart + descriptor.offset + descriptor.bytes,
			)
			return descriptor.array === "Float32Array"
				? new Float32Array(data)
				: new Float64Array(data)
		}
		return value
	}) as GcmCheckpoint
	if (meta.config.layers !== 5 && meta.config.layers !== 10)
		throw new Error("Invalid checkpoint atmospheric layer count")
	if (meta.config.targetTemperatureK !== null)
		GCM_TARGETING.validate({
			config: meta.config,
			state: diagnostics.targeting,
		})
	const averager = diagnostics.averager
	const climate = averager.climate ?? null
	if (
		climate &&
		(!Number.isInteger(climate.years) ||
			climate.years < 1 ||
			climate.years > GCM_AVERAGES.CLIMATE_YEARS ||
			climate.months.length !== GCM_AVERAGES.MONTHS_PER_YEAR)
	)
		throw new Error("Invalid checkpoint climatology")
	const snapshots = [
		diagnostics.snapshot,
		...averager.months.map((month) => month.snapshot),
		...(averager.current ? [averager.current.last] : []),
		...(climate ? climate.months.map((month) => month.snapshot) : []),
	]
	const points = GCM_GRID.forTruncation(meta.config.truncation).points
	const expectedValues = points * GCM_FIELDS.fieldCount(meta.config.layers)
	if (
		snapshots.some(
			(snapshot) =>
				snapshot.layers !== meta.config.layers ||
				snapshot.values.length !== expectedValues,
		) ||
		(averager.current && averager.current.sum.length !== expectedValues)
	)
		throw new Error(
			"Checkpoint diagnostics do not match the saved model resolution and atmospheric layers",
		)
	return {
		meta,
		diagnostics: { ...diagnostics, averager: { ...averager, climate } },
		terrain: GCM_TERRAIN.validate(terrain),
		restart: buffer.slice(restartStart),
	}
}

function engine(meta: GcmCheckpointMeta): GcmEngine {
	return meta.format === FORMATS.gpu ? "gpu" : "cpu"
}

function fileName(meta: GcmCheckpointMeta): string {
	const { year, month } = meta.date
	return `exoplasim-t${meta.config.truncation}-layers${meta.config.layers}-year${String(year).padStart(4, "0")}-month${String(month).padStart(2, "0")}.ckpt`
}

export const GCM_CHECKPOINT = {
	FORMATS,
	GPU_PRECISION_BYTES,
	engine,
	encode,
	blob,
	size,
	estimate,
	decode,
	fileName,
}
