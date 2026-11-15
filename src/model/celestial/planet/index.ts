import type {
	PlanetClassificationRequest,
	PlanetComposition,
	PlanetCompositionRequest,
	PlanetInterior,
	PlanetInteriorRequest,
	PlanetKind,
	PlanetLabelRequest,
	PlanetLayer,
	PlanetRequest,
	PlanetState,
} from "@/model/celestial/planet/types"

// The cutaway is a first-order differentiated-body sketch: iron, silicate
// and ice endmembers with a common compression correction, volume-additive
// mixing, a uniform-density core pressure and gravitational heating.
const EARTH_RADIUS_KM = 6371
const EARTH_DENSITY_GCC = 5.514
const EARTH_GRAVITY_MS2 = 9.80665
const EARTH_MASS_KG = 5.9722e24
const GRAVITATIONAL_CONSTANT = 6.6743e-11
const JOVIAN_MASS_EARTHS = 317.828
const GAS_GIANT_MIN_MASS = 50
const SUPER_JOVIAN_MIN_MASS = 635.656
const ROCK_LINE_MIN_DENSITY = 0.9
const MANTLE_TRANSITION_GPA = 60
const IRON_DENSITY_GCC = 7.87
const SILICATE_DENSITY_GCC = 3.3
const ICE_DENSITY_GCC = 1
const COMPRESSION_COEFFICIENT = 0.35
const COMPRESSION_EXPONENT = 0.5
const MINIMUM_CORE_FRACTION = 0.02
const MAXIMUM_CORE_FRACTION = 0.95
const INNER_CORE_FRACTION = 0.35
const ROCKY_HEAT_CAPACITY = 1000
const GAS_HEAT_CAPACITY = 14304
const GRAVITATIONAL_HEATING_SHARE = 0.1
const ENVELOPE_DENSITY_GCC = 0.25
const LAYER_COLORS = {
	innerCore: "#f5d060",
	outerCore: "#e08030",
	lowerMantle: "#a04020",
	upperMantle: "#8a3a1c",
	ocean: "#3a6a9a",
	ice: "#b8ccd8",
	hpIce: "#8aa8c0",
	crust: "#6a4a28",
	envelope: "#c9a860",
} as const

function rockLineDensity({ massEarth }: { massEarth: number }): number {
	return 3.3 * (1 + 0.36 * Math.max(massEarth, 1e-6) ** 0.57)
}

function kindOf({
	massEarth,
	densityGcc,
}: PlanetClassificationRequest): PlanetKind {
	const rockLine = rockLineDensity({ massEarth })
	if (massEarth >= SUPER_JOVIAN_MIN_MASS) return "superJovian"
	if (massEarth >= GAS_GIANT_MIN_MASS) return "gasGiant"
	if (densityGcc >= ROCK_LINE_MIN_DENSITY * rockLine) {
		if (massEarth < 0.5) return "rocky"
		return massEarth < 2 ? "terrestrial" : "superTerrestrial"
	}
	return densityGcc > 1.5 ? "subNeptune" : "ice"
}

function label({
	massEarth,
	densityGcc,
	composition,
}: PlanetLabelRequest): string {
	const kind = kindOf({ massEarth, densityGcc })
	if (kind === "superJovian") return "Super-Jovian"
	if (kind === "gasGiant") return "Gas giant"
	if (kind === "subNeptune")
		return composition.water > 0.3 ? "Ocean planet" : "Sub-Neptune"
	if (kind === "ice")
		return composition.gas > 0.02
			? "Gas dwarf"
			: composition.water > 0.05
				? "Ice world"
				: "Ocean world"
	if (kind === "rocky") return "Rocky moon"
	if (kind === "terrestrial")
		return composition.core > 0.5 ? "Iron planet" : "Terrestrial"
	return "Super-terrestrial"
}

function compressionFactor({ massEarth }: { massEarth: number }): number {
	return (
		1 +
		COMPRESSION_COEFFICIENT * Math.max(massEarth, 0.01) ** COMPRESSION_EXPONENT
	)
}

