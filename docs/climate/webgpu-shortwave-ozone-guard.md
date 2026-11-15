# WebGPU shortwave radiation NaN with cool-star spectra

## Symptom

On the WebGPU engine the model stops with an instability error, while the same
configuration is stable on the CPU (Fortran, f64) engine. Two observed forms:

1. A single column reports a NaN in a surface field (e.g. surface shortwave)
   at grazing sun, or the top-of-atmosphere flux is NaN while the surface
   flux is finite.
2. In more extreme cases nearly the whole grid becomes NaN within one step;
   the published snapshot shows e.g. `TOA shortwave` NaN on exactly the
   day-side half of the grid, which means the shortwave kernel already
   received non-finite inputs.

Turning ozone off in the atmosphere panel removes the failure, which points
at the ozone optical-depth path inside `swr.wgsl`.

## Reproduction

- Engine: GPU (WebGPU, f32)
- Star: M2.1 V (cool spectrum)
- Surface pressure: ~1.78 bar, 10 atmospheric layers
- Timestep: 5 minutes, Earth terrain
- Failure: after roughly 10 model days, at a column near the terminator
  (solar zenith cosine ≈ 0.03); the first bad field is
  `TOA net radiation` / `TOA shortwave` at level 0.
- CPU engine with the same settings: stable.

## Root cause

The shortwave band optical depths use fits calibrated for the Sun and divide
the absorbed fraction by the stellar band-energy fractions `ZSOLAR1` /
`ZSOLAR2`. For a cool M dwarf those fractions are small, so
`ozone_absorption()` (and, in principle, `vapour_absorption()`) can reach or
exceed 1.

`swr.wgsl` then normalizes each layer's transmittance by the cumulative
transmittance above:

```wgsl
let to3 = (1.0 - ozone_absorption(o3)) / to3t;
to3t = to3t * to3;
...
let to3u = to3tu / (1.0 - ozone_absorption(o3));
```

With absorption ≥ 1, `1 - absorption` is zero or negative. In f32:

- the division by a rounded-to-zero denominator produces Inf, and
- a negative numerator drives the normalized ratios through floor/clamp
  paths into huge positive transmittances.

`tb1`/`tb1u` grow without bound, `ta1` overflows at the top level, and the
top-of-atmosphere two-band sum `fu + fd` becomes `-Inf + Inf = NaN`
(`swr.wgsl`, final assembly loop). The Fortran f64 build keeps a tiny but
non-zero `1 - absorption` and never hits the exact zero/negative case, so
the CPU engine remains stable.

An intermediate guard that only floored the denominator (and capped the
ratio) made things worse: with a negative `1 - absorption`, flooring the
cumulative transmittance and then dividing by a small positive value
amplified the negative ratio, producing NaN on the first step.

## Fix

In `src/model/climate/gcm/physics/radiation/wgsl/swr.wgsl`:

- clamp each absorption to `[0, 1]` before forming the transmittance
  (`clamp(ozone_absorption(...), 0.0, 1.0)` and the same for
  `vapour_absorption`);
- floor the cumulative transmittances (`to3t`, `to3tu`, `twvt`, `twvtu`)
  at `1e-4`;
- cap the normalized per-layer ratios (`to3`, `to3u`, `twv`, `twvu`) at 10
  so the transmittance products cannot overflow f32.

Normal solar-spectrum cases have absorption well below 1, so their numbers
are unchanged.

Additionally, grazing-sun columns in a thick atmosphere can push the
two-stream reflectances close to 1, where `1 - r·r` rounds to zero in f32.
Those products are now bounded and every such denominator is floored
(`bounded()` helper plus `max(1 - r·r, 1e-6)`) in the same kernel.

## Verification

- M2.1 V, 30-day year, 5-minute steps, Earth terrain: previously failed at
  about step 2912 with `TOA net radiation` NaN; after the fix the run passes
  that point and continues.
- The earlier Antarctic grazing-sun case (single-column surface shortwave
  NaN) is also gone.
- Normal Earth configurations show no change in the published fields.

## Suggested follow-up for upstream

- Consider deriving `ZSOLAR1`/`ZSOLAR2` handling for cool-star spectra
  explicitly, or clamping the absorption fits in the Fortran source as well
  (the f64 build tolerates the overshoot but the values are unphysical).
- The WebGPU worker now reports the field, level and grid position of the
  first non-finite snapshot value, plus per-field NaN counts, which made
  this diagnosis possible; that instrumentation can stay behind a debug flag
  if preferred.
