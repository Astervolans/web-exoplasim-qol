import { useId } from "react"
import { HelpCircleIcon } from "@/ui/components/primitives/icons/HelpCircleIcon"
import { Tooltip } from "@/ui/components/primitives/Tooltip"
import type { InputLabelProps } from "@/ui/components/primitives/tooltip/types"
import { uiTokens } from "@/ui/components/tokens"
import { I18N } from "@/ui/i18n"

export function InputLabel({ label, help, name }: InputLabelProps) {
	const id = useId()
	return (
		<span className={uiTokens.field.labelWithHelp}>
			{label}
			<Tooltip id={id} content={help}>
				<span
					role="button"
					tabIndex={0}
					aria-label={I18N.t("About {name}", {
						name:
							name ??
							(typeof label === "string" ? label : I18N.t("this input")),
					})}
					aria-describedby={id}
					className={uiTokens.field.helpTrigger}
					onClick={(event) => event.currentTarget.focus()}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault()
							event.currentTarget.click()
						}
					}}
				>
					<HelpCircleIcon className={uiTokens.field.helpIcon} />
				</span>
			</Tooltip>
		</span>
	)
}
