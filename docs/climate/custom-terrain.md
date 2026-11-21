# Custom terrain

Open `/gcm` and use **Terrain** before starting a run. Select **Import terrain**, choose a heightmap and optionally a matching land mask, adjust the settings, inspect the preview, and select **Apply terrain**. Applying clears previous results and disables Earth surface climatology. **Use Earth** restores the bundled geography and enables Earth surface climatology. Clear an active run before replacing terrain.

Files are read locally in the browser. There is no upload service.

## Coordinates and files

All inputs cover the entire world in equirectangular coordinates. Pixel centres run west to east from −180° to +180°, and north to south from +90° to −90°. The image must be twice as wide as it is tall, from 4 × 2 through 4096 × 2048 pixels. Files larger than 64 MiB are rejected before reading their contents. Regional maps and other projections must be converted before import. If the map's poles or prime meridian do not match the model's, rotate it with [Map orientation](#map-orientation) instead of pre-rotating the file.

- **PNG heightmap:** grayscale, including 8-bit and 16-bit samples. RGB/RGBA files are accepted when their channels are grayscale and all pixels are opaque. Decoding uses the stored numerical samples directly, preserving 16-bit precision without canvas color conversion. Colored map screenshots and missing/transparent pixels are rejected.
- **Chaos Machine `.bin`:** exactly 1440 × 720 signed little-endian 16-bit elevations in metres, or 2,073,600 bytes. This is the file from Chaos Machine's **WebGCM** export, not a serialized world or native `.gcmworld` file. Its minimum and maximum samples correspond to black and white in the mapping.
- **Land-mask PNG:** the same dimensions and coordinates as the heightmap. Values at or above halfway are land; lower values are water. **Invert mask** reverses this. The mask independently determines land and ocean, including land flattened to zero elevation.

The grayscale sea-level slider defaults to 0 on a 0–255 scale; the maximum elevation input defaults to 8 km. Samples at or below the cutoff become zero elevation. Samples above it scale linearly from zero to the maximum elevation at the brightest sample in the file. If no samples are above the cutoff, every elevation is zero. A cutoff of 255 makes every elevation zero. Without an imported land mask, samples strictly above the cutoff are land; with a mask, the cutoff still changes elevations but the mask determines land and ocean. The preview shows land in white and ocean in black.

## Map orientation

The model keeps the raster in the frame it was imported in. Map orientation rotates it for the boundary and downscaling calculations, so the imported file never has to be re-projected. The preview overlays both coordinate systems on that unchanged raster: gray dashed lines are the imported 30° graticule, cyan lines are the model's 30° graticule, and cyan dots mark the model's poles.

- **North pole latitude** places the imported map's north pole at that model latitude. 90° is the default and leaves the map unchanged; 0° puts the imported poles on the model's equator; negative values point into the southern hemisphere.
- **North pole longitude** selects the model meridian the imported north pole points toward. It has no effect while the pole latitude is ±90°, where the pole lies on the model's own axis.
- **Spin** turns the map about its own north pole, choosing how the imported longitudes line up with the model's once the pole has been placed.

Together the three angles express any three-axis rotation of the sphere. For a map whose south pole is the sub-stellar point and whose 0° meridian plane is the ecliptic, the imported north pole belongs at the anti-stellar point: use the negative of the obliquity as the pole latitude and the sub-stellar longitude plus 180° as the pole longitude, then set spin to align the map's 0° meridian plane with the orbit. When the star-point markers are enabled in Orbit & rotation, the preview also draws the sub-stellar point and its antipode in the imported frame, so the map can be rotated until the markers land on the map's own poles. With tidal locking off, the tropics and polar circles are likewise available as dashed model-frame overlays on the preview and the main map.

The model builds its boundary and display downscaling through the orientation. The page nevertheless draws every layer in the imported frame: elevation, climate fields, climate classes, downscaled layers, coastlines, wind arrows and hover coordinates are converted back, and hover values are sampled at the matching model position. The elevation raster itself is drawn untouched, so the main map still matches the imported file exactly.

## Chaos Machine

In Chaos Machine's world viewer, choose **WebGCM** and **Export WebGCM terrain** to download `chaos-world-<seed>.bin`. Then choose **Land mask** and **Export land mask PNG** to download `chaos-world-<seed>.land-mask.png`. Export both from the same world without regenerating between downloads.

Both exports sample the same nearest world region at each raster pixel. The mask uses `isLand`, preserving inland water above sea level and land at or below sea level. Displayed map rotation does not affect either file. Load the binary as the heightmap and the PNG as its mask in ExoPlaSim.

## Model and display

The terrain domain stores elevation and land coverage independently. Boundary generation and downscaling share a spherical-area overlap sampler, including longitude wrapping. Coarse inputs cover every model cell rather than leaving empty cells. Land fraction is the covered land area divided by total cell area; geopotential is gravity times the area mean of land elevation, with water contributing zero. Negative land elevation remains negative. With a rotated orientation the sampler supersamples each model cell in the model frame, converts the samples into the imported frame and area-weights them, capped at 16 samples per axis; aligned terrain keeps the exact overlap path.

The preview samples the source mask at up to 720 × 360 pixels. The model uses a coarser Gaussian grid, so source detail can disappear at that resolution. Coastline overlays and downscaling use the selected mask in the imported frame.

The main map stores its model-frame layers as before and re-samples them into the imported frame on demand; climate layers are bilinearly interpolated, climate classes use nearest pixels, and wind vectors are rotated into the map's east/north frame. Changing the orientation never rebuilds the elevation raster: the import dialog repaints its preview in about 1 ms of canvas work, about 4 ms per slider step end to end for a 4096 × 2048 heightmap. On the main map the per-pixel projection is cached per orientation and raster size, so after the first layer a 128 × 180 model-grid raster re-samples in about 0.5 ms and a 720 × 360 downscaled raster in about 6 ms; the first layer after an orientation change costs about 3 ms and 30 ms respectively, and a rotated T21 boundary takes about 70 ms in the preparation worker. These are functional single runs in Chrome, not throughput benchmarks.

Checkpoints embed the complete terrain, including its map orientation, alongside restart data and climate averages. New files use formats 24 (CPU) and 25 (GPU), and files from formats 22 and 23 still load; older checkpoint formats are rejected because they store no orientation. Loading a checkpoint restores its terrain and orientation without the original files.

## Verification

Generate reproducible fixtures using an existing Chaos Machine world saved with Node's V8 serializer:

```powershell
node --max-old-space-size=8192 scripts/exoplasim-wasm/export-chaos-fixture.mjs C:/path/to/chaos-machine C:/path/to/world.bin
pnpm dev --host 127.0.0.1 --port 5176 --strictPort
node scripts/exoplasim-wasm/verify-terrain-import.mjs
```

The fixture exporter reads the other checkout and writes only under `stats/terrain-import/` in this repository. It calls Chaos Machine's actual terrain exporter, then writes aligned binary, mask, 16-bit PNG and 8-bit PNG fixtures. `TERRAIN_TEST_URL` overrides the browser test's default `http://127.0.0.1:5176`. Run with other GCM simulations and benchmarks stopped.

The browser checks cutoff scaling, independent masks, inversion, raster north/south and east/west orientation at T21 and T42, constant zero/negative land, finite regridded fields, downscaling, checkpoint array round trips, upload/previews, model startup, pause/save/load, and invalid-file rejection. It also checks orientation placement and round trips, rotated regridding on a marked pixel, orientation retention in checkpoints, map-raster re-sampling, a tilted UI import that runs the model, the two-grid preview, and the star-point and climate-zone overlay math and map pixels. Reports, PNG screenshots and a real checkpoint remain under `stats/terrain-import/`. Required repository checks are `pnpm lint` and `pnpm typecheck`. The standalone Fortran benchmark runner does not exercise this importer; no Fortran or Wasm rebuild is needed for these changes.
