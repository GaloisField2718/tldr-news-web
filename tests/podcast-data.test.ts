import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { getDailyPodcast } from "@/lib/podcast"
import type { DailyPodcast, PodcastVariant } from "@/lib/podcast"

let temporary: string
const hash = `sha256:${"a".repeat(64)}`

afterEach(async () => {
  delete process.env.TLDR_GENERATED_DIR
  await rm(temporary, { recursive: true, force: true })
})

function variant(language: "en" | "fr", durationSeconds: number): PodcastVariant {
  return {
    locale: language === "en" ? "en-US" : "fr-FR",
    title: "Title",
    summary: "Summary",
    duration_seconds: durationSeconds,
    audio_url: `https://tldr-assets.noisy-dew-7159.workers.dev/podcast/daily/2026/07/21/${language}/${"a".repeat(64)}.mp3`,
    audio_sha256: hash,
    audio_bytes: 1,
    mime_type: "audio/mpeg",
    script_sha256: hash,
  }
}

async function write(date: string, speakerProfile: DailyPodcast["speaker_profile"], durationSeconds: number) {
  temporary = await mkdtemp(path.join(os.tmpdir(), "podcast-data-"))
  process.env.TLDR_GENERATED_DIR = temporary
  const dir = path.join(temporary, "podcast", date.slice(0, 4))
  await mkdir(dir, { recursive: true })
  const doc: DailyPodcast = {
    schema_version: "1.1.0",
    publication_date: date,
    status: "published",
    source_artifact_sha256: hash,
    speaker_profile: speakerProfile,
    languages: { en: variant("en", durationSeconds), fr: variant("fr", durationSeconds) },
    generated_at: "2026-07-21T00:00:00Z",
    published_at: "2026-07-21T00:00:00Z",
  }
  await writeFile(path.join(dir, `${date}.json`), JSON.stringify(doc))
}

describe("getDailyPodcast profile-aware duration validation", () => {
  it("accepts a historical daily-index-duo-v1 episode inside its 270-390s range", async () => {
    await write("2026-07-21", "daily-index-duo-v1", 336)
    expect(getDailyPodcast("2026-07-21")?.speaker_profile).toBe("daily-index-duo-v1")
  })

  it("accepts a new headline-brief-v1 episode inside its 55-130s range", async () => {
    await write("2026-07-23", "headline-brief-v1", 92)
    expect(getDailyPodcast("2026-07-23")?.speaker_profile).toBe("headline-brief-v1")
  })

  it("rejects a headline-brief-v1 episode outside its own duration range even though it would fit the legacy range", async () => {
    await write("2026-07-23", "headline-brief-v1", 300)
    expect(() => getDailyPodcast("2026-07-23")).toThrow("Podcast artifact is invalid")
  })

  it("rejects a daily-index-duo-v1 episode outside its legacy duration range", async () => {
    await write("2026-07-21", "daily-index-duo-v1", 92)
    expect(() => getDailyPodcast("2026-07-21")).toThrow("Podcast artifact is invalid")
  })

  it("rejects an unknown speaker profile", async () => {
    await write("2026-07-23", "headline-brief-v1", 92)
    const file = path.join(temporary, "podcast", "2026", "2026-07-23.json")
    const doc = JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8"))
    doc.speaker_profile = "daily-briefing-v1"
    await writeFile(file, JSON.stringify(doc))
    expect(() => getDailyPodcast("2026-07-23")).toThrow("Podcast artifact is invalid")
  })
})
