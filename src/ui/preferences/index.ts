import { useSyncExternalStore } from "react"
import type { UiTextSize } from "@/ui/preferences/types"

const STORAGE_KEY = "exoplasim.textSize"
const SIZES: ReadonlyArray<{ id: UiTextSize; label: string }> = [
	{ id: "normal", label: "Standard" },
	{ id: "large", label: "1.5×" },
]

function storedSize(): UiTextSize | null {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY)
		return value === "normal" || value === "large" ? value : null
	} catch {
		return null
	}
}

function apply(size: UiTextSize): void {
	document.documentElement.dataset.textSize = size
}

let size: UiTextSize = storedSize() ?? "normal"
apply(size)
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function useTextSize(): UiTextSize {
	return useSyncExternalStore(subscribe, () => size)
}

function setTextSize(next: UiTextSize): void {
	size = next
	try {
		window.localStorage.setItem(STORAGE_KEY, next)
	} catch {
		// Storage can be unavailable in private or embedded contexts.
	}
	apply(next)
	for (const listener of listeners) listener()
}

export const TEXT_SIZE = {
	SIZES,
	setTextSize,
	useTextSize,
	size: () => size,
}
