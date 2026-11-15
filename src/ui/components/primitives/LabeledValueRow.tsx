import React from "react"
import { cx } from "@/ui/components/lib"
import { uiTokens } from "@/ui/components/tokens"

type RowTone = "panel" | "overlay"
type RowSize = "sm" | "md"

const labelToneClassName: Record<RowTone, Record<RowSize, string>> = {
	panel: {
		sm: `${uiTokens.type.label} ${uiTokens.text.muted}`,
		md: `${uiTokens.type.labelMd} ${uiTokens.text.muted}`,
	},
	overlay: {
		sm: `${uiTokens.type.labelWide} ${uiTokens.text.inverseMuted}`,
		md: `${uiTokens.type.labelMd} ${uiTokens.text.inverseMuted}`,
	},
}

const valueToneClassName: Record<RowTone, Record<RowSize, string>> = {
	panel: {
		sm: `${uiTokens.type.value} ${uiTokens.text.primary}`,
		md: `${uiTokens.type.valueMd} ${uiTokens.text.primary}`,
	},
	overlay: {
		sm: `${uiTokens.type.valueSm} text-slate-100`,
		md: `${uiTokens.type.value} text-slate-100`,
	},
}

interface LabeledValueRowProps {
	label: React.ReactNode
	value: React.ReactNode
	tone?: RowTone
	// [JUSTIFICATION] Dense panels keep the small row; illustrated panels opt into the larger one.
	size?: RowSize
	className?: string
	labelClassName?: string
	valueClassName?: string
	align?: "baseline" | "start"
}

export const LabeledValueRow: React.FC<LabeledValueRowProps> = ({
	label,
	value,
	tone = "panel",
	size = "sm",
	className,
	labelClassName,
	valueClassName,
	align = "baseline",
}) => (
	<div
		className={cx(
			"flex justify-between gap-2",
			align === "start" ? "items-start" : "items-baseline",
			className,
		)}
	>
		<span className={cx(labelToneClassName[tone][size], labelClassName)}>
			{label}
		</span>
		<div
			className={cx(
				"text-right",
				valueToneClassName[tone][size],
				valueClassName,
			)}
		>
			{value}
		</div>
	</div>
)
