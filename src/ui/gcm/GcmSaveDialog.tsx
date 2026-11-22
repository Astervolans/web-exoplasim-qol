import { useId } from "react"
import { GCM_AVERAGES } from "@/model/climate/gcm/averages"
import { cx } from "@/ui/components/lib"
import { Button } from "@/ui/components/primitives/Button"
import { Dialog } from "@/ui/components/primitives/Dialog"
import { LabeledSlider } from "@/ui/components/primitives/LabeledSlider"
import { uiTokens } from "@/ui/components/tokens"
import type { GcmSaveDialogProps } from "@/ui/gcm/types"
import { formatBytes } from "@/ui/genesis/shared/ui-format"
import { I18N } from "@/ui/i18n"

function Oversized({ bytes, available }: { bytes: number; available: number }) {
	return (
		<div
			className={cx(
				uiTokens.warning.panel,
				uiTokens.warning.text,
				uiTokens.radius.sm,
			)}
		>
			<p>
				{I18N.t(
					"This export needs about {size}, which may exceed the {free} the browser can still allocate.",
					{ size: formatBytes(bytes), free: formatBytes(available) },
				)}
			</p>
		</div>
	)
}

export function GcmSaveDialog({
	state,
	estimate,
	onYearsChange,
	onConfirm,
	onCancel,
}: GcmSaveDialogProps) {
	const titleId = useId()
	const choosing = state?.mode === "choose" ? state : null
	const oversized = state?.mode === "confirm" ? state : null
	const estimated = choosing ? estimate(choosing.years) : null
	const overBudget =
		estimated !== null &&
		estimated.available !== null &&
		estimated.bytes > estimated.available
	return (
		<Dialog
			open={state !== null}
			title={I18N.t("Save checkpoint")}
			titleId={titleId}
			onClose={onCancel}
		>
			{choosing && estimated && (
				<div className="space-y-3">
					<LabeledSlider
						label={I18N.t("Saved history")}
						help={I18N.t(
							"Months of monthly means a checkpoint keeps as raw fields, for analysis in other software. The climatology of the years beyond them is saved too, so climate maps and classifications survive a reload.",
						)}
						value={
							choosing.years === 1
								? I18N.t("1 year")
								: I18N.t("{years} years", { years: choosing.years })
						}
						numericValue={choosing.years}
						min={1}
						max={GCM_AVERAGES.MAX_HISTORY_YEARS}
						step={1}
						onChange={onYearsChange}
					/>
					{overBudget && estimated.available !== null ? (
						<Oversized
							bytes={estimated.bytes}
							available={estimated.available}
						/>
					) : (
						<p className={uiTokens.field.note}>
							{estimated.includesState
								? I18N.t("Estimated file ≈ {size}", {
										size: formatBytes(estimated.bytes),
									})
								: I18N.t("Estimated file ≈ {size} plus the model state", {
										size: formatBytes(estimated.bytes),
									})}
						</p>
					)}
					<div className={uiTokens.field.actions}>
						<Button size="md" onClick={onConfirm}>
							{I18N.t("Save checkpoint")}
						</Button>
						<Button size="md" onClick={onCancel}>
							{I18N.t("Cancel")}
						</Button>
					</div>
				</div>
			)}
			{oversized && (
				<div className="space-y-3">
					<Oversized bytes={oversized.bytes} available={oversized.available} />
					<div className={uiTokens.field.actions}>
						<Button size="md" onClick={onConfirm}>
							{I18N.t("Export anyway")}
						</Button>
						<Button size="md" onClick={onCancel}>
							{I18N.t("Cancel")}
						</Button>
					</div>
				</div>
			)}
		</Dialog>
	)
}
