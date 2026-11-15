# web-exoplasim

Run the [ExoPlaSim](https://github.com/alphaparrot/ExoPlaSim) climate model in your browser, with live weather and climate maps. Explore Earth or imported terrain, change planetary conditions, and watch the atmosphere evolve.

**English** · [中文](README.zh-CN.md)

**About this repository.** This is a personal, self-use fork of [ryoung48/web-exoplasim](https://github.com/ryoung48/web-exoplasim), itself a browser port of ExoPlaSim. It is maintained for the author's own experiments, and the changes relative to the original project are mainly quality-of-life improvements rather than rework of the climate model itself. The original project's hosted demo is at [ryoung48.github.io/web-exoplasim/gcm](https://ryoung48.github.io/web-exoplasim/gcm/).

## Changes in this fork

Relative to [ryoung48/web-exoplasim](https://github.com/ryoung48/web-exoplasim):

- **Illustrated planetary-system panels.** The Star, Orbit & rotation, Planet and Atmosphere settings are illustrated panels with Standard and Advanced modes, orbit, interior-cutaway, spectral-strip and atmospheric-profile diagrams, and readouts labelled as estimates.
- **Chinese interface.** A language switch (EN / 中文) in the header; the first language follows the browser, and the choice is remembered.
- **Terrain-import orientation.** Rotate an imported map so its poles and 0° meridian align with the model frame, with previews for the sub-stellar point and the tropics/polar circles.
- **Star-point and climate-zone overlays** on the main map and the terrain-import preview.
- **Tidal-locking guidance.** The Orbit panel estimates the tidal-locking timescale from the orbital parameters and recommends enabling or skipping **Tidally locked**.
- **Year length down to 10 days** (previously 60) for short-period locked planets; enabling tidal locking disables the rotation-period slider, whose value then follows the year length.
- **Temperature (K) and pressure (bar) ticks** on the atmospheric profile's horizontal axes.
- **Estimate models rewritten from published relations** — Tout et al. (1996) stellar fits, constant-Q tidal friction (Goldreich & Soter 1966), grey-atmosphere balance, Earth energy-budget fractions — replacing the external reference implementation used earlier, so the panels no longer depend on that source.

## GPU and CPU engines

The default **GPU engine** ports ExoPlaSim's atmospheric dynamics and physics to WebGPU compute shaders, using **32-bit single precision (FP32)** for model integration. The model advances on your graphics card; the GPU does more than draw the maps. It supports T21 (64 × 32), T42 (128 × 64), and T63 (192 × 96), with 5 or 10 atmospheric layers. A browser and graphics driver with WebGPU support are required.

The **CPU engine** runs the Fortran model compiled to WebAssembly across shared-memory Web Workers, retaining **64-bit double precision (FP64)** for model integration. All included CPU builds use double precision; selecting CPU does not use the GPU port's single-precision physics. It supports T21 and T42. The page selects CPU when WebGPU is unavailable.

Both engines offer planetary, stellar, orbital, atmospheric, and surface settings; live, monthly, and annual maps; energy-balance diagnostics; and save/load checkpoints. Köppen and Pasta climate maps use matching calendar months averaged over the latest ten complete model years, or fewer while the run is still building its history. Terrain downscaling adds visual detail and elevation corrections, but does not increase the simulation's physical resolution.

## Performance

Approximate speeds observed by the maintainer on an **NVIDIA GeForce RTX 2070 SUPER (8 GB VRAM)** and an **AMD Ryzen 7 2700X (8 cores / 16 threads)**, using **10 atmospheric layers and a 45-minute model timestep**. GPU runs use FP32; CPU runs use FP64 and **8 workers**. These are maintainer-observed interactive rates rather than controlled benchmark results.

| Resolution | GPU: simulated days per real second | CPU: simulated days per real second |
| --- | ---: | ---: |
| T21 | 35 | 2 |
| T42 | 10 | 0.5 |
| T63 | 1.7 | — |

T63 is available only on GPU. Actual speed depends on hardware, browser, model settings, diagnostics, and other work sharing the GPU or CPU. The 45-minute timestep describes these measurements; it is not a stability recommendation for every configuration.

## Caveats

This is an experimental browser port of a simplified climate model. It is useful for exploration and worldbuilding; its maps should not be treated as precise predictions of real regional climates.

- **GPU precision.** WebGPU uses single-precision arithmetic for the evolving model, while the CPU build uses double precision. Different rounding and parallel reductions can tip cloud, convection, and moisture thresholds, causing trajectories to diverge. Short comparisons against Fortran are documented, but full long-term climate equivalence has not been established across resolutions and settings. A finite, stable run alone does not establish an accurate climate. See the [GPU validation notes](docs/climate/exoplasim-webgpu.md).
- **Warm Earth results.** Earth-like configurations in this project have produced climates warmer than expected on both GPU and CPU. Native Fortran comparisons also warmed under the tested page inputs, so this cannot be attributed solely to GPU single precision. Results depend strongly on initialization and surface settings: a separate author-recipe experiment produced a much cooler climate. The cause of the discrepancy is not fully isolated, and the Earth preset is not a calibrated reproduction of modern Earth. See the [native climate comparisons](docs/climate/exoplasim-native-versions.md).
- **Rainfall and climate zones.** Runs can produce too many dry-summer Mediterranean-type regions, including As, Cs, and Ds classifications, where wetter oceanic climates might be expected. Ten-year averaging reduces sensitivity to individual years; it does not correct systematic precipitation errors. Treat exact climate-zone boundaries cautiously.
- **Simplified oceans and physics.** The browser model uses a slab ocean rather than simulated ocean currents and deep-ocean circulation. Clouds, convection, precipitation, and radiation use simplified parameterizations. These choices make ExoPlaSim fast, but limit regional rainfall, ocean heat transport, and climates far from the conditions for which the physics was developed. The [ExoPlaSim paper](https://academic.oup.com/mnras/article/511/3/3272/6516962) explains the underlying model's strengths and limitations.
- **Coarse grids and spin-up.** Small islands, mountains, coastlines, and local rain shadows are poorly resolved, especially at T21. Climate needs time to settle; an early map or small energy imbalance is not proof that every component has equilibrated. Extreme settings or overly long timesteps can also become numerically unstable.
- **Port coverage.** Some diagnostics are CPU-only, including sea-level pressure and relative humidity at other atmospheric levels. Glacier formation during continuous runs is incomplete. Checkpoints are specific to their engine. See [integration details](docs/climate/exoplasim-webgpu-integration.md) and the [glacier audit](docs/climate/exoplasim-glaciers.md).

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173/gcm`. CPU model assets are already included in `public/gcm/`; running the page does not require a Fortran toolchain. The development server supplies the isolation headers needed by the shared-memory CPU engine. On GitHub Pages, an isolation service worker provides this support and may reload the page once on the first visit.

Pushes to `main` deploy automatically through the [GitHub Pages workflow](.github/workflows/pages.yml).

## Development

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Typecheck and build for production |
| `pnpm typecheck` | Check TypeScript |
| `pnpm lint` | Run Biome with fixes |
| `pnpm build:gcm-wasm` | Rebuild CPU model assets using Ubuntu WSL |

The model code lives in `src/model/climate/gcm/`, and the page lives in `src/ui/gcm/`. See the [CPU build instructions](scripts/exoplasim-wasm/README.md), [CPU port notes](docs/climate/exoplasim-wasm.md), and [GPU port notes](docs/climate/exoplasim-webgpu.md) for implementation, validation, and benchmark details.

## Licence

ExoPlaSim and PlaSim are distributed under the GNU General Public License; this browser port is a derivative work and is released under GPL-2.0. [The bundled licence](public/gcm/COPYING) applies to the compiled model assets. The model source corresponding to those compiled assets is ExoPlaSim at commit `5f8dff4` (https://github.com/alphaparrot/ExoPlaSim) plus the patches in `scripts/exoplasim-wasm/`.

Attribution: ExoPlaSim and PlaSim are the work of their authors, including Adiv Paradise and the PlaSim team (Frank Lunkeit, Edilbert Kirk, Thomas Frisius, Klaus Fraedrich and Valerio Lucarini). The browser port derives from `ryoung48/web-exoplasim`. This repository carries further modifications, including the WebGPU engine, the illustrated planet-system panels and the terrain-orientation and energy diagnostics.

### Earth elevation data

The bundled Earth land elevation is based on [WorldClim 2.1 elevation data](https://www.worldclim.org/data/worldclim21.html), derived from SRTM. The source file is `wc2.1_10m_elev.tif` at 10 arc-minute resolution, converted to the app's 2160 × 1080 terrain raster. See the [terrain metadata](public/earth-data/earth-real-elevation.json).

Citation: Fick, S.E. and Hijmans, R.J. (2017). WorldClim 2: new 1-km spatial resolution climate surfaces for global land areas. *International Journal of Climatology*, 37, 4302–4315. [doi:10.1002/joc.5086](https://doi.org/10.1002/joc.5086).

WorldClim data have separate terms from the model code: the [WorldClim licence](https://www.worldclim.org/about.html) allows academic and other non-commercial use, but requires prior permission for redistribution or commercial use. Attribution does not grant that permission.

The terrain metadata also records a bathymetry input named `elev.tif`; its provider and licence have not yet been identified.
