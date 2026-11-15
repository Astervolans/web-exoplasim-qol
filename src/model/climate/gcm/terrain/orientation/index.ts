import type {
	GcmTerrainDirection,
	GcmTerrainOrientation,
	GcmTerrainPointRequest,
	GcmTerrainRotation,
	GcmTerrainTangent,
	GcmTerrainTangentRequest,
	GcmTerrainVector,
} from "@/model/climate/gcm/terrain/orientation/types"

const RADIANS_PER_DEGREE = Math.PI / 180
const DEGREES_PER_RADIAN = 180 / Math.PI
const IDENTITY_TOLERANCE = 1e-12

// The imported map's north pole sits on the model's north pole and longitudes
// line up, so the raster is used exactly as read.
const DEFAULT: GcmTerrainOrientation = {
	poleLatitudeDeg: 90,
	poleLongitudeDeg: 0,
	spinDeg: 0,
}

function wrapDegrees(value: number): number {
	return ((value % 360) + 360) % 360
}

function clampUnit(value: number): number {
	return Math.max(-1, Math.min(1, value))
}

function vector({
	latitude,
	longitude,
}: GcmTerrainDirection): GcmTerrainVector {
	const phi = latitude * RADIANS_PER_DEGREE
	const lambda = longitude * RADIANS_PER_DEGREE
	const cosPhi = Math.cos(phi)
	return {
		x: cosPhi * Math.cos(lambda),
		y: cosPhi * Math.sin(lambda),
		z: Math.sin(phi),
	}
}

function direction({ x, y, z }: GcmTerrainVector): GcmTerrainDirection {
	return {
		latitude: Math.asin(clampUnit(z)) * DEGREES_PER_RADIAN,
		longitude: wrapDegrees(Math.atan2(y, x) * DEGREES_PER_RADIAN),
	}
}

function validate(orientation: GcmTerrainOrientation): GcmTerrainOrientation {
	if (!orientation) throw new Error("Terrain orientation is missing")
	const { poleLatitudeDeg, poleLongitudeDeg, spinDeg } = orientation
	if (
		!Number.isFinite(poleLatitudeDeg) ||
		poleLatitudeDeg < -90 ||
		poleLatitudeDeg > 90 ||
		!Number.isFinite(poleLongitudeDeg) ||
		!Number.isFinite(spinDeg)
	)
		throw new Error(
			"Terrain orientation needs a pole latitude from -90° to 90° and finite longitude and spin angles",
		)
	return {
		poleLatitudeDeg,
		// On the model's own axis the pole has no longitude; spin alone turns the map.
		poleLongitudeDeg:
			Math.abs(poleLatitudeDeg) === 90 ? 0 : wrapDegrees(poleLongitudeDeg),
		spinDeg: wrapDegrees(spinDeg),
	}
}

// Rz(poleLongitude) Ry(90° - poleLatitude) Rz(spin), mapping the imported
// map's coordinates to the model's coordinates.
function rotation(orientation: GcmTerrainOrientation): GcmTerrainRotation {
	const { poleLatitudeDeg, poleLongitudeDeg, spinDeg } = validate(orientation)
	const pole = poleLatitudeDeg * RADIANS_PER_DEGREE
	const longitude = poleLongitudeDeg * RADIANS_PER_DEGREE
	const spin = spinDeg * RADIANS_PER_DEGREE
	const cosLongitude = Math.cos(longitude)
	const sinLongitude = Math.sin(longitude)
	const cosTilt = Math.sin(pole)
	const sinTilt = Math.cos(pole)
	const cosSpin = Math.cos(spin)
	const sinSpin = Math.sin(spin)
	const matrix = new Float64Array(9)
	matrix[0] = cosLongitude * cosTilt * cosSpin - sinLongitude * sinSpin
	matrix[1] = -cosLongitude * cosTilt * sinSpin - sinLongitude * cosSpin
	matrix[2] = cosLongitude * sinTilt
	matrix[3] = sinLongitude * cosTilt * cosSpin + cosLongitude * sinSpin
	matrix[4] = -sinLongitude * cosTilt * sinSpin + cosLongitude * cosSpin
	matrix[5] = sinLongitude * sinTilt
	matrix[6] = -sinTilt * cosSpin
	matrix[7] = sinTilt * sinSpin
	matrix[8] = cosTilt
	return { matrix }
}

