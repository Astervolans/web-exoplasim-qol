import { useEffect, useMemo, useRef, useState } from "react"
import { GCM_TERRAIN } from "@/model/climate/gcm/terrain"
import { GCM_TERRAIN_IMPORT } from "@/model/climate/gcm/terrain/import"
import type {
	GcmTerrainImage,
	GcmTerrainMapping,
} from "@/model/climate/gcm/terrain/import/types"
import { GCM_TERRAIN_ORIENTATION } from "@/model/climate/gcm/terrain/orientation"
import type { GcmTerrainOrientation } from "@/model/climate/gcm/terrain/orientation/types"
import type { GcmTerrainUpload } from "@/ui/gcm/terrain/types"
import { I18N } from "@/ui/i18n"

export function useTerrainImport() {
	const [heightmap, setHeightmap] = useState<GcmTerrainImage | null>(null)
	const [mask, setMask] = useState<GcmTerrainImage | null>(null)
	const [mapping, setMapping] = useState<GcmTerrainMapping>({
		maxElevationM: 8000,
		seaLevel: 0,
		invertMask: false,
	})
	const [previewMapping, setPreviewMapping] = useState(mapping)
	useEffect(() => {
		const timer = setTimeout(() => setPreviewMapping(mapping), 150)
		return () => clearTimeout(timer)
	}, [mapping])
	const [orientation, setOrientation] = useState<GcmTerrainOrientation>(
		GCM_TERRAIN_ORIENTATION.DEFAULT,
	)
	const [fileError, setFileError] = useState("")
	const [pending, setPending] = useState(0)
	const versions = useRef({ heightmap: 0, mask: 0 })
	// The raster is independent of the orientation: rotating the map only
	// changes how the model reads it. Rebuild the expensive arrays for
	// heightmap/mask/mapping changes, then attach orientation cheaply.
	const base = useMemo(() => {
		try {
			if (!heightmap) return { terrain: null, summary: null, error: "" }
			const terrain = GCM_TERRAIN_IMPORT.create({
				heightmap,
				mask,
				mapping: previewMapping,
				orientation: GCM_TERRAIN_ORIENTATION.DEFAULT,
			})
			return {
				terrain,
				summary: GCM_TERRAIN.summary(terrain),
				error: "",
			}
		} catch (error) {
			return {
				terrain: null,
				summary: null,
				error: String(error instanceof Error ? error.message : error),
			}
		}
	}, [heightmap, mask, previewMapping])
	const terrain = useMemo(
		() =>
			base.terrain && {
				...base.terrain,
				orientation: GCM_TERRAIN_ORIENTATION.validate(orientation),
			},
		[base.terrain, orientation],
	)
	const read = async ({ file, kind }: GcmTerrainUpload) => {
		const version = ++versions.current[kind]
		setPending((value) => value + 1)
		setFileError("")
		if (kind === "heightmap") setHeightmap(null)
		else setMask(null)
		try {
			if (file.size > GCM_TERRAIN_IMPORT.MAX_FILE_BYTES)
				throw new Error(I18N.t("Terrain files must be smaller than 64 MiB"))
			const image = GCM_TERRAIN_IMPORT.read({
				name: file.name,
				buffer: await file.arrayBuffer(),
			})
			if (version !== versions.current[kind]) return
			if (kind === "mask" && image.encoding !== "normalized")
				throw new Error(I18N.t("Choose a PNG land mask"))
			if (kind === "heightmap") setHeightmap(image)
			else setMask(image)
		} catch (error) {
			if (version === versions.current[kind])
				setFileError(error instanceof Error ? error.message : String(error))
		} finally {
			setPending((value) => value - 1)
		}
	}
	return {
		terrain,
		summary: base.summary,
		error: fileError || base.error,
		heightmap,
		mask,
		mapping,
		setMapping,
		orientation,
		setOrientation,
		read,
		busy: pending > 0,
		updating: mapping !== previewMapping,
		removeMask: () => {
			versions.current.mask++
			setMask(null)
			setFileError("")
		},
	}
}
