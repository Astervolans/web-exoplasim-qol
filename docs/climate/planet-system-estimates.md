# Planet system estimates

The settings sidebar's **Star**, **Orbit & rotation**, **Planet** and **Atmosphere** panels are illustrated with diagrams and derived readouts. They exist to turn a physical description of a system — stellar mass and age, an orbital period, a planet mass and radius, a gas mixture — into the handful of scalars ExoPlaSim actually reads, and to show the estimates that follow from them.

Everything here is an interface estimate. None of it changes the model's physics: ExoPlaSim still receives `STARBBTEMP`, `GSOL0`, `SIDEREAL_YEAR`, `PLARAD`, `GA`, `PSURF`, `GASCON` and `CO2`, and nothing else. The formulas follow standard published relations — the Tout et al. (1996) zero-age main-sequence fits, the constant-Q tidal-friction timescale (Goldreich & Soter 1966), Kepler's third law and grey-atmosphere radiative balance — with Earth-calibrated coefficients. They are zero-dimensional sketches, validated only against Earth's own values.

The energy-flow diagram is the one exception: once the model produces a snapshot, it stops showing this estimate and draws the simulation's own global-mean fluxes instead (see [the control notes](exoplasim-controls.md)). The estimate below remains the fallback before a run, and the composition/star/orbit/interior readouts are always estimates.

Code: [src/model/celestial/star](../../src/model/celestial/star/index.ts), [orbit](../../src/model/celestial/orbit/index.ts), [planet](../../src/model/celestial/planet/index.ts), [atmosphere](../../src/model/celestial/atmosphere/index.ts), [energy](../../src/model/celestial/energy/index.ts), and the mapping onto the model configuration in [src/model/climate/gcm/system](../../src/model/climate/gcm/system/index.ts). The panels themselves live in [src/ui/gcm/system](../../src/ui/gcm/system).

## Star

Main-sequence luminosity and radius come from the Tout et al. (1996) zero-age fits (MNRAS 281, 257), then evolve with the star's life fraction: luminosity follows a 1.4/(1.4 − 0.4·f/f☉) brightening, radius a late main-sequence swelling with a 2.1 power law. Effective temperature is σ-normalized from luminosity and radius. Objects below 0.08 M☉ use the brown-dwarf cooling branch, and ages stop at 95% of the main-sequence lifetime (10·M^−2.5 Gyr, capped at 50 Gyr); post-main-sequence evolution is not modelled.

Spectral classes use the standard temperature cuts — Y 250–550 K, T 550–1300 K, L 1300–2400 K, M 2400–3700 K, K 3700–5200 K, G 5200–6000 K, F 6000–7500 K, A 7500–10000 K, B 10000–30000 K, O above 30000 K — with a decimal subclass and luminosity class V, or IV when M/R² < 0.457.

The stellar flux at the planet is `1367 W/m² · L / a²`, with `a` in astronomical units. 1367 W/m² is ExoPlaSim's own Earth solar constant, so a one-solar-mass star at 4.6 Gyr on a 365-day orbit reproduces the Earth defaults exactly: 5778 K, 1.000 L☉ and 1367 W/m².

## Orbit

Kepler's third law uses the model's 365-day year as its reference so that a 365-day year at one solar mass is exactly 1 AU: `a = (M · (P/365)²)^(1/3)`, `P = 365 · √(a³/M)`. The year-length slider sets `SIDEREAL_YEAR` and re-derives the semi-major axis and the flux. The panel draws that orbit from above the ecliptic plane, with the habitable zone and snow line as rings at the same scale and a logarithmic distance strip below.

Readout estimates use the same geometry:

| Estimate | Formula |
| --- | --- |
| Habitable zone | 0.95·√L to 1.67·√L AU (flux-scaled band close to the conservative Kopparapu et al. 2013 limits) |
| Snow line | 2.7·√L AU |
| Perihelion / aphelion | a(1∓e) |
| Insolation | 1367·L/a² W/m² |
| Equilibrium temperature | (S(1−A)/4σ)^(1/4), A = 0.3 |
| Hill radius | a(1−e)·(M_p/(3·M★·332946))^(1/3) |
| Stellar Roche limit | 2.44·R★·(ρ★/ρ_p)^(1/3), R★ from L and T, ρ★ = 1.408·M★/R★³ |
| Tidal-locking timescale | ω₀·a⁶·(0.33·M_p·R_p²)·Q / (3·G·M★²·k₂·R_p⁵), ω₀ = 7e-5 rad/s, Q = 100, k₂ = 0.3 |

The equilibrium temperature uses a fixed 0.3 planetary albedo and no greenhouse: Earth's defaults give `(1367·0.7/4σ)^(1/4)` = 255 K, so the panel shows −18 °C. That is the airless balance temperature, not a surface climate. The separate surface row adds the atmosphere section's greenhouse fit (about 27 K for the default air, giving roughly 9 °C), so the two rows can be read together. The panel marks the flux-scaled habitable-zone band and the surface row as estimates; the tidal-locking timescale is derived the same way.

