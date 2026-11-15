import type { RgbColor } from "@/model/shared/color/color-palettes/types"

export type StarPhase = "mainSequence" | "substellar"

export interface StarRequest {
	massSolar: number
	ageGyr: number
}

export interface StarState {
	massSolar: number
	ageGyr: number
	phase: StarPhase
	lifetimeGyr: number
	maxAgeGyr: number
	lifeFraction: number
	temperatureK: number
	luminositySolar: number
	radiusSolar: number
	gravitySolar: number
	spectralClass: string
	color: RgbColor
}

export interface StarSpectralClass {
	letter: string
	subclass: number
	luminosityClass: string
	label: string
}

export interface StarClassRequest {
	massSolar: number
	radiusSolar: number
	temperatureK: number
}

export interface StarSpectralSwatch {
	letter: string
	temperatureK: number
	color: RgbColor
}

export interface StarLuminosityRequest {
	massSolar: number
	lifeFraction: number
}

export interface StarFluxRequest {
	luminositySolar: number
	distanceAu: number
}

export interface StarTemperatureRequest {
	temperatureK: number
}
