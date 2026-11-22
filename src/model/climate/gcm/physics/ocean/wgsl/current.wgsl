override OMEGA: f32;
override RHO: f32;
override F_MIN: f32;
override MAX_SPEED: f32;

// The wind-driven surface current, as the Ekman drift of the mixed layer:
// M = (τ_y, −τ_x) / (ρ f) with f = 2 Ω sinφ, carried through a layer H deep as
// u = M / H. The Coriolis parameter is held at its F_MIN magnitude and keeps
// the hemisphere's sign, so the equatorial drift stays finite instead of
// dividing by zero. Where the ocean is a slab, this is the whole of the model's
// surface current: the wind-driven part, which carries the subtropical
// convergence and the equatorial divergence.
@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) id: vec3u) {
	let h = id.x;
	if (h >= THREADS) {
		return;
	}
	if (!(state[YLS + h] < 1.0)) {
		state[OCEAN_U + h] = 0.0;
		state[OCEAN_V + h] = 0.0;
		return;
	}
	let row = h / NLON;
	let cosrow = tables[TABLE_OCEAN_COS_ROW + row];
	let sine = sqrt(max(1.0 - cosrow * cosrow, 0.0));
	var coriolis = 2.0 * OMEGA * sine;
	if (abs(coriolis) < F_MIN) {
		coriolis = select(-F_MIN, F_MIN, sine >= 0.0);
	}
	let depth = max(state[YMLD + h], 1.0);
	let transport = 1.0 / (RHO * coriolis * depth);
	var u = state[DTAUY + h] * transport;
	var v = -state[DTAUX + h] * transport;
	let speed = sqrt(u * u + v * v);
	if (speed > MAX_SPEED) {
		let shrink = MAX_SPEED / speed;
		u = u * shrink;
		v = v * shrink;
	}
	state[OCEAN_U + h] = u;
	state[OCEAN_V + h] = v;
}