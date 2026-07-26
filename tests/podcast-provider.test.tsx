// @vitest-environment jsdom
import { cleanup,fireEvent,render } from "@testing-library/react"
import { afterEach,beforeAll,beforeEach,describe,expect,it } from "vitest"
import { DailyPodcastRegistrar,PodcastProvider } from "@/components/podcast-provider"
import { PODCAST_LANGUAGE_KEY,PODCAST_MINIMIZED_KEY,PODCAST_VOLUME_KEY } from "@/lib/podcast-session"
import type { DailyPodcast,PodcastProfileId } from "@/lib/podcast"

const hash = `sha256:${"a".repeat(64)}`
function makePodcast(date: string, profile: PodcastProfileId, duration: number): DailyPodcast {
  const url = (language: "en" | "fr") =>
    `https://tldr-assets.noisy-dew-7159.workers.dev/podcast/daily/${date.slice(0, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)}/${language}/${"a".repeat(64)}.mp3`
  return {
    schema_version: "1.1.0", publication_date: date, status: "published", source_artifact_sha256: hash,
    speaker_profile: profile, generated_at: `${date}T00:00:00Z`, published_at: `${date}T00:00:00Z`,
    languages: {
      en: { locale: "en-US", title: "English episode", summary: "English summary", duration_seconds: duration, audio_url: url("en"), audio_sha256: hash, audio_bytes: 1, mime_type: "audio/mpeg", script_sha256: hash },
      fr: { locale: "fr-FR", title: "Épisode français", summary: "Résumé français", duration_seconds: duration, audio_url: url("fr"), audio_sha256: hash, audio_bytes: 1, mime_type: "audio/mpeg", script_sha256: hash },
    },
  }
}
// Historical long-form artifact and the current short headline profile must both work.
const historical = makePodcast("2026-07-21", "daily-index-duo-v1", 300)
const headline = makePodcast("2026-07-24", "headline-brief-v1", 122)

// jsdom implements no media playback at all, so the pieces the provider actually
// touches are backed by per-element state here: paused, currentTime, volume, and
// the play/pause/load methods with their events.
interface MediaState { paused: boolean; currentTime: number; volume: number }
const media = new WeakMap<HTMLMediaElement, MediaState>()
function state(element: HTMLMediaElement): MediaState {
  let value = media.get(element)
  if (!value) { value = { paused: true, currentTime: 0, volume: 1 }; media.set(element, value) }
  return value
}
beforeAll(() => {
  const proto = HTMLMediaElement.prototype
  Object.defineProperty(proto, "paused", { configurable: true, get(this: HTMLMediaElement) { return state(this).paused } })
  Object.defineProperty(proto, "currentTime", {
    configurable: true,
    get(this: HTMLMediaElement) { return state(this).currentTime },
    set(this: HTMLMediaElement, value: number) { state(this).currentTime = Number(value) },
  })
  Object.defineProperty(proto, "volume", {
    configurable: true,
    get(this: HTMLMediaElement) { return state(this).volume },
    set(this: HTMLMediaElement, value: number) { state(this).volume = Number(value); this.dispatchEvent(new Event("volumechange")) },
  })
  Object.defineProperty(proto, "load", { configurable: true, value(this: HTMLMediaElement) { /* source assignment only */ } })
  Object.defineProperty(proto, "play", {
    configurable: true,
    value(this: HTMLMediaElement) { state(this).paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve() },
  })
  Object.defineProperty(proto, "pause", {
    configurable: true,
    value(this: HTMLMediaElement) { state(this).paused = true; this.dispatchEvent(new Event("pause")) },
  })
})

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

function journal(podcast: DailyPodcast, body: string) {
  return (
    <PodcastProvider>
      <p>{body}</p>
      <DailyPodcastRegistrar date={podcast.publication_date} podcast={podcast} />
    </PodcastProvider>
  )
}
const audioOf = (container: HTMLElement) => container.querySelector("audio") as HTMLAudioElement
const dockOf = (container: HTMLElement) => container.querySelector(".podcast-dock") as HTMLElement
const layoutOf = (container: HTMLElement) => container.querySelector(".podcast-layout") as HTMLElement
const button = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.trim() === label) as HTMLButtonElement

