import { useCallback, useState } from "react"

import { cx } from "@/ui/components/lib"

import { Button } from "@/ui/components/primitives/Button"
import { Dialog } from "@/ui/components/primitives/Dialog"

import { FilePicker } from "@/ui/components/primitives/FilePicker"

import { LabeledNumberInput } from "@/ui/components/primitives/LabeledNumberInput"
import { LabeledSlider } from "@/ui/components/primitives/LabeledSlider"

import { ToggleRow } from "@/ui/components/primitives/ToggleRow"

import { uiTokens } from "@/ui/components/tokens"

import { GCM_INPUT_HELP } from "@/ui/gcm/input-help"

import { TerrainPreview } from "@/ui/gcm/terrain/TerrainPreview"

import type { GcmTerrainPanelProps } from "@/ui/gcm/terrain/types"

import { useTerrainImport } from "@/ui/gcm/terrain/useTerrainImport"

import { formatWithUnit, KM_TO_FT } from "@/ui/genesis/shared/ui-format"

import { I18N } from "@/ui/i18n"

export function TerrainPanel({
	hasTerrain,

	disabled,

	unitSystem,

	starPoints,

	zoneCircles,

	onChange,
}: GcmTerrainPanelProps) {
	const upload = useTerrainImport()

	const readTerrain = useCallback(() => upload.terrain, [upload.terrain])
	const [open, setOpen] = useState(false)
	const [emptyElevation, setEmptyElevation] = useState(false)
	const elevationFactor = unitSystem === "imperial" ? KM_TO_FT / 1000 : 1

	return (
		<div className="min-w-0 space-y-2">
			<div className={uiTokens.field.actions}>
				<Button size="md" disabled={disabled} onClick={() => setOpen(true)}>
					{I18N.t("Import terrain")}
				</Button>
				<Button
					size="md"
					disabled={disabled || !hasTerrain}
					onClick={() => onChange(null)}
				>
					{I18N.t("Use Earth")}
				</Button>
			</div>
			<Dialog
				open={open}
				title={I18N.t("Import terrain")}
				titleId="terrain-import-title"
				onClose={() => setOpen(false)}
			>
				<fieldset disabled={disabled || upload.busy} className="space-y-2">
					<FilePicker
						label={I18N.t("Heightmap")}
						help={GCM_INPUT_HELP.heightmap}
						action={I18N.t("Choose heightmap")}
						accept=".png,.bin"
						emptyLabel={I18N.t("Required")}
						fileName={upload.heightmap?.name ?? null}
						disabled={disabled || upload.busy}
						onSelect={(file) => void upload.read({ file, kind: "heightmap" })}
					/>
					<FilePicker
						label={I18N.t("Land mask")}
						help={GCM_INPUT_HELP.landMask}
						action={I18N.t("Choose land mask")}
						accept=".png"
						emptyLabel={I18N.t("Optional")}
						fileName={upload.mask?.name ?? null}
						disabled={disabled || upload.busy}
						onSelect={(file) => void upload.read({ file, kind: "mask" })}
					/>
					{(upload.heightmap || upload.mask) && (
						<div className="space-y-2 pt-2">
							{upload.mask && (
								<div className="flex items-center gap-2">
									<ToggleRow
										className="flex-1"
										label={I18N.t("Invert mask")}
										help={GCM_INPUT_HELP.invertMask}
										checked={upload.mapping.invertMask}
										onChange={(invertMask) =>
											upload.setMapping({ ...upload.mapping, invertMask })
										}
									/>
									<Button
										className={cx(
											uiTokens.uploadAction.base,

											uiTokens.uploadAction.secondary,
										)}
										onClick={upload.removeMask}
										aria-label={I18N.t("Remove mask")}
									>
										{I18N.t("Remove")}
									</Button>
								</div>
							)}
							{upload.heightmap && (
								<>
									<div className="grid grid-cols-2 items-start gap-3">
										<LabeledNumberInput
											label={I18N.t("Maximum elevation")}
											help={GCM_INPUT_HELP.maxElevation}
											unit={unitSystem === "imperial" ? "ft" : "m"}
											value={
												emptyElevation
													? null
													: Number(
															(
																upload.mapping.maxElevationM * elevationFactor
															).toFixed(2),
														)
											}
											placeholder={I18N.t("Enter elevation")}
											min={0}
											disabled={disabled || upload.busy}
											onChange={(value) => {
												setEmptyElevation(value === null)
												if (value !== null)
													upload.setMapping({
														...upload.mapping,
														maxElevationM: value / elevationFactor,
													})
											}}
										/>
										<LabeledSlider
											label={I18N.t("Sea level")}
											rangeClassName={uiTokens.field.grayscaleRange}
											help={GCM_INPUT_HELP.seaLevel}
											value={`${upload.mapping.seaLevel} / 255`}
											min={0}
											max={255}
											step={1}
											numericValue={upload.mapping.seaLevel}
											onChange={(seaLevel) =>
												upload.setMapping({ ...upload.mapping, seaLevel })
											}
										/>
									</div>
									<div className="space-y-2">
										<span className={uiTokens.type.label}>
											{I18N.t("Map orientation")}
										</span>
										<LabeledSlider
											label={I18N.t("North pole latitude")}
											help={GCM_INPUT_HELP.mapPoleLatitude}
											value={formatWithUnit(
												upload.orientation.poleLatitudeDeg,
												"°",
												0,
											)}
											min={-90}
											max={90}
											step={1}
											numericValue={upload.orientation.poleLatitudeDeg}
											disabled={disabled || upload.busy}
											onChange={(poleLatitudeDeg) =>
												upload.setOrientation({
													...upload.orientation,
													poleLatitudeDeg,
												})
											}
										/>
										<LabeledSlider
											label={I18N.t("North pole longitude")}
											help={GCM_INPUT_HELP.mapPoleLongitude}
											value={formatWithUnit(
												upload.orientation.poleLongitudeDeg,
												"°",
												0,
											)}
											min={0}
											max={360}
											step={1}
											numericValue={upload.orientation.poleLongitudeDeg}
											disabled={
												disabled ||
												upload.busy ||
												Math.abs(upload.orientation.poleLatitudeDeg) === 90
											}
											onChange={(poleLongitudeDeg) =>
												upload.setOrientation({
													...upload.orientation,
													poleLongitudeDeg,
												})
											}
										/>
										<LabeledSlider
											label={I18N.t("Spin")}
											help={GCM_INPUT_HELP.mapSpin}
											value={formatWithUnit(upload.orientation.spinDeg, "°", 0)}
											min={0}
											max={360}
											step={1}
											numericValue={upload.orientation.spinDeg}
											disabled={disabled || upload.busy}
											onChange={(spinDeg) =>
												upload.setOrientation({
													...upload.orientation,
													spinDeg,
												})
											}
										/>
									</div>
								</>
							)}
						</div>
					)}
				</fieldset>
				{upload.busy && (
					<p role="status" className={uiTokens.field.note}>
						{I18N.t("Reading terrain…")}
					</p>
				)}
				{upload.error && (
					<p role="alert" className={uiTokens.field.note}>
						{upload.error}
					</p>
				)}
				{upload.terrain && !upload.error && (
					<div className="space-y-2 pt-2">
						<TerrainPreview
							readTerrain={readTerrain}
							starPoints={starPoints}
							zoneCircles={zoneCircles}
							label={I18N.t("Land mask · {percent} land", {
								percent: formatWithUnit(upload.summary.landPercent, "%", 1),
							})}
						/>
					</div>
				)}

				<div className={cx(uiTokens.field.actions, "mt-3")}>
					<Button
						size="md"
						className={cx(
							uiTokens.uploadAction.base,

							uiTokens.uploadAction.primary,
						)}
						disabled={
							disabled ||
							emptyElevation ||
							upload.busy ||
							upload.updating ||
							!upload.terrain ||
							!!upload.error
						}
						onClick={() => {
							onChange(upload.terrain)
							setOpen(false)
						}}
					>
						{I18N.t("Apply terrain")}
					</Button>
				</div>
			</Dialog>
		</div>
	)
}
