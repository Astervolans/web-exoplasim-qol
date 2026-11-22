import { CALENDAR } from "@/model/climate/gcm/calendar"
import { GCM_GRID } from "@/model/climate/gcm/grid"
import type {
	GcmFieldSpec,
	GcmTableValues,
} from "@/model/climate/gcm/layout/types"
import type {
	GcmOceanCurrentConstants,
	GcmOceanCurrentConstantsRequest,
	GcmOceanTablesRequest,
	GcmOceanTransport,
	GcmOceanTransportRequest,
} from "@/model/climate/gcm/physics/ocean/types"
import currentCode from "@/model/climate/gcm/physics/ocean/wgsl/current.wgsl?raw"
import oceanstepCode from "@/model/climate/gcm/physics/ocean/wgsl/oceanstep.wgsl?raw"
import transportCode from "@/model/climate/gcm/physics/ocean/wgsl/transport.wgsl?raw"

// oceanmod.f90's PLARAD parameter: the diffusivity's metric uses the Earth
// radius whatever the planet's, exactly as the Fortran's mixed-layer scheme
// does.
const PLARAD = 6.371e6
// Sea water's density, for the wind-driven transport.
const RHO = 1030
// The explicit Laplacian's stability factor: CFL = 2 K Δτ / Δx² stays at or
// below this, which keeps the highest resolved wave from alternating sign.
const TARGET_CFL = 0.5
// The Coriolis parameter is held at its TAPER_DEGREES value: the Ekman drift
// divides by f, which vanishes at the equator.
const TAPER_DEGREES = 5
// The map's display range saturates long before this, but the value keeps a
// pathological wind field from publishing absurd numbers.
const MAX_SPEED = 0.5

// oceanmod's slab: SST, mixed-layer depth, land mask, flux correction and
// the SST climatology. ysst_old is the second slot the transport's Jacobi
// sub-steps alternate with; ocean_u and ocean_v are the wind-driven surface
// current, which exists only on the GPU engine.
function fields(): GcmFieldSpec[] {
	return [
		...["ysst", "ymld", "yls", "yfldo", "yclsst2"].map((name) => ({
			name,
			shape: "grid" as const,
			count: 1,
		})),
		{ name: "ysst_old", shape: "grid", count: 1 },
		...["ocean_u", "ocean_v"].map((name) => ({
			name,
			shape: "grid" as const,
			count: 1,
		})),
		{ name: "yclsst", shape: "grid", count: CALENDAR.CLIMATOLOGY_MONTHS },
	]
}

// oceanini's metric: cos(latitude), the cosine at each row's north and south
// edges (from the cumulative Gaussian weights), the row latitude in radians,
// and the row's Δsin(latitude).
function tables({ grid }: GcmOceanTablesRequest): GcmTableValues {
	const rows = grid.latitudes
	const edges = new Float64Array(rows + 1)
	edges[0] = 1
	for (let row = 0; row < rows; row++)
		edges[row + 1] = edges[row] - grid.latitudeWeights[row]
	const cosRow = new Float64Array(rows)
	const cosNorth = new Float64Array(rows)
	const cosSouth = new Float64Array(rows)
	const phiRow = new Float64Array(rows)
	const dmuRow = new Float64Array(rows)
	const cosine = (sine: number) => Math.sqrt(Math.max(0, 1 - sine * sine))
	for (let row = 0; row < rows; row++) {
		cosRow[row] = cosine(grid.latitudeSines[row])
		cosNorth[row] = cosine(edges[row])
		cosSouth[row] = cosine(edges[row + 1])
		phiRow[row] = Math.asin(grid.latitudeSines[row])
		dmuRow[row] = edges[row] - edges[row + 1]
	}
	return {
		ocean_cos_row: cosRow,
		ocean_cos_north: cosNorth,
		ocean_cos_south: cosSouth,
		ocean_phi_row: phiRow,
		ocean_dmu_row: dmuRow,
	}
}

// hdiffo's sub-step count: the narrowest cell (the row nearest a pole) sets
// the explicit limit, and an even count brings the last sub-step back to ysst.
function transport({
	diffusivity,
	stepSeconds,
	dimensions,
}: GcmOceanTransportRequest): GcmOceanTransport | null {
	if (!(diffusivity > 0) || !(stepSeconds > 0)) return null
	const grid = GCM_GRID.forLatitudes(dimensions.latitudes)
	const dlam = (2 * Math.PI) / grid.longitudes
	let narrowest = Number.POSITIVE_INFINITY
	for (let row = 0; row < grid.latitudes; row++) {
		const sine = grid.latitudeSines[row]
		narrowest = Math.min(narrowest, PLARAD * dlam * Math.sqrt(1 - sine * sine))
		if (row > 0)
			narrowest = Math.min(
				narrowest,
				PLARAD * (Math.asin(grid.latitudeSines[row - 1]) - Math.asin(sine)),
			)
	}
	const tauSeconds = (TARGET_CFL * narrowest * narrowest) / (2 * diffusivity)
	const wanted = Math.max(1, Math.ceil(stepSeconds / tauSeconds))
	const steps = wanted + (wanted % 2)
	return { steps, tauSeconds: stepSeconds / steps }
}

// The current kernel's overrides. F_MIN holds the Coriolis parameter at its
// TAPER_DEGREES value, so the equatorial drift stays finite instead of
// dividing by zero.
function currentConstants({
	omega,
}: GcmOceanCurrentConstantsRequest): GcmOceanCurrentConstants {
	return {
		OMEGA: omega,
		RHO,
		F_MIN: 2 * omega * Math.sin((TAPER_DEGREES * Math.PI) / 180),
		MAX_SPEED,
	}
}

export const OCEAN = {
	currentConstants,
	fields,
	PLARAD,
	tables,
	transport,
	CODE: oceanstepCode,
	TRANSPORT_CODE: transportCode,
	CURRENT_CODE: currentCode,
}