describe("persistent podcast player", () => {
  it("mounts exactly one audio element", () => {
    const { container } = render(journal(headline, "page 1"))
    expect(container.querySelectorAll("audio")).toHaveLength(1)
  })

  it("does not autoplay on initial load", () => {
    const { container } = render(journal(headline, "page 1"))
    const audio = audioOf(container)
    expect(audio.hasAttribute("autoplay")).toBe(false)
    expect(audio.paused).toBe(true)
    expect(audio.currentTime).toBe(0)
  })

  it("keeps the same audio DOM node across a rerender", () => {
    const { container, rerender } = render(journal(headline, "page 1"))
    const audio = audioOf(container)
    rerender(journal({ ...headline }, "page 1"))
    expect(audioOf(container)).toBe(audio)
  })

  it("keeps the same audio node and playback across a simulated journal page change", () => {
    const { container, rerender } = render(journal(headline, "page 1"))
    const audio = audioOf(container)
    audio.play()
    audio.currentTime = 42
    // A new page of the same edition: different content, a fresh podcast object from
    // the server render, same date.
    rerender(journal({ ...headline }, "page 2"))
    expect(audioOf(container)).toBe(audio)
    expect(audio.paused).toBe(false)
    expect(audio.currentTime).toBe(42)
    expect(container.textContent).toContain("page 2")
  })

  it("does not recreate the audio element when minimizing and restoring", () => {
    const { container } = render(journal(headline, "page 1"))
    const audio = audioOf(container)
    audio.play()
    audio.currentTime = 17
    fireEvent.click(button(container, "Minimize"))
    expect(dockOf(container).dataset.state).toBe("compact")
    expect(audioOf(container)).toBe(audio)
    expect(audio.paused).toBe(false)
    expect(audio.currentTime).toBe(17)
    fireEvent.click(button(container, "Restore"))
    expect(dockOf(container).dataset.state).toBe("expanded")
    expect(audioOf(container)).toBe(audio)
    expect(audio.paused).toBe(false)
    expect(audio.currentTime).toBe(17)
  })

  it("switches language, changes the source, and restarts at zero on the same element", () => {
    const { container } = render(journal(headline, "page 1"))
    const audio = audioOf(container)
    expect(audio.getAttribute("src")).toContain("/en/")
    audio.currentTime = 55
    fireEvent.click(button(container, "Français"))
    expect(audioOf(container)).toBe(audio)
    expect(audio.getAttribute("src")).toContain("/fr/")
    expect(audio.currentTime).toBe(0)
    expect(window.localStorage.getItem(PODCAST_LANGUAGE_KEY)).toBe("fr")
  })

  it("resumes after a language switch only when playback was already running", () => {
    const { container } = render(journal(headline, "page 1"))
    const audio = audioOf(container)
    audio.play()
    fireEvent.click(button(container, "Français"))
    expect(audio.paused).toBe(false)
    expect(audio.currentTime).toBe(0)
  })

  it("persists volume and minimized state, and restores them on a later mount", () => {
    const first = render(journal(headline, "page 1"))
    audioOf(first.container).volume = 0.25
    fireEvent.click(button(first.container, "Minimize"))
    expect(window.localStorage.getItem(PODCAST_VOLUME_KEY)).toBe("0.25")
    expect(window.localStorage.getItem(PODCAST_MINIMIZED_KEY)).toBe("true")
    cleanup()
    const second = render(journal(headline, "page 1"))
    expect(audioOf(second.container).volume).toBe(0.25)
    expect(dockOf(second.container).dataset.state).toBe("compact")
    // A reload must never resume playback on its own.
    expect(audioOf(second.container).paused).toBe(true)
  })

  it("closes to a hidden dock while keeping the audio element mounted", () => {
    const { container } = render(journal(headline, "page 1"))
    const audio = audioOf(container)
    audio.play()
    fireEvent.click(button(container, "Close"))
    expect(dockOf(container).dataset.state).toBe("hidden")
    expect(audio.paused).toBe(true)
    expect(container.querySelectorAll("audio")).toHaveLength(1)
    expect(audioOf(container)).toBe(audio)
  })

  it("renders a hidden dock for an edition with no podcast", () => {
    const { container } = render(
      <PodcastProvider>
        <p>no podcast here</p>
      </PodcastProvider>,
    )
    expect(dockOf(container).dataset.state).toBe("hidden")
    expect(dockOf(container).getAttribute("aria-hidden")).toBe("true")
  })

  it("plays historical long-form and short headline artifacts alike", () => {
    for (const podcast of [historical, headline]) {
      const { container, unmount } = render(journal(podcast, "page 1"))
      expect(audioOf(container).getAttribute("src")).toBe(podcast.languages.en.audio_url)
      expect(dockOf(container).dataset.state).toBe("expanded")
      unmount()
    }
  })

  it("reserves layout space through the dock state so content is never covered", () => {
    const { container } = render(journal(headline, "page 1"))
    expect(layoutOf(container).dataset.podcast).toBe("expanded")
    fireEvent.click(button(container, "Minimize"))
    expect(layoutOf(container).dataset.podcast).toBe("compact")
    fireEvent.click(button(container, "Close"))
    expect(layoutOf(container).dataset.podcast).toBe("hidden")
  })

  it("keeps the controls reachable and labelled", () => {
    const { container } = render(journal(headline, "page 1"))
    expect(audioOf(container).hasAttribute("controls")).toBe(true)
    expect(audioOf(container).getAttribute("aria-label")).toContain("English episode")
    expect(dockOf(container).getAttribute("aria-label")).toBe("Daily podcast player")
    expect(button(container, "Minimize").getAttribute("aria-expanded")).toBe("true")
    expect(button(container, "Close").getAttribute("aria-label")).toBe("Close podcast player")
    expect(button(container, "English").getAttribute("aria-pressed")).toBe("true")
    expect(button(container, "Français").getAttribute("aria-pressed")).toBe("false")
  })
})
