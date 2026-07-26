"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import type { DailyPodcast, PodcastLanguage } from "@/lib/podcast"
import {
  PODCAST_LANGUAGE_KEY,
  PODCAST_MINIMIZED_KEY,
  PODCAST_VOLUME_KEY,
  podcastShellState,
  preferredPodcastLanguage,
  readPodcastPreference,
  storedPodcastMinimized,
  storedPodcastVolume,
  subscribePodcastPreferences,
  writePodcastPreference,
} from "@/lib/podcast-session"

interface PodcastRegistration {
  register(date: string, podcast: DailyPodcast): void
  release(): void
}

const PodcastContext = createContext<PodcastRegistration | null>(null)

interface Session {
  date: string
  podcast: DailyPodcast
  /** Playback has been started at least once in this tab for this edition. */
  started: boolean
  /** The user dismissed the dock with the close control. */
  closed: boolean
}

const alwaysFalse = () => false
const alwaysTrue = () => true
const alwaysNull = () => null

export function PodcastProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const dockRef = useRef<HTMLElement | null>(null)
  // Set immediately before a language switch so the source effect knows to resume
  // playback that was already running. It can never cause autoplay on a fresh load.
  const resumeRef = useRef(false)

  const [session, setSession] = useState<Session | null>(null)
  const [primary, setPrimary] = useState(false)
  const [playing, setPlaying] = useState(false)

  // Persisted preferences, read as an external store rather than assigned from an effect.
  const hydrated = useSyncExternalStore(subscribePodcastPreferences, alwaysTrue, alwaysFalse)
  const language = useSyncExternalStore(
    subscribePodcastPreferences,
    () => preferredPodcastLanguage(readPodcastPreference(PODCAST_LANGUAGE_KEY), navigator.language),
    () => "en" as PodcastLanguage,
  )
  const minimized = useSyncExternalStore(
    subscribePodcastPreferences,
    () => storedPodcastMinimized(readPodcastPreference(PODCAST_MINIMIZED_KEY)),
    alwaysNull,
  )

  const episode = session ? session.podcast.languages[language] : null
  const src = episode?.audio_url ?? null

  // The only place the media source changes. It assigns to the existing element rather
  // than re-rendering a keyed <audio>, so the DOM node itself is never replaced.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !hydrated || !src) return
    if (audio.getAttribute("src") === src) return
    audio.setAttribute("src", src)
    audio.load()
    audio.currentTime = 0
    if (resumeRef.current) {
      resumeRef.current = false
      void audio.play()?.catch(() => {
        /* the browser refused playback; the user can press play again */
      })
    }
  }, [src, hydrated])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !hydrated) return
    const volume = storedPodcastVolume(readPodcastPreference(PODCAST_VOLUME_KEY))
    if (volume !== null) audio.volume = volume
  }, [hydrated])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => {
      setPlaying(true)
      setSession((previous) => (previous && !previous.started ? { ...previous, started: true } : previous))
    }
    const onPause = () => setPlaying(false)
    // Volume is written without notifying subscribers: nothing renders from it, and a
    // notification per volume tick would rerender the whole subtree.
    const onVolumeChange = () => writePodcastPreference(PODCAST_VOLUME_KEY, String(audio.volume), false)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onPause)
    audio.addEventListener("volumechange", onVolumeChange)
    return () => {
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onPause)
      audio.removeEventListener("volumechange", onVolumeChange)
    }
  }, [])

  const register = useCallback((date: string, podcast: DailyPodcast) => {
    // Returning the previous session unchanged when the date matches is what keeps
    // playback alive across journal pagination: no state change, no source change.
    setSession((previous) =>
      previous && previous.date === date ? previous : { date, podcast, started: false, closed: false },
    )
    setPrimary(true)
  }, [])

  const release = useCallback(() => setPrimary(false), [])
  const registration = useMemo<PodcastRegistration>(() => ({ register, release }), [register, release])

  const selectLanguage = useCallback(
    (next: PodcastLanguage) => {
      if (next === language) return
      const audio = audioRef.current
      resumeRef.current = Boolean(audio && !audio.paused)
      writePodcastPreference(PODCAST_LANGUAGE_KEY, next)
    },
    [language],
  )

  const close = useCallback(() => {
    audioRef.current?.pause()
    setSession((previous) => (previous ? { ...previous, closed: true } : previous))
  }, [])

  const shell = podcastShellState({
    hasEpisode: episode !== null,
    closed: session?.closed ?? false,
    primary,
    started: session?.started ?? false,
    minimized,
  })

  // Toggling records an explicit choice against what is actually on screen, so the
  // first click always does what its label says even when nothing was stored yet.
  const toggleMinimized = useCallback(
    () => writePodcastPreference(PODCAST_MINIMIZED_KEY, String(shell !== "compact")),
    [shell],
  )

  // Reserve exactly the dock's height so page content is never covered, at any viewport
  // and whatever the episode title length.
  useEffect(() => {
    const dock = dockRef.current
    const layout = layoutRef.current
    if (!dock || !layout || typeof ResizeObserver === "undefined") return
    const apply = () => layout.style.setProperty("--podcast-dock-height", `${dock.offsetHeight}px`)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(dock)
    return () => observer.disconnect()
  }, [shell])

  return (
    <PodcastContext.Provider value={registration}>
      <div ref={layoutRef} className="podcast-layout" data-podcast={shell}>
        {children}
      </div>
      <section
        ref={dockRef}
        className="podcast-dock"
        data-state={shell}
        aria-label="Daily podcast player"
        aria-hidden={shell === "hidden"}
      >
        <div className="podcast-dock-inner">
          {shell === "expanded" && episode ? (
            <>
              <div className="podcast-heading">
                <div>
                  <p className="podcast-kicker">Daily podcast</p>
                  <h2 className="podcast-title">{episode.title}</h2>
                </div>
                <div role="group" aria-label="Podcast language" className="podcast-language">
                  <button type="button" aria-pressed={language === "en"} onClick={() => selectLanguage("en")}>
                    English
                  </button>
                  <button type="button" aria-pressed={language === "fr"} onClick={() => selectLanguage("fr")}>
                    Français
                  </button>
                </div>
              </div>
              <p className="podcast-summary">{episode.summary}</p>
            </>
          ) : null}
          <div className="podcast-controls">
            {/*
              The single persistent media element. It is never keyed, never conditionally
              rendered, and never moved between containers: minimize, restore, close, route
              changes, and journal pagination only alter the chrome around it. Its source is
              assigned imperatively by the effect above.
            */}
            <audio
              ref={audioRef}
              controls
              preload="metadata"
              aria-label={episode ? `${episode.title} — ${episode.locale}` : "Daily podcast"}
            >
              Your browser does not support audio playback.
            </audio>
            <div className="podcast-actions">
              <button type="button" onClick={toggleMinimized} aria-expanded={shell === "expanded"}>
                {shell === "expanded" ? "Minimize" : "Restore"}
              </button>
              <button type="button" onClick={close} aria-label="Close podcast player">
                Close
              </button>
            </div>
          </div>
          {shell === "compact" && episode ? (
            <p className="podcast-compact-title">
              {episode.title}
              {playing ? " · playing" : null}
            </p>
          ) : null}
        </div>
      </section>
    </PodcastContext.Provider>
  )
}

// Side-effect-only component rendered by the route that owns an edition's podcast.
// It renders nothing and never touches the audio element directly.
export function DailyPodcastRegistrar({ date, podcast }: { date: string; podcast: DailyPodcast }) {
  const registration = useContext(PodcastContext)
  useEffect(() => {
    if (!registration) return
    registration.register(date, podcast)
    return () => registration.release()
  }, [registration, date, podcast])
  return null
}
