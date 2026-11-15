import type {
	GcmEnergyBudget,
	GcmEnergyBudgetRequest,
} from "@/model/climate/gcm/energy/types"
import { GCM_FIELDS } from "@/model/climate/gcm/fields"
import type { GcmFieldId } from "@/model/climate/gcm/fields/types"
import { GCM_GRID } from "@/model/climate/gcm/grid"

const STEFAN_BOLTZMANN = 5.670374419e-8

function budget({
	config,
	snapshot,
}: GcmEnergyBudgetRequest): GcmEnergyBudget | null {
	const mean = (field: GcmFieldId) =>
		GCM_GRID.globalMean(GCM_FIELDS.field({ snapshot, field }))
	const toaShortwave = mean("toaShortwave")
	const toaLongwave = mean("toaLongwave")
	const surfaceShortwave = mean("surfaceShortwave")
	const surfaceLongwave = mean("surfaceLongwave")
	const sensibleFlux = mean("sensibleHeatFlux")
	const latentFlux = mean("latentHeatFlux")
	const surfaceTemperature = mean("surfaceTemperature")
	const surfaceAlbedo = Math.min(Math.max(mean("albedo"), 0), 0.95)
	const eccentricity = Math.min(Math.max(config.eccentricity, 0), 0.95)
	const incoming =
		config.fluxWm2 / 4 / Math.sqrt(1 - eccentricity * eccentricity)
	const absorbed = Math.max(0, toaShortwave)
	const outgoing = Math.max(0, -toaLongwave)
	const surfaceAbsorbed = Math.min(absorbed, Math.max(0, surfaceShortwave))
	const surfaceEmission =
		STEFAN_BOLTZMANN * Math.max(surfaceTemperature, 1) ** 4
	const latent = Math.max(0, -latentFlux)
	const sensible = Math.max(0, -sensibleFlux)
	const numbers = [
		incoming,
		absorbed,
		outgoing,
		surfaceAbsorbed,
		surfaceEmission,
		latent,
		sensible,
	]
	if (numbers.some((value) => !Number.isFinite(value))) return null
	if (!Number.isFinite(surfaceLongwave) || !Number.isFinite(surfaceShortwave))
		return null
	const reflected = Math.max(0, incoming - absorbed)
	const upward = surfaceEmission + latent + sensible
	const surfaceReflected = Math.min(
		reflected,
		surfaceAlbedo > 0
			? surfaceAbsorbed * (surfaceAlbedo / (1 - surfaceAlbedo))
			: 0,
	)
	const turn = Math.max(0, upward - outgoing)
	return {
		incoming,
		reflected,
		albedo: incoming > 0 ? reflected / incoming : 0,
		absorbed,
		airAbsorbed: Math.max(0, absorbed - surfaceAbsorbed),
		surfaceAbsorbed,
		surfaceEmission,
		latent,
		sensible,
		upward,
		reflectedSurface: surfaceReflected,
		reflectedAir: Math.max(0, reflected - surfaceReflected),
		turn,
		backRadiation: turn + Math.max(0, absorbed - surfaceAbsorbed),
		surfaceAlbedo,
		outgoing,
		stored: absorbed - outgoing,
		surfaceStorage: mean("surfaceNetHeat"),
		surfaceTemperatureK: surfaceTemperature,
	}
}

export const GCM_ENERGY = { budget }
