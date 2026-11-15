import type {
	StarClassRequest,
	StarFluxRequest,
	StarLuminosityRequest,
	StarRequest,
	StarSpectralClass,
	StarSpectralSwatch,
	StarState,
	StarTemperatureRequest,
} from "@/model/celestial/star/types"
import type { RgbColor } from "@/model/shared/color/color-palettes/types"
import { MATH } from "@/model/shared/math/core"

// ZAMS polynomials from Tout et al. (1996), MNRAS 281, 257. Luminosity and
// radius are in solar units for the given zero-age main-sequence mass.
const MIN_MASS_SOLAR = 0.012
const MAX_MASS_SOLAR = 10
const STELLAR_BRANCH_MASS = 0.08
const HYDROGEN_BURNING_EDGE_MASS = 0.0775
const SUBSTELLAR_BLEND_MASS = 0.075
const SUBGIANT_GRAVITY_RATIO = 0.457
const SOLAR_TEMPERATURE_K = 5778
const SOLAR_AGE_GYR = 4.6
const MAIN_SEQUENCE_END_FRACTION = 0.95
const MS_SWELL_EXPONENT = 2.1
const MS_SWELL_MASS_EXPONENT = 2.4
const MS_SWELL_MASS_SATURATION = 1.5
const MAX_LIFETIME_GYR = 50
const SOLAR_FLUX_WM2 = 1367

const SPECTRAL_CUTS: ReadonlyArray<{
	letter: string
	hotK: number
	coolK: number
}> = [
	{ letter: "Y", hotK: 550, coolK: 250 },
	{ letter: "T", hotK: 1300, coolK: 550 },
	{ letter: "L", hotK: 2400, coolK: 1300 },
	{ letter: "M", hotK: 3700, coolK: 2400 },
	{ letter: "K", hotK: 5200, coolK: 3700 },
	{ letter: "G", hotK: 6000, coolK: 5200 },
	{ letter: "F", hotK: 7500, coolK: 6000 },
	{ letter: "A", hotK: 10000, coolK: 7500 },
	{ letter: "B", hotK: 30000, coolK: 10000 },
	{ letter: "O", hotK: 50000, coolK: 30000 },
]

const SWATCHES: ReadonlyArray<StarSpectralSwatch> = [
	{ letter: "Y", temperatureK: 400, color: [0.134, 0.045, 0.188] },
	{ letter: "T", temperatureK: 900, color: [0.52, 0.13, 0.56] },
	{ letter: "L", temperatureK: 1850, color: [0.577, 0.089, 0.102] },
	{ letter: "M", temperatureK: 3200, color: [1, 0.55, 0.42] },
	{ letter: "K", temperatureK: 4500, color: [1, 0.82, 0.56] },
	{ letter: "G", temperatureK: 5700, color: [1, 0.96, 0.62] },
	{ letter: "F", temperatureK: 6700, color: [0.91, 1, 0.78] },
	{ letter: "A", temperatureK: 9000, color: [0.78, 0.9, 1] },
	{ letter: "B", temperatureK: 20000, color: [0.42, 0.74, 1] },
	{ letter: "O", temperatureK: 40000, color: [0.12, 0.48, 0.95] },
]

const SUBSTELLAR_STOPS: ReadonlyArray<{
	temperatureK: number
	color: RgbColor
}> = [
	{ temperatureK: 250, color: [0.05, 0.02, 0.07] },
	{ temperatureK: 450, color: [0.15, 0.05, 0.21] },
	{ temperatureK: 600, color: [0.33, 0.09, 0.42] },
	{ temperatureK: 900, color: [0.52, 0.13, 0.56] },
	{ temperatureK: 1200, color: [0.62, 0.14, 0.5] },
	{ temperatureK: 1450, color: [0.48, 0.07, 0.15] },
	{ temperatureK: 1900, color: [0.58, 0.09, 0.1] },
	{ temperatureK: 2400, color: [0.72, 0.16, 0.11] },
]

function zamsLuminosity(massSolar: number): number {
	const m = Math.max(massSolar, STELLAR_BRANCH_MASS)
	return (
		(0.3970417 * m ** 5.5 + 8.527626 * m ** 11) /
		(0.00025546 +
			m ** 3 +
			5.432889 * m ** 5 +
			5.563579 * m ** 7 +
			0.7886606 * m ** 8 +
			0.00586685 * m ** 9.5)
	)
}

function zamsRadius(massSolar: number): number {
	const m = Math.max(massSolar, STELLAR_BRANCH_MASS)
	return (
		(1.715359 * m ** 2.5 +
			6.597788 * m ** 6.5 +
			10.08855 * m ** 11 +
			1.012495 * m ** 19 +
			0.07490166 * m ** 19.5) /
		(0.01077422 +
			3.082234 * m ** 2 +
			17.84778 * m ** 8.5 +
			m ** 18.5 +
			0.00022582 * m ** 19.5)
	)
}

