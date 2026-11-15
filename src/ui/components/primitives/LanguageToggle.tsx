import { SegmentedControl } from "@/ui/components/primitives/SegmentedControl"
import { I18N } from "@/ui/i18n"
import type { I18nLanguage } from "@/ui/i18n/types"

export function LanguageToggle() {
	const language = I18N.useLanguage()
	return (
		<SegmentedControl
			options={I18N.LANGUAGES.map(({ id, label }) => ({ value: id, label }))}
			value={language}
			onChange={(value) => I18N.setLanguage(value as I18nLanguage)}
		/>
	)
}
