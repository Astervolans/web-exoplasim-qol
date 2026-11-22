# Ocean heat transport and wind-driven currents

Implemented 2026-11-21. This adds two ocean features to the WebGPU engine: horizontal heat transport in the mixed layer, and a surface-current field drawn as map arrows. Both are off by default in the sense that the model's numbers are unchanged until the panel's values move, and the current layer exists only on the GPU engine.

## 1. What was added

| Piece | Where |
| --- | --- |
| Mixed-layer diffusion kernel, one explicit sub-step | `src/model/climate/gcm/physics/ocean/wgsl/transport.wgsl` |
| Ekman current kernel | `src/model/climate/gcm/physics/ocean/wgsl/current.wgsl` |
| Sub-step count, metric tables, current constants, dispatch list | `src/model/climate/gcm/physics/ocean/index.ts`, `physics/surface/index.ts` |
| State fields `ysst_old`, `ocean_u`, `ocean_v` | `physics/ocean/index.ts` |
| Publish planes for the two current components | `snapshot/wgsl/pack.wgsl`, `snapshot/index.ts` |
| Configuration, panel controls, help | `oceanDiffusivityM2S` (0–200,000 m²/s, off by default) and `oceanCurrents` (on by default) |
| Map layer | `fields/`, `field-display.ts`, `map-mode-options.ts`, `GcmView.tsx` |
| Snapshots | `GcmSnapshot.currents`, a two-plane array after `values` |

Both features are GPU-only. The CPU engine runs the Fortran model on Wasm workers, and this checkout carries no Wasm build, so the CPU engine's ocean stays exactly as it was: the slab with no transport and no current diagnostic. The panel offers the transports and the map offers the layer only when the GPU engine is selected (`GCM_FIELDS.available`); switching to the CPU engine while the current layer is showing falls back to 2 m air temperature.

## 2. Ocean heat transport: the numerical method

A mixed layer that only absorbs and releases fluxes has no meridional heat transport. The cheapest closure that adds it is a down-gradient flux on the layer's temperature,

```
∂T/∂t = F_a + K_h ∇²T
```

which is what the Planet Simulator's mixed-layer ocean uses, with its coefficient tuned against reanalyses ([Angeloni et al. 2022](https://gmd.copernicus.org/preprints/gmd-2020-245/)). The same closure appears in energy-balance models as `F = −D ∂T/∂y` with `D` of order 0.6 W m⁻² K⁻¹ ([North 1975](https://doi.org/10.1175/1520-0469(1975)032%3C2033:TOEBCM%3E2.0.CO;2)).

On the Gaussian grid, rows running north to south, row `j` carries `cos φ_j`, `φ_j` in radians, edge cosines `cos N_j`/`cos S_j` from the cumulative Gaussian weights, and weight `Δ sin φ_j`:

```
zonal_e   = (T[i+1] - T[i]) / Δλ            if both cells are sea, else 0
zonal_w   = (T[i]   - T[i-1]) / Δλ          if both cells are sea, else 0
merid_n   = cos N_j (T[j-1] - T[j]) / (φ_{j-1} - φ_j)   if both cells are sea, else 0
merid_s   = cos S_j (T[j]   - T[j+1]) / (φ_j - φ_{j+1}) if both cells are sea, else 0

KΔt·∇²T = KΔt / a² · [ (zonal_e - zonal_w) / (Δλ cos²φ_j) + (merid_n - merid_s) / Δ sin φ_j ]
```

The polar edge cosine is zero and a coastal flux term is zero, so neither the pole nor a coastline passes heat. The zonal term's `cos²φ` metric makes the row nearest each pole the narrowest cell of the grid: 46 km at T21, 11.7 km at T42 and 5.2 km at T63, against 440/220/150 km at 45° latitude. **That polar row, not the tropics, sets the stability limit**, which is why one coefficient needs very different sub-stepping per resolution.