The tidal-locking readout compares that timescale with the star's age: below a tenth of it the planet "should be" locked, below the age it "may be" locked. The Orbit & rotation panel repeats that comparison under the Rotation control as a recommendation: it suggests enabling **Tidally locked** when the estimate says the planet should be locked, calls the switch optional when the estimate is uncertain, and notes that the star is fixed in longitude anyway when the model locks a case the estimate calls unlocked. Selecting **Tidally locked** sets ExoPlaSim's fixed-illumination switch and the rotation period to the orbital period (capped at the rotation slider's 100-day maximum); the rotation slider is then disabled and follows the year length.

Closest approach names the season whose position is nearest the periapsis longitude, using ExoPlaSim's convention that 0° is the northern autumn equinox and 90° the northern winter solstice.

## Planet

Density and gravity follow from mass and radius: `ρ = 5.514 g/cm³ · M/R³` and `g = 9.80665 m/s² · M/R²`, both in Earth units. Escape velocity is `√(2GM/R)`. Mass and radius are the controls; gravity is the value written to the model. The panel's globe draws the rotation axis at the chosen axial tilt, which is the same value written to `OBLIQ`.

Interior structure is a first-order differentiated-body sketch. Bulk fractions of iron, silicate, water and gas follow from a volume-additivity mixing rule over endmember densities (iron 7.87, silicate 3.3, ice 1.0 g/cm³) with a `1 + 0.35·M^0.5` compression factor; shell radii follow from the volume fractions by cube root. The core splits into a solid inner core at 0.35 of the core radius and a liquid outer core; the mantle splits at the 60 GPa contour of the uniform-density profile, `r = √(1 − 60/P_c)`; an ocean or ice shell appears when the body holds water. Central pressure is the uniform-density result `3GM²/(8πR⁴)`, and the core temperature adds a tenth of the gravitational binding energy per unit heat capacity, `0.1·GM/(R·c_p)`, to the surface temperature. For Earth this returns 5.51 g/cm³, 9.81 m/s², a 0.56 R core boundary, about 6500 K and 170 GPa.

## Atmosphere

Composition is read from the gas partial pressures that are set. Species molar masses and specific heat capacities are standard values (N₂ 28.0134 / 1040, O₂ 31.9988 / 918, CO₂ 44.0095 / 844, H₂ 2.0159 / 14304, He 4.0026 / 5193, Ar 39.948 / 520, Ne 20.1797 / 1030, Kr 83.798 / 248, H₂O 18.015 / 1996 in g/mol and J/(kg·K)). Mean molar mass is molar-weighted, heat capacity mass-weighted, and the gas constant is 8314.462618/μ.

The greenhouse estimate is a single-layer grey atmosphere: the optical depth thickens with surface pressure, the CO₂ column and pressure-induced hydrogen absorption, and the surface sits at `T_s = T_eff·(1 + τ)^(1/4)`. The per-bar depth is calibrated so modern Earth air reproduces the observed ~33 K greenhouse effect (Trenberth & Fasullo 2012), and its CO₂ exponent gives 3 K per doubling, the IPCC AR6 central estimate. Surface temperature is the equilibrium temperature plus this warming, scale height is `R·T_s/(μ·g)`, and atmosphere height is six scale heights.

The vertical profile assumes an environmental lapse rate between the dry rate g/c_p and the moist rate (with a surface water fraction of 0.71) and a 210 K stratosphere. It marks the tropopause, the emission level ΔT/Γ, the top, the Armstrong line (blood-boiling pressure 0.0618 bar), the hypoxia level (oxygen partial pressure 0.11 bar) and a breathable band tested against pressure, temperature, oxygen, CO₂, narcosis limits and the two tolerance edges. Cloud layers sit between 0.55 and 1.65 of the tropopause height, capped at one scale height. Climate regimes use fixed thresholds: vacuum below 0.01 bar, sub-Neptune for hydrogen-rich air above 0.3 bar, runaway greenhouse above 350 K, snowball below 240 K, then thin, ordinary and thick habitable bands to 10 bar.

## Energy budget

The energy diagram is a single-layer radiative-convective sketch at a fixed 30% planetary albedo. Sunlight is split at the mean geometry (1/4); the atmosphere absorbs a share `1 − e^(−0.4p)` of it by Beer's law, the surface radiates σT_s⁴ plus 21% latent and 5% sensible flux, and the 8–13 µm window passes 10% of the surface emission at one bar, shrinking with pressure (clamped 0.02–0.3). Back radiation is the returned circulation flux plus the atmosphere's own solar absorption. At equilibrium the incoming and outgoing totals are equal by construction, so the storage term is zero. The fractions are the Earth values of Trenberth & Fasullo (2012).

## Defaults

| Quantity | Default | Basis |
| --- | --- | --- |
| Stellar mass | 1 M☉ | Sun |
| Stellar age | 4.6 Gyr | Sun |
| Year length | 365 days | ExoPlaSim's 365-day calendar year, so 1 AU at 1 M☉ |
| Planet mass | 1 M⊕ | Earth |
| Planet radius | 1 R⊕, 6371 km | Earth |
| Gravity | 9.80665 m/s² | Derived from the two above |
| Atmosphere | ExoPlaSim's native Earth air | Unchanged |
