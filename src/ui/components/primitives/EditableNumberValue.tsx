import { useState } from "react"
import type { EditableNumberValueProps } from "@/ui/components/primitives/number-input/types"
import { uiTokens } from "@/ui/components/tokens"
import { I18N } from "@/ui/i18n"

export function EditableNumberValue({
	label,
	value,
	numericValue,
	min,
	max,
	disabled,
	valueClassName,
	onChange,
}: EditableNumberValueProps) {
	const [draft, setDraft] = useState<string | null>(null)
	const commit = () => {
		const typed = Number(draft)
		if (
			!disabled &&
			draft !== null &&
			draft.trim() !== "" &&
			Number.isFinite(typed)
		)
			onChange(Math.min(max, Math.max(min, typed)))
		setDraft(null)
	}
	return draft === null ? (
		<button
			type="button"
			disabled={disabled}
			title={I18N.t("Type an exact value ({min} to {max})", { min, max })}
			aria-label={I18N.t("Edit {label}", { label })}
			className={`${valueClassName} ${disabled ? "" : uiTokens.field.valueEditable}`}
			onClick={() => setDraft(String(numericValue))}
		>
			{value}
		</button>
	) : (
		<input
			type="number"
			autoFocus
			aria-label={label}
			min={min}
			max={max}
			step="any"
			value={draft}
			disabled={disabled}
			className={uiTokens.field.valueInput}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") commit()
				if (event.key === "Escape") setDraft(null)
			}}
		/>
	)
}