Explicit sub-steps. The update is a forward Euler sub-step of `KΔt∇²T`, whose CFL number `2KΔτ/Δx²` must stay at or below 0.5 at the narrowest cell. The host computes the sub-step count once per run from `K`, the coupled step and the grid, rounds it up to an even number, and dispatches that many sub-steps alternating two state slots, so each is a Jacobi iteration over the previous field and an even count leaves the answer in `ysst`. With `K = 1e5 m²/s`:

| Step | T21 | T63 |
| --- | --- | --- |
| 5 min | 2 (Δτ 150 s) | 6 (Δτ 50 s) |
| 10 min | 2 (Δτ 300 s) | 10 (Δτ 60 s) |
| 30 min | 2 (Δτ 900 s) | 28 (Δτ 64 s) |

The floor of two comes from the even rounding: at T21 the bound allows a single 1800 s sub-step. At the panel's ceiling (2e5), T63 at 30 minutes needs 54.

Conservation. The operator is a flux divergence, so the area-weighted mean is preserved by construction: every interior edge contributes `+F` to one row and `−F` to the next, and the polar and coastal edges contribute nothing. "The transport moves heat but does not create it" is therefore a property of the discretisation, and the verification below measures only its rounding.

The metric uses the Earth radius for every planet, which is what the Fortran's scheme does. The coefficient is thus defined per Earth radius: on a planet of radius `R` the effective diffusivity is `K (R / 6,371 km)²`, which the panel's help text states.

## 3. The surface current: the numerical method

The slab has no momentum equation, so the current cannot be resolved; it has to be diagnosed from what the model does carry. What the surface layer is driven by is the wind stress `τ`, which the surface-flux kernels already compute in Pa, so the diagnostic is the **Ekman drift** of the mixed layer:

```
f = 2 Ω sin φ            (held at its 5° magnitude, sign preserved)
M = (τ_y, −τ_x) / (ρ_w f)          depth-integrated transport, m²/s
u = M_x / H,  v = M_y / H          H = MLDEPTH
```

