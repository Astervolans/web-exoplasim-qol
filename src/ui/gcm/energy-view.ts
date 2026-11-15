import type { GcmEnergyFlows, GcmEnergyFlowsRequest } from "@/ui/gcm/types"

function flows({ model, estimate }: GcmEnergyFlowsRequest): GcmEnergyFlows {
	const turn = model
		? model.turn
		: Math.max(0, estimate.upward - estimate.outgoing)
	const reflectedSurface = model
		? model.reflectedSurface
		: estimate.reflectedBySurface
	const reflectedAir = model ? model.reflectedAir : estimate.reflectedByAir
	const backRadiation = model
		? model.backRadiation
		: turn + estimate.airAbsorbed
	return {
		incoming: model?.incoming ?? estimate.incoming,
		reflected: model?.reflected ?? estimate.reflected,
		albedo: model?.albedo ?? estimate.albedo,
		reflectedSurface,
		reflectedAir,
		airAbsorbed: model?.airAbsorbed ?? estimate.airAbsorbed,
		surfaceAbsorbed: model?.surfaceAbsorbed ?? estimate.surfaceAbsorbed,
		surfaceEmission: model?.surfaceEmission ?? estimate.surfaceEmission,
		latent: model?.latent ?? estimate.latent,
		sensible: model?.sensible ?? estimate.sensible,
		upward: model?.upward ?? estimate.upward,
		turn,
		backRadiation,
		outgoing: model?.outgoing ?? estimate.outgoing,
		stored: model?.stored ?? estimate.stored,
		...(model ? {} : { window: estimate.window }),
	}
}

export const GCM_ENERGY_VIEW = { flows }
