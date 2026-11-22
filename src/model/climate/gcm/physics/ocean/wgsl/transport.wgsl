override HCOND: f32;
override TAU: f32;
override DLAM: f32;
override INVR2: f32;
override SRC: u32;
override DST: u32;

// oceanmod's hdiffo: one explicit sub-step of K times the grid Laplacian on
// the mixed layer's temperature, with no flux across a land edge. SRC and DST
// are separate slots so each sub-step is a Jacobi iteration over the previous
// field; the caller alternates them.
@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) id: vec3u) {
	let h = id.x;
	if (h >= THREADS) {
		return;
	}
	let centre = state[SRC + h];
	if (!(state[YLS + h] < 1.0)) {
		state[DST + h] = centre;
		return;
	}
	let column = h % NLON;
	let base = h - column;
	let east = base + (column + 1u) % NLON;
	let west = base + (column + NLON - 1u) % NLON;
	var zonal = 0.0;
	if (state[YLS + east] < 1.0) {
		zonal = zonal + (state[SRC + east] - centre) / DLAM;
	}
	if (state[YLS + west] < 1.0) {
		zonal = zonal - (centre - state[SRC + west]) / DLAM;
	}
	let row = h / NLON;
	let cosrow = tables[TABLE_OCEAN_COS_ROW + row];
	var north = 0.0;
	if (row > 0u && state[YLS + h - NLON] < 1.0) {
		north = tables[TABLE_OCEAN_COS_NORTH + row]
			* (state[SRC + h - NLON] - centre)
			/ (tables[TABLE_OCEAN_PHI_ROW + row - 1u] - tables[TABLE_OCEAN_PHI_ROW + row]);
	}
	var south = 0.0;
	if (row + 1u < NLAT && state[YLS + h + NLON] < 1.0) {
		south = tables[TABLE_OCEAN_COS_SOUTH + row]
			* (centre - state[SRC + h + NLON])
			/ (tables[TABLE_OCEAN_PHI_ROW + row] - tables[TABLE_OCEAN_PHI_ROW + row + 1u]);
	}
	let meridional = (north - south) / tables[TABLE_OCEAN_DMU_ROW + row];
	let laplacian = (zonal / (DLAM * cosrow * cosrow) + meridional) * INVR2;
	state[DST + h] = centre + HCOND * TAU * laplacian;
}
