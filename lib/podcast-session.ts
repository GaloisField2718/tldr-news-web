import type { PodcastLanguage } from "./podcast"

// Persisted across reloads (DEC/P0-AUDIO-01 B5): language, volume, and minimized
// state only. Playback position is deliberately NOT persisted and playback is
// never auto-resumed after a reload.
export const PODCAST_LANGUAGE_KEY = "daily-index-podcast-language"
export const PODCAST_VOLUME_KEY = "daily-index-podcast-volume"
export const PODCAST_MINIMIZED_KEY = "daily-index-podcast-minimized"

// The persisted preferences behave as one small external store so the provider can
// read them with useSyncExternalStore: correct during SSR, correct after hydration,
// and no state assignment inside an effect body.
type PreferenceListener = () => void
const preferenceListeners = new Set<PreferenceListener>()

export function subscribePodcastPreferences(listener: PreferenceListener): () => void {
  preferenceListeners.add(listener)
  return () => {
    preferenceListeners.delete(listener)
  }
}

export function readPodcastPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePodcastPreference(key: string, value: string, notify = true): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable (private mode, quota): the preference is simply not persisted */
  }
  if (notify) for (const listener of preferenceListeners) listener()
}

export function preferredPodcastLanguage(stored: string | null, browserLanguage: string): PodcastLanguage {
  if (stored === "en" || stored === "fr") return stored
  return browserLanguage.toLowerCase().startsWith("fr") ? "fr" : "en"
}

export function storedPodcastVolume(raw: string | null): number | null {
  if (raw === null) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) return null
  return value
}

// null means the user never used minimize or restore, which is what lets the dock
// default to expanded on the owning journal and compact everywhere else without
// overriding a deliberate choice.
export function storedPodcastMinimized(raw: string | null): boolean | null {
  if (raw === null) return null
  return raw === "true"
}

export type PodcastShellState = "hidden" | "expanded" | "compact"

export interface PodcastShellInput {
  /** An episode has been registered by a route in this tab. */
  hasEpisode: boolean
  /** The user dismissed the dock with the close control. */
  closed: boolean
  /** The current route is the Daily journal that owns this episode. */
  primary: boolean
  /** Playback has been started at least once in this tab. */
  started: boolean
  /** An explicit minimize/restore choice, or null when the user never made one. */
  minimized: boolean | null
}

// The dock shows on the route that owns the episode, and follows an already-started
// session everywhere else in the same tab. A tab that never started playback shows
// nothing -- notably a reader page opened in its own tab under DEC-006, which must
// not present an active player or start audio of its own.
export function podcastShellState({ hasEpisode, closed, primary, started, minimized }: PodcastShellInput): PodcastShellState {
  if (!hasEpisode || closed) return "hidden"
  if (!primary && !started) return "hidden"
  // Compact until the reader asks for more. An edition should open on its own
  // headline, not on a podcast bar nobody requested yet; expanding is one click and
  // an explicit choice is then remembered.
  return minimized === false ? "expanded" : "compact"
}

/** Episode length for the dock label: "2 min". Never rounds down to zero. */
export function formatPodcastDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ""
  return `${Math.max(1, Math.round(seconds / 60))} min`
}