function isIdentity({ matrix }: GcmTerrainRotation): boolean {
	return (
		Math.abs(matrix[0] - 1) <= IDENTITY_TOLERANCE &&
		Math.abs(matrix[1]) <= IDENTITY_TOLERANCE &&
		Math.abs(matrix[2]) <= IDENTITY_TOLERANCE &&
		Math.abs(matrix[3]) <= IDENTITY_TOLERANCE &&
		Math.abs(matrix[4] - 1) <= IDENTITY_TOLERANCE &&
		Math.abs(matrix[5]) <= IDENTITY_TOLERANCE &&
		Math.abs(matrix[6]) <= IDENTITY_TOLERANCE &&
		Math.abs(matrix[7]) <= IDENTITY_TOLERANCE &&
		Math.abs(matrix[8] - 1) <= IDENTITY_TOLERANCE
	)
}

function toModel({
	rotation,
	latitude,
	longitude,
}: GcmTerrainPointRequest): GcmTerrainDirection {
	const source = vector({ latitude, longitude })
	const m = rotation.matrix
	return direction({
		x: m[0] * source.x + m[1] * source.y + m[2] * source.z,
		y: m[3] * source.x + m[4] * source.y + m[5] * source.z,
		z: m[6] * source.x + m[7] * source.y + m[8] * source.z,
	})
}

function toSource({
	rotation,
	latitude,
	longitude,
}: GcmTerrainPointRequest): GcmTerrainDirection {
	const model = vector({ latitude, longitude })
	const m = rotation.matrix
	return direction({
		x: m[0] * model.x + m[3] * model.y + m[6] * model.z,
		y: m[1] * model.x + m[4] * model.y + m[7] * model.z,
		z: m[2] * model.x + m[5] * model.y + m[8] * model.z,
	})
}

// East/north components of a model-frame tangent, expressed in the imported
// map's east/north frame at the same place on the sphere.
function toSourceTangent({
	rotation,
	latitude,
	longitude,
	u,
	v,
}: GcmTerrainTangentRequest): GcmTerrainTangent {
	const model = vector({ latitude, longitude })
	const phi = latitude * RADIANS_PER_DEGREE
	const lambda = longitude * RADIANS_PER_DEGREE
	const cosPhi = Math.cos(phi)
	const sinPhi = Math.sin(phi)
	const cosLambda = Math.cos(lambda)
	const sinLambda = Math.sin(lambda)
	const tangent = {
		x: u * -sinLambda + v * -sinPhi * cosLambda,
		y: u * cosLambda + v * -sinPhi * sinLambda,
		z: v * cosPhi,
	}
	const m = rotation.matrix
	const point = direction({
		x: m[0] * model.x + m[3] * model.y + m[6] * model.z,
		y: m[1] * model.x + m[4] * model.y + m[7] * model.z,
		z: m[2] * model.x + m[5] * model.y + m[8] * model.z,
	})
	const source = {
		x: m[0] * tangent.x + m[3] * tangent.y + m[6] * tangent.z,
		y: m[1] * tangent.x + m[4] * tangent.y + m[7] * tangent.z,
		z: m[2] * tangent.x + m[5] * tangent.y + m[8] * tangent.z,
	}
	const sourcePhi = point.latitude * RADIANS_PER_DEGREE
	const sourceLambda = point.longitude * RADIANS_PER_DEGREE
	const cosSourcePhi = Math.cos(sourcePhi)
	const sinSourcePhi = Math.sin(sourcePhi)
	const cosSourceLambda = Math.cos(sourceLambda)
	const sinSourceLambda = Math.sin(sourceLambda)
	return {
		latitude: point.latitude,
		longitude: point.longitude,
		u: source.x * -sinSourceLambda + source.y * cosSourceLambda,
		v:
			source.x * (-sinSourcePhi * cosSourceLambda) +
			source.y * (-sinSourcePhi * sinSourceLambda) +
			source.z * cosSourcePhi,
	}
}

export const GCM_TERRAIN_ORIENTATION = {
	DEFAULT,
	validate,
	rotation,
	isIdentity,
	toModel,
	toSource,
	toSourceTangent,
}
