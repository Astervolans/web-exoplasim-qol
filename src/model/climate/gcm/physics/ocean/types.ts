import type { GcmGrid } from "@/model/climate/gcm/grid/types"
import type { GcmDimensions } from "@/model/climate/gcm/layout/types"

export interface GcmOceanTablesRequest {
	grid: GcmGrid
}

// The mixed layer's horizontal diffusion: K (m²/s) over one coupled step,
// split into an even number of explicit sub-steps that alternate two slots.
export interface GcmOceanTransport {
	steps: number
	tauSeconds: number
}

export interface GcmOceanTransportRequest {
	diffusivity: number
	stepSeconds: number
	dimensions: GcmDimensions
}

export interface GcmOceanCurrentConstantsRequest {
	// The planet's angular velocity (rad/s), which sets the Coriolis parameter.
	omega: number
}

export interface GcmOceanCurrentConstants {
	OMEGA: number
	RHO: number
	F_MIN: number
	MAX_SPEED: number
}
