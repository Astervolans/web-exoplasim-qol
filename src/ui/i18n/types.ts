export type I18nLanguage = "en" | "zh"

export type I18nMessages = Readonly<Record<string, string>>

export type I18nParams = Readonly<Record<string, string | number>>

export interface I18nLanguageOption {
	id: I18nLanguage
	label: string
}
