import type { ReactNode } from "react"
import type { AtmosphereProfile } from "@/model/celestial/atmosphere/types"
import type { OrbitZones } from "@/model/celestial/orbit/types"
import type { PlanetLayer } from "@/model/celestial/planet/types"
import type { StarSpectralSwatch } from "@/model/celestial/star/types"
import type { GcmSystemSummary } from "@/model/climate/gcm/system/types"
import type { GcmTerrain } from "@/model/climate/gcm/terrain/types"
import type { GcmConfig } from "@/model/climate/gcm/types"
import type { GcmStarPoint } from "@/ui/gcm/star-points/types"
import type { GcmZoneCircle } from "@/ui/gcm/zone-circles/types"
import type { UnitSystem } from "@/ui/genesis/shared/ui-format"

export interface GcmSystemPanelProps {
	config: GcmConfig
	summary: GcmSystemSummary
	disabled: boolean
	locked: boolean
	onChange: (config: GcmConfig) => void
}

export interface GcmPlanetPanelProps extends GcmSystemPanelProps {
	hasTerrain: boolean
	latitudes: number
	unitSystem: UnitSystem
	starPoints: ReadonlyArray<GcmStarPoint>
	zoneCircles: ReadonlyArray<GcmZoneCircle>
	onTerrainChange: (terrain: GcmTerrain | null) => void
}

export interface GcmAtmospherePanelProps extends GcmSystemPanelProps {
	maxElevationKm: number
	unitSystem: UnitSystem
}

export interface GcmSystemSliderProps {
	label: string
	// [JUSTIFICATION] Not every slider needs contextual help.
	help?: string
	value: number
	display: ReactNode
	min: number
	max: number
	step: number
	scale: "linear" | "log"
	disabled: boolean
	onChange: (value: number) => void
}

export interface GcmStarRowsRequest {
	summary: GcmSystemSummary
}

export interface GcmPlanetRowsRequest {
	summary: GcmSystemSummary
}

export interface GcmOrbitRowsRequest {
	summary: GcmSystemSummary
}

export interface GcmTidalLockAdviceRequest {
	summary: GcmSystemSummary
	synchronous: boolean
}

export interface GcmAtmosphereRowsRequest {
	summary: GcmSystemSummary
	unitSystem: UnitSystem
}

export interface GcmSpectralStripProps {
	swatches: ReadonlyArray<StarSpectralSwatch>
	activeLetter: string
}

export interface GcmOrbitDiagramProps {
	semiMajorAxisAu: number
	eccentricity: number
	periodDays: number
	zones: OrbitZones
	planetRadiusEarth: number
	planetColor: string
	starColor: string
}

export interface GcmInteriorDiagramProps {
	layers: ReadonlyArray<PlanetLayer>
	radiusKm: number
	obliquityDeg: number
	coreTemperatureK: number
	corePressureGPa: number
}

export interface GcmAtmosphereColumnProps {
	profile: AtmosphereProfile
	surfaceTemperatureK: number
	surfacePressureBar: number
	scaleHeightKm: number
	regimeLabel: string
	maxElevationKm: number
}
