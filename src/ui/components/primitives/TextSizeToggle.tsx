import { SegmentedControl } from "@/ui/components/primitives/SegmentedControl"
import { I18N } from "@/ui/i18n"
import { TEXT_SIZE } from "@/ui/preferences"
import type { UiTextSize } from "@/ui/preferences/types"

export function TextSizeToggle() {
	const size = TEXT_SIZE.useTextSize()
	return (
		<SegmentedControl
			options={TEXT_SIZE.SIZES.map(({ id, label }) => ({
				value: id,
				label: I18N.t(label),
			}))}
			value={size}
			onChange={(value) => TEXT_SIZE.setTextSize(value as UiTextSize)}
		/>
	)
}
