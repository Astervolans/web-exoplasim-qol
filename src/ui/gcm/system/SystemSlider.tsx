import { EditableNumberValue } from "@/ui/components/primitives/EditableNumberValue"
import { InputLabel } from "@/ui/components/primitives/InputLabel"
import { uiTokens } from "@/ui/components/tokens"
import type { GcmSystemSliderProps } from "@/ui/gcm/system/types"

const POSITION_STEP = 0.001

function logPosition({
	value,
	min,
	max,
}: {
	value: number
	min: number
	max: number
}): number {
	const clamped = Math.min(Math.max(value, min), max)
	return (Math.log(clamped) - Math.log(min)) / (Math.log(max) - Math.log(min))
}

function logValue({
	position,
	min,
	max,
}: {
	position: number
	min: number
	max: number
}): number {
	const clamped = Math.min(Math.max(position, 0), 1)
	return Math.exp(Math.log(min) + (Math.log(max) - Math.log(min)) * clamped)
}

export function SystemSlider({
	label,
	help,
	value,
	display,
	min,
	max,
	step,
	scale,
	disabled,
	onChange,
}: GcmSystemSliderProps) {
	const position = scale === "log" ? logPosition({ value, min, max }) : value
	return (
		<div>
			<div className="flex items-baseline justify-between gap-2">
				<span className={uiTokens.field.label}>
					{help ? <InputLabel label={label} help={help} /> : label}
				</span>
				<EditableNumberValue
					label={label}
					value={display}
					numericValue={value}
					min={min}
					max={max}
					disabled={disabled}
					valueClassName={uiTokens.field.value}
					onChange={onChange}
				/>
			</div>
			<input
				type="range"
				aria-label={label}
				min={scale === "log" ? 0 : min}
				max={scale === "log" ? 1 : max}
				step={scale === "log" ? POSITION_STEP : step}
				value={position}
				disabled={disabled}
				onChange={(event) => {
					const next = Number(event.target.value)
					onChange(
						scale === "log" ? logValue({ position: next, min, max }) : next,
					)
				}}
				className={uiTokens.field.range}
			/>
		</div>
	)
}
