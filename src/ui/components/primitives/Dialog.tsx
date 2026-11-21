import { useEffect, useRef } from "react"
import { cx } from "@/ui/components/lib"
import { Button } from "@/ui/components/primitives/Button"
import { uiTokens } from "@/ui/components/tokens"
import { I18N } from "@/ui/i18n"

interface DialogProps {
	open: boolean
	title: string
	titleId: string
	onClose: () => void
	children: React.ReactNode
}

export function Dialog({
	open,
	title,
	titleId,
	onClose,
	children,
}: DialogProps) {
	const dialog = useRef<HTMLDialogElement>(null)
	useEffect(() => {
		const element = dialog.current
		if (!element) return
		if (open && !element.open) element.showModal()
		else if (!open && element.open) element.close()
	}, [open])
	return (
		<dialog
			ref={dialog}
			aria-labelledby={titleId}
			onCancel={(event) => {
				event.preventDefault()
				onClose()
			}}
			onClose={onClose}
			className={cx(
				"m-auto max-h-[90vh] w-[min(36rem,95vw)] overflow-y-auto p-4",
				uiTokens.surface.panel,
				uiTokens.radius.md,
				uiTokens.shadow.lg,
			)}
		>
			<div className="mb-3 flex items-center justify-between gap-2">
				<h2 id={titleId} className={uiTokens.type.title}>
					{title}
				</h2>
				<Button onClick={onClose}>{I18N.t("Close")}</Button>
			</div>
			{children}
		</dialog>
	)
}