function composition({
	massEarth,
	radiusEarth,
}: PlanetCompositionRequest): PlanetComposition {
	if (massEarth >= GAS_GIANT_MIN_MASS) {
		const gas = Math.min(
			Math.max(0.9 + 0.02 * Math.log10(massEarth / JOVIAN_MASS_EARTHS), 0.85),
			0.97,
		)
		const remainder = 1 - gas
		return {
			core: 0.3 * remainder,
			water: 0.7 * remainder,
			gas,
		}
	}
	const density =
		(EARTH_DENSITY_GCC * Math.max(massEarth, 1e-6)) /
		Math.max(radiusEarth, 1e-6) ** 3
	const factor = compressionFactor({ massEarth })
	const iron = IRON_DENSITY_GCC * factor
	const rock = SILICATE_DENSITY_GCC * factor
	if (density >= rock) {
		const core = Math.min(
			Math.max(
				(1 / density - 1 / rock) / (1 / iron - 1 / rock),
				MINIMUM_CORE_FRACTION,
			),
			MAXIMUM_CORE_FRACTION,
		)
		return { core, water: 0, gas: 0 }
	}
	if (density >= ICE_DENSITY_GCC * 1.2) {
		const water = Math.min(
			Math.max((1 / density - 1 / rock) / (1 / ICE_DENSITY_GCC - 1 / rock), 0),
			0.98,
		)
		const core = 0.26 * (1 - water)
		const total = core + water
		return { core: core / total, water: water / total, gas: 0 }
	}
	const gas = Math.min(
		Math.max(1 - density / (ICE_DENSITY_GCC * 1.2), 0.02),
		0.98,
	)
	const remainder = 1 - gas
	return { core: 0.3 * remainder, water: 0.7 * remainder, gas }
}

function state({ massEarth, radiusKm }: PlanetRequest): PlanetState {
	const mass = Math.max(massEarth, 1e-4)
	const radius = Math.max(radiusKm, 1)
	const radiusEarth = radius / EARTH_RADIUS_KM
	const densityGcc = EARTH_DENSITY_GCC * (mass / radiusEarth ** 3)
	const gravityEarth = mass / radiusEarth ** 2
	const compositionValue = composition({ massEarth: mass, radiusEarth })
	return {
		massEarth: mass,
		radiusKm: radius,
		radiusEarth,
		densityGcc,
		gravityMs2: gravityEarth * EARTH_GRAVITY_MS2,
		gravityEarth,
		escapeVelocityKms:
			Math.sqrt(
				(2 * GRAVITATIONAL_CONSTANT * mass * EARTH_MASS_KG) / (radius * 1000),
			) / 1000,
		kind: kindOf({ massEarth: mass, densityGcc }),
		label: label({
			massEarth: mass,
			densityGcc,
			composition: compositionValue,
		}),
		composition: compositionValue,
	}
}

function volumeFractions({
	massEarth,
	densityGcc,
	composition: bulk,
}: {
	massEarth: number
	densityGcc: number
	composition: PlanetComposition
}): { iron: number; silicate: number; water: number; gas: number } {
	const factor = compressionFactor({ massEarth })
	const iron = (bulk.core * densityGcc) / (IRON_DENSITY_GCC * factor)
	const silicate =
		((1 - bulk.core - bulk.water - bulk.gas) * densityGcc) /
		(SILICATE_DENSITY_GCC * factor)
	const water = (bulk.water * densityGcc) / ICE_DENSITY_GCC
	const gas = (bulk.gas * densityGcc) / ENVELOPE_DENSITY_GCC
	return { iron, silicate, water, gas }
}

