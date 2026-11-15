import { useSyncExternalStore } from "react"
import { ZH_MESSAGES } from "@/ui/i18n/messages"
import type {
	I18nLanguage,
	I18nLanguageOption,
	I18nParams,
} from "@/ui/i18n/types"

const STORAGE_KEY = "exoplasim.language"
const LANGUAGES: ReadonlyArray<I18nLanguageOption> = [
	{ id: "en", label: "EN" },
	{ id: "zh", label: "中文" },
]

function storedLanguage(): I18nLanguage | null {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY)
		return value === "en" || value === "zh" ? value : null
	} catch {
		return null
	}
}

function preferredLanguage(): I18nLanguage {
	const stored = storedLanguage()
	if (stored) return stored
	return typeof navigator !== "undefined" &&
		navigator.language.toLowerCase().startsWith("zh")
		? "zh"
		: "en"
}

let language: I18nLanguage = preferredLanguage()
document.documentElement.lang = language === "zh" ? "zh-CN" : "en"
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function setLanguage(next: I18nLanguage): void {
	language = next
	try {
		window.localStorage.setItem(STORAGE_KEY, next)
	} catch {
		// Storage can be unavailable in private or embedded contexts.
	}
	document.documentElement.lang = next === "zh" ? "zh-CN" : "en"
	for (const listener of listeners) listener()
}

function useLanguage(): I18nLanguage {
	return useSyncExternalStore(subscribe, () => language)
}

function t(key: string, params?: I18nParams): string {
	const text = language === "zh" ? (ZH_MESSAGES[key] ?? key) : key
	if (!params) return text
	return text.replace(/\{(\w+)\}/g, (_, name: string) =>
		String(params[name] ?? `{${name}}`),
	)
}

export const I18N = {
	LANGUAGES,
	t,
	setLanguage,
	useLanguage,
	language: () => language,
}