function lifetimeGyr(massSolar: number): number {
	return Math.min(
		MAX_LIFETIME_GYR,
		10 * Math.max(massSolar, STELLAR_BRANCH_MASS) ** -2.5,
	)
}

function maxAgeGyr(massSolar: number): number {
	return Math.max(0.1, lifetimeGyr(massSolar) * MAIN_SEQUENCE_END_FRACTION)
}

function brightening({ lifeFraction }: { lifeFraction: number }): number {
	const sunFraction = SOLAR_AGE_GYR / lifetimeGyr(1)
	return 1.4 / (1.4 - (0.4 * MATH.clamp01(lifeFraction)) / sunFraction)
}

function swelling({
	lifeFraction,
	massSolar,
}: {
	lifeFraction: number
	massSolar: number
}): number {
	const sunFraction = SOLAR_AGE_GYR / lifetimeGyr(1)
	const amplitude = (1 / zamsRadius(1) - 1) / sunFraction ** MS_SWELL_EXPONENT
	const massTerm =
		MATH.clamp({
			value: massSolar,
			lo: STELLAR_BRANCH_MASS,
			hi: MS_SWELL_MASS_SATURATION,
		}) ** MS_SWELL_MASS_EXPONENT
	return (
		1 + amplitude * massTerm * MATH.clamp01(lifeFraction) ** MS_SWELL_EXPONENT
	)
}

function mainSequenceLuminosity({
	massSolar,
	lifeFraction,
}: StarLuminosityRequest): number {
	return (
		(zamsLuminosity(massSolar) / zamsLuminosity(1)) *
		(brightening({ lifeFraction }) / 1.4)
	)
}

function mainSequenceRadius({
	massSolar,
	lifeFraction,
}: StarLuminosityRequest): number {
	return (
		(zamsRadius(massSolar) / zamsRadius(1)) *
		(swelling({ lifeFraction, massSolar }) /
			swelling({
				lifeFraction: SOLAR_AGE_GYR / lifetimeGyr(1),
				massSolar: 1,
			}))
	)
}

function substellarAgeGyr({
	massSolar,
	lifeFraction,
}: StarLuminosityRequest): number {
	return MATH.clamp01(lifeFraction) * lifetimeGyr(massSolar)
}

function branchWeight(massSolar: number): number {
	return MATH.smoothstep({
		edge0: SUBSTELLAR_BLEND_MASS,
		edge1: STELLAR_BRANCH_MASS,
		x: massSolar,
	})
}

function substellarLuminosity({
	massSolar,
	lifeFraction,
}: StarLuminosityRequest): number {
	const edge = mainSequenceLuminosity({
		massSolar: STELLAR_BRANCH_MASS,
		lifeFraction,
	})
	const age = Math.max(substellarAgeGyr({ massSolar, lifeFraction }), 0.01)
	const cooling =
		4e-5 * age ** -1.3 * (Math.max(massSolar, 0.001) / 0.05) ** 2.64
	const bounded = (cooling ** -2 + edge ** -2) ** -0.5
	return Math.exp(
		MATH.lerp({
			start: Math.log(bounded),
			end: Math.log(edge),
			position: branchWeight(massSolar),
		}),
	)
}

function substellarTemperature({
	massSolar,
	lifeFraction,
}: StarLuminosityRequest): number {
	const edge = mainSequenceTemperature({
		massSolar: STELLAR_BRANCH_MASS,
		lifeFraction,
	})
	const age = Math.max(substellarAgeGyr({ massSolar, lifeFraction }), 0.01)
	const cooling =
		1550 * age ** -0.32 * (Math.max(massSolar, 0.001) / 0.05) ** 0.83
	const bounded = (cooling ** -8 + edge ** -8) ** -0.125
	return Math.exp(
		MATH.lerp({
			start: Math.log(bounded),
			end: Math.log(edge),
			position: branchWeight(massSolar),
		}),
	)
}

function mainSequenceTemperature({
	massSolar,
	lifeFraction,
}: StarLuminosityRequest): number {
	const radius = mainSequenceRadius({ massSolar, lifeFraction })
	const luminosity = mainSequenceLuminosity({ massSolar, lifeFraction })
	return (
		SOLAR_TEMPERATURE_K * (luminosity / Math.max(radius * radius, 1e-6)) ** 0.25
	)
}

function luminosity({
	massSolar,
	lifeFraction,
}: StarLuminosityRequest): number {
	return massSolar < STELLAR_BRANCH_MASS
		? substellarLuminosity({ massSolar, lifeFraction })
		: mainSequenceLuminosity({ massSolar, lifeFraction })
}

function temperature({
	massSolar,
	lifeFraction,
}: StarLuminosityRequest): number {
	return massSolar < STELLAR_BRANCH_MASS
		? substellarTemperature({ massSolar, lifeFraction })
		: mainSequenceTemperature({ massSolar, lifeFraction })
}

