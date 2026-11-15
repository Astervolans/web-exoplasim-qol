import { GCM_ATMOSPHERE } from "@/model/climate/gcm/atmosphere"
import type { GcmConfig } from "@/model/climate/gcm/types"

const DEFAULT_CONFIG: GcmConfig = {
	targetTemperatureK: null,
	stormclim: false,
	atmosphere: GCM_ATMOSPHERE.DEFAULT_CONFIG,
	layers: 10,
	periapseLongitudeDeg: null,
	keplerian: false,
	initialMeanAnomalyDeg: null,
	soilWaterCapacityM: null,
	soilHeatCapacity: null,
	soilDepthScale: 1,
	landAlbedo: null,
	oceanAlbedo: null,
	snowIceAlbedo: null,
	radiusEarth: 1,
	gravityMs2: 9.80665,
	synchronous: false,
	substellarLongitudeDeg: 180,
	oceanDepthM: 50,
	fluxWm2: 1367,
	starTemperatureK: 5778,
	starMassSolar: 1,
	starAgeGyr: 4.6,
	// A 365-day model year is 1 AU at one solar mass, so the derived
	// semi-major axis and stellar flux agree with the Earth defaults above.
	yearDays: 365,
	eccentricity: 0.016715,
	rotationPeriodDays: 1,
	obliquityDeg: 23.5,
	fixedOrbit: true,
	wetSoil: false,
	vegetation: 2,
	initialGrowth: 0.5,
	glaciers: { enabled: true, minDepthM: 2, initialHeightM: -1 },
	physicsFilter: ["gp", "exp", "sp"],
	// ExoPlaSim's Model.configure() default. At T42 PlaSim would choose 30
	// minutes itself ((30 * 64) / NLAT, plasim.f90 near line 1336); 45 needs
	// a third fewer steps per model day. Multi-year T42 stability at 45
	// minutes is unverified; the panel offers 30 if a run aborts.
	timestepMinutes: 45,
	// T21 downloads about 4.6 MB and runs a model year in minutes; T42 is
	// opt-in.
	truncation: 21,
	earthSurfaceClimatology: false,
}

// ExoPlaSim's MVELP default; the panel and star markers use it when the
// value is left unset.
const PERIAPSE_LONGITUDE_DEG = 102.7

export const GCM = {
	DEFAULT_CONFIG,
	PERIAPSE_LONGITUDE_DEG,
}