This is the classical surface Ekman transport (Ekman, *On the influence of the Earth's rotation on ocean currents*, Ark. Mat. Astron. Fys. 2, 1905; Gill, *Atmosphere–Ocean Dynamics*, Academic Press, 1982, ch. 9). It is pointwise, has no accumulation and no stability limit, and reproduces the pattern the surface wind implies:

- easterly trades at low latitudes drift poleward in each hemisphere, i.e. **divergence at the equator** (equatorial upwelling);
- westerlies at mid-latitudes drift equatorward, i.e. **convergence near 25–30°**, the subtropical gyre centre;
- the drift is strong where `f` is small, which is why the equatorial band carries the fastest arrows.

What it is not: a geostrophic current. A resolved subtropical gyre needs the wind-stress curl's Sverdrup transport, which is an elliptic/mass-continuity problem on a closed basin; the model's grid and its 50 m single layer cannot resolve the western boundary layer that closes it, and on a land-free (aquaplanet) grid the zonal integration of the wind curl has no eastern boundary to anchor it. The Sverdrup route was implemented and measured first: on the model's land-free default state the accumulated transport reaches 4 × 10⁹ m³/s (≈ 4,000 Sv, against 30 Sv for an ocean basin) and its meridional derivative produces zonal velocities of tens of m/s, because two adjacent rows accumulate independent random walks of the wind curl. That is a property of the balance, not of the implementation, and it is why the shipped diagnostic is the pointwise Ekman drift.

Magnitudes. With `ρ_w = 1030 kg/m³`, `H = 50 m` and `f` at 45° (1.03 × 10⁻⁴ s⁻¹), a 0.1 Pa stress gives `|M| = 0.94 m²/s` and 0.019 m/s. The equatorial band, where `f` is held at its 5° value, reaches 0.5 m/s for the model's strongest stresses; the kernel caps the speed at 0.5 m/s and the map's arrow length saturates at 0.05 m/s so the mid-latitude bands stay visible.

Both components are published through the snapshot as two extra planes after the model's fields, so the map's existing vector renderer draws them without new drawing code.

Reading the layer. The panel's **Ocean currents** switch is on by default and only exists on the GPU engine; the arrows are the Ekman drift of the step's wind stress, so they are only as meaningful as the wind field driving them. A fresh start begins from an isothermal atmosphere, and the panel's own spin-up estimate runs to years, so in the first days of a run the wind is still patchy and so are the currents: the banded trade and westerly structure of §3 appears as the climate settles, or immediately from a checkpoint of a spun-up run. The legend's range is 0–0.05 m/s in two decimals, because one decimal would print the top of that range as 0.1.

## 4. Verification

`node scripts/exoplasim-webgpu/verify-ocean-transport.mjs` runs the diffusion kernels the model dispatches against a controlled field (a two-wavenumber SST pattern with a one-column land wall) for `K = 5e4, 1e5, 2e5` and one 1800 s step:

| Grid | `K` | Sub-steps | Mean shift / largest change | `Σ Δ sinφ · Δ(T²)` | Land change |
| --- | --- | --- | --- | --- | --- |
| T21 | 5e4 | 2 | 2.2e-5 | −5.41e-3 | 0 |
| T21 | 1e5 | 2 | 4.2e-6 | −1.107e-2 | 0 |
| T21 | 2e5 | 2 | 2.7e-6 | −2.200e-2 | 0 |
| T63 | 5e4 | 14 | 1.9e-5 | −5.994e-3 | 0 |
| T63 | 1e5 | 28 | 2.4e-5 | −1.195e-2 | 0 |
| T63 | 2e5 | 54 | 1.5e-5 | −2.418e-2 | 0 |

The mean moves by at most 2.4 × 10⁻⁵ of the largest local change, i.e. f32 rounding. The area-weighted sum of squares falls in the ratio 1 : 2.05 : 4.07 at T21 and 1 : 1.99 : 4.03 at T63 while `K` goes 1 : 2 : 4, so the operator is linear in the coefficient. A land cell never changes.

Climate response. Two 4000-step T63 runs at 30 minutes (about 83 model days, separate processes, same seed and inputs):

| | Tropical mean (under 23°) | Polar mean (over 60°) | Contrast |
| --- | --- | --- | --- |
| Transport off | 299.86 K | 272.45 K | 27.41 K |
| `K = 1e5` | 299.53 K | 273.33 K | 26.20 K |

The contrast falls by 1.2 K (−4.4%): the tropics cool slightly and the poles warm, the poleward-transport signature. The global mean moved from 289.98 to 290.18 K and every point stayed finite.

`node scripts/exoplasim-webgpu/verify-ocean-currents.mjs` runs the published kernels over 480 main steps (five model days at 30 minutes) from a fresh start, with the start-up phases and their own `bm1`:

| Grid | Sea cells | Finite | Current on land | Mean speed | Peak speed | Peak wind stress |
| --- | --- | --- | --- | --- | --- | --- |
| T21 | 2048 | yes | 0 `m/s` | 0.022 `m/s` | 0.48 `m/s` | 0.34 Pa |
| T42 | 8192 | yes | 0 `m/s` | 0.025 `m/s` | 0.50 `m/s` | 0.42 Pa |
| T63 | 18432 | yes | 0 `m/s` | 0.026 `m/s` | 0.50 `m/s` | 0.50 Pa |

The peak stress is in the physical band for a surface wind, the mean drift is a few centimetres per second, and land is exactly zero. The zonal mean zonal current reverses at the latitudes where the wind does: at T21, −0.18 m/s at 3°S (westward equatorial drift) and +0.0015 m/s at 42°N (eastward under the westerlies).

Publishing. The same check reads the snapshot slot after a publishing step and compares its two extra planes with the state's `ocean_u`/`ocean_v`: the largest difference is **0**, so the pack kernel and the worker's slicing agree with the model field at both resolutions.

Interface. `GCM_FIELDS.available` returns false for `oceanCurrent` on the CPU engine and true on the GPU engine; the current planes survive the monthly/annual average (`GCM_AVERAGES`) and the checkpoint round trip, because both carry the whole `GcmSnapshot`.

## 5. Benchmarks

`node scripts/exoplasim-webgpu/benchmark-ocean.mjs <truncation> <minutes> <steps> <repetitions> <diffusivity> [output.json]` runs a fresh start from the page's own inputs, then measures both cases in turn on the same process: **base** is the model without the feature (`HCOND = 0`, `CURRENTS = 0`), **feature** is the panel's Earth-like setting (`K = 1e5 m²/s`, currents on). Each sample runs 400 steps as one command buffer per step, 50 warm-up steps precede it, 5 samples per case, and the reported figure is the smallest sample. GPU time comes from timestamp queries around each compute pass, which excludes host-side submit and queue jitter.

Development machine: NVIDIA "lovelace" adapter, Chrome 157 headless.

| Grid | Step | Dispatches (base → feature) | GPU ms/step | Δ | Wall ms/step |
| --- | --- | --- | --- | --- | --- |
| T21 | 5 min | 98 → 101 | 0.4418 → 0.4466 | **+1.1%** | 0.4497 → 0.4562 |
| T21 | 10 min | 98 → 101 | 0.4425 → 0.4480 | **+1.2%** | 0.4528 → 0.4583 |
| T21 | 30 min | 98 → 101 | 0.4520 → 0.4522 | **+0.05%** | 0.4659 → 0.4626 |
| T63 | 5 min | 98 → 105 | 3.5439 → 3.5624 | **+0.5%** | 3.5564 → 3.5752 |
| T63 | 10 min | 98 → 109 | 3.5464 → 3.5677 | **+0.6%** | 3.5590 → 3.5792 |
| T63 | 30 min | 98 → 127 | 3.4467 → 3.5954 | **+4.3%** | 3.4599 → 3.6103 |

- The cost is **dispatch-bound**. One diffusion sub-step reads five neighbours of an 18,432-point grid (0.44 MB at T63) and writes one plane; the Ekman kernel is one dispatch whatever the step length. The marginal cost is 2–5.5 µs per dispatch, so the whole feature is 0.5–4.6% of a step.
- The sub-step count follows the polar row's stability limit, so the expensive case is T63 at a long step (28 diffusion sub-steps). At short steps the same coefficient needs almost none.
- At T21 the three added dispatches cost single-digit microseconds against a 0.44 ms step, so the 30-minute case sits inside the ±1% run-to-run spread and reads as no change.
- The wall-time columns track the GPU columns within about 2%, so the page's batched loop absorbs the extra dispatches without host-side cost.
- A second pass over the six configurations reproduced every figure within 0.5 percentage points and 1.5% per-step time, so the ranking and the T63-30-minute outlier are stable.

## 6. What this is not

- **No geostrophic circulation.** The arrows are Ekman drift, not the gyres; §3 explains why the Sverdrup route is not usable at this resolution and on a land-free grid. A streamfunction solve on a bounded basin is the next increment.
- **No deep ocean.** One layer, so the transport has no memory beyond the mixed layer's heat capacity and the equilibration time stays the slab's.
- **No feedback between the transport and the currents.** The diffusion is linear in the temperature gradient and the current is linear in the wind stress; neither closes a loop.
- **The transport is not in the energy diagnostics.** The surface-heat map and the TOA budget show the atmosphere's own fluxes, and the transport redistributes heat among ocean cells without appearing in either.

## 7. Documentation updates made with this change

- `docs/climate/exoplasim-webgpu.md`: the ocean section names both kernels and the dispatch counts.
- `docs/climate/exoplasim-controls.md`: the settings table gains Ocean heat transport; the checkpoint format moves to 25 (CPU) / 26 (GPU).
- `docs/climate/exoplasim-wasm.md`: the CPU engine has neither feature, and needs no rebuild.
- `docs/climate/custom-terrain.md`: checkpoint formats.