function radius({ massSolar, lifeFraction }: StarLuminosityRequest): number {
	if (massSolar >= STELLAR_BRANCH_MASS)
		return mainSequenceRadius({ massSolar, lifeFraction })
	const ratio = temperature({ massSolar, lifeFraction }) / SOLAR_TEMPERATURE_K
	return Math.sqrt(luminosity({ massSolar, lifeFraction })) / (ratio * ratio)
}

function spectralCut({ temperatureK }: StarTemperatureRequest) {
	return (
		SPECTRAL_CUTS.find((entry) => temperatureK < entry.hotK) ?? SPECTRAL_CUTS[0]
	)
}

function classification({
	massSolar,
	radiusSolar,
	temperatureK,
}: StarClassRequest): StarSpectralClass {
	const cut = spectralCut({ temperatureK })
	const position = MATH.clamp({
		value: temperatureK,
		lo: cut.coolK,
		hi: cut.hotK,
	})
	const subclass =
		Math.round(
			MATH.clamp({
				value: (9 * (cut.hotK - position)) / Math.max(cut.hotK - cut.coolK, 1),
				lo: 0,
				hi: 9.9,
			}) * 10,
		) / 10
	if (massSolar < HYDROGEN_BURNING_EDGE_MASS)
		return {
			letter: cut.letter,
			subclass,
			luminosityClass: "",
			label: `${cut.letter}${subclass.toFixed(1)}`,
		}
	const luminosityClass =
		massSolar / Math.max(radiusSolar * radiusSolar, 1e-6) <
		SUBGIANT_GRAVITY_RATIO
			? "IV"
			: "V"
	return {
		letter: cut.letter,
		subclass,
		luminosityClass,
		label: `${cut.letter}${subclass.toFixed(1)} ${luminosityClass}`,
	}
}

function substellarColor({ temperatureK }: StarTemperatureRequest): RgbColor {
	const value = MATH.clamp({ value: temperatureK, lo: 250, hi: 2400 })
	for (let i = 0; i < SUBSTELLAR_STOPS.length - 1; i++) {
		const left = SUBSTELLAR_STOPS[i]
		const right = SUBSTELLAR_STOPS[i + 1]
		if (value > right.temperatureK) continue
		const weight = MATH.smoothstep({
			edge0: left.temperatureK,
			edge1: right.temperatureK,
			x: value,
		})
		return [
			MATH.lerp({
				start: left.color[0],
				end: right.color[0],
				position: weight,
			}),
			MATH.lerp({
				start: left.color[1],
				end: right.color[1],
				position: weight,
			}),
			MATH.lerp({
				start: left.color[2],
				end: right.color[2],
				position: weight,
			}),
		]
	}
	return SUBSTELLAR_STOPS[SUBSTELLAR_STOPS.length - 1].color
}

function swatchColor({ temperatureK }: StarTemperatureRequest): RgbColor {
	if (temperatureK < SPECTRAL_CUTS[2].hotK)
		return substellarColor({ temperatureK })
	const letter = spectralCut({ temperatureK }).letter
	return (
		SWATCHES.find((swatch) => swatch.letter === letter)?.color ??
		SWATCHES[SWATCHES.length - 1].color
	)
}

function state({ massSolar, ageGyr }: StarRequest): StarState {
	const mass = MATH.clamp({
		value: massSolar,
		lo: MIN_MASS_SOLAR,
		hi: MAX_MASS_SOLAR,
	})
	const lifetime = lifetimeGyr(mass)
	const maxAge = maxAgeGyr(mass)
	const age = Math.max(ageGyr, 0)
	const lifeFraction = MATH.clamp01(age / Math.max(lifetime, 0.001))
	const phase = mass < STELLAR_BRANCH_MASS ? "substellar" : "mainSequence"
	const luminositySolar = luminosity({ massSolar: mass, lifeFraction })
	const radiusSolar = radius({ massSolar: mass, lifeFraction })
	const temperatureK = temperature({ massSolar: mass, lifeFraction })
	const spectral = classification({
		massSolar: mass,
		radiusSolar,
		temperatureK,
	})
	return {
		massSolar: mass,
		ageGyr: age,
		phase,
		lifetimeGyr: lifetime,
		maxAgeGyr: maxAge,
		lifeFraction,
		temperatureK,
		luminositySolar,
		radiusSolar,
		gravitySolar: mass / Math.max(radiusSolar * radiusSolar, 1e-6),
		spectralClass: spectral.label,
		color: swatchColor({ temperatureK }),
	}
}

function flux({ luminositySolar, distanceAu }: StarFluxRequest): number {
	return (
		(SOLAR_FLUX_WM2 * luminositySolar) / Math.max(distanceAu * distanceAu, 1e-8)
	)
}

export const STAR = {
	MIN_MASS_SOLAR,
	MAX_MASS_SOLAR,
	SOLAR_TEMPERATURE_K,
	SWATCHES,
	state,
	maxAgeGyr,
	flux,
}