function interior({
	massEarth,
	radiusKm,
	densityGcc,
	surfaceTemperatureK,
	composition: bulk,
}: PlanetInteriorRequest): PlanetInterior {
	const mass = Math.max(massEarth, 1e-4)
	const radius = Math.max(radiusKm, 1)
	const radiusM = radius * 1000
	const massKg = mass * EARTH_MASS_KG
	const volumes = volumeFractions({
		massEarth: mass,
		densityGcc,
		composition: bulk,
	})
	const total =
		volumes.iron + volumes.silicate + volumes.water + volumes.gas || 1
	const coreRadius = Math.cbrt(volumes.iron / total)
	const mantleRadius = Math.cbrt((volumes.iron + volumes.silicate) / total)
	const surfaceRadius = Math.cbrt(
		(volumes.iron + volumes.silicate + volumes.water) / total,
	)
	// Uniform-density interior: P_c = 3GM²/(8πR⁴), and a fraction of the
	// gravitational binding energy GM/R heats the core.
	const corePressureGPa =
		(3 * GRAVITATIONAL_CONSTANT * massKg ** 2) /
		(8 * Math.PI * radiusM ** 4) /
		1e9
	const heatCapacity = bulk.gas > 0.3 ? GAS_HEAT_CAPACITY : ROCKY_HEAT_CAPACITY
	const coreTemperatureK = Math.min(
		surfaceTemperatureK +
			(GRAVITATIONAL_HEATING_SHARE * GRAVITATIONAL_CONSTANT * massKg) /
				(radiusM * heatCapacity),
		2e6,
	)
	const layers: PlanetLayer[] = []
	const push = (
		name: string,
		phase: PlanetLayer["phase"],
		innerRadius: number,
		outerRadius: number,
		color: string,
	) => {
		if (outerRadius - innerRadius < 1e-4) return
		layers.push({ name, phase, innerRadius, outerRadius, color })
	}
	const innerCore = INNER_CORE_FRACTION * coreRadius
	push("Inner core", "solid", 0, innerCore, LAYER_COLORS.innerCore)
	push("Outer core", "liquid", innerCore, coreRadius, LAYER_COLORS.outerCore)
	const mantleSplit = Math.sqrt(
		Math.max(1 - MANTLE_TRANSITION_GPA / Math.max(corePressureGPa, 1), 0),
	)
	if (mantleRadius - coreRadius > 0.03) {
		push(
			"Lower mantle",
			"solid",
			coreRadius,
			Math.max(coreRadius + 1e-3, mantleRadius * mantleSplit),
			LAYER_COLORS.lowerMantle,
		)
		push(
			"Upper mantle",
			"solid",
			Math.max(coreRadius + 1e-3, mantleRadius * mantleSplit),
			mantleRadius,
			LAYER_COLORS.upperMantle,
		)
	} else if (mantleRadius > coreRadius) {
		push("Mantle", "solid", coreRadius, mantleRadius, LAYER_COLORS.upperMantle)
	}
	if (surfaceRadius > mantleRadius) {
		const frozen = surfaceTemperatureK < 250
		push(
			frozen ? "Ice shell" : "Ocean",
			frozen ? "solid" : "liquid",
			mantleRadius,
			surfaceRadius,
			frozen ? LAYER_COLORS.ice : LAYER_COLORS.ocean,
		)
	}
	if (surfacesEnvelope({ massEarth: mass, composition: bulk })) {
		push("Envelope", "gas", surfaceRadius, 1, LAYER_COLORS.envelope)
	} else if (1 - surfaceRadius > 0.002) {
		push("Crust", "solid", surfaceRadius, 1, LAYER_COLORS.crust)
	}
	return {
		layers: layers.toSorted((a, b) => b.outerRadius - a.outerRadius),
		coreTemperatureK,
		corePressureGPa,
		radiusKm: radius,
	}
}

function surfacesEnvelope({
	massEarth,
	composition,
}: {
	massEarth: number
	composition: PlanetComposition
}): boolean {
	return composition.gas > 0.005 || massEarth >= GAS_GIANT_MIN_MASS
}

export const PLANET = {
	EARTH_RADIUS_KM,
	EARTH_GRAVITY_MS2,
	state,
	interior,
}
