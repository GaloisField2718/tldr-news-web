import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import HomePage from "@/app/page"
import { getLatestPublishedDaily, getPublishedDailyPodcast } from "@/lib/daily-latest"
import { formatLongDate } from "@/lib/format"
import { generateFrontendArtifacts } from "../scripts/tldr-data-lib.mjs"
import { makeArticle, makeIssue, writeDataset } from "./helpers/dataset"

// Built from a synthetic dataset like the rest of the suite, so this runs anywhere --
// CI has no synced archive. The illustration and podcast branches are covered against
// controlled data in tests/daily-latest.test.ts; what this file checks is the wiring
// from a real generated artifact through to the rendered homepage.
const latestDate = "2026-09-02"
const olderDate = "2026-09-01"
let temporary: string
let html: string
let edition: ReturnType<typeof getLatestPublishedDaily>

beforeAll(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "home-page-"))
  const generated = path.join(temporary, "generated")
  const output = path.join(temporary, "artifacts")
  await writeDataset(generated, [
    makeIssue({
      sector: "TLDR",
      sectorSlug: "tldr",
      date: latestDate,
      articles: [
        makeArticle("lead", "editorial", { title: "Lead story of the day", summary: "What the edition leads with.", url: "https://example.com/lead" }),
        makeArticle("second", "editorial", { title: "Second story", url: "https://example.com/second" }),
      ],
    }),
    makeIssue({ date: latestDate, articles: [makeArticle("ai", "editorial", { url: "https://ai.example/story" })] }),
    makeIssue({ sector: "TLDR", sectorSlug: "tldr", date: olderDate, articles: [makeArticle("older", "editorial", { url: "https://example.com/older" })] }),
  ])
  await generateFrontendArtifacts({
    generatedDir: generated,
    outputDir: output,
    sourceRepository: "owner/source",
    requestedRef: "test",
    resolvedSourceCommit: "e".repeat(40),
    sourceMode: "local",
  })
  process.env.TLDR_GENERATED_DIR = output
  process.env.TLDR_ISSUES_DIR = generated
  edition = getLatestPublishedDaily()
  html = renderToStaticMarkup(<HomePage />)
})

afterAll(async () => {
  delete process.env.TLDR_GENERATED_DIR
  delete process.env.TLDR_ISSUES_DIR
  await rm(temporary, { recursive: true, force: true })
})

/** Editorial text carries apostrophes, which React escapes in the rendered markup. */
const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;")

describe("homepage", () => {
  it("selects the newest edition in the archive", () => {
    expect(edition?.date).toBe(latestDate)
  })

  it("leads with the latest edition, its date and its lead story", () => {
    expect(html).toContain("Latest Daily Edition")
    expect(html).toContain(formatLongDate(latestDate))
    expect(html).toContain(`dateTime="${latestDate}"`)
    expect(html).toContain(escapeHtml(edition!.title))
    expect(html).toContain(escapeHtml(edition!.introduction))
  })

  it("links the edition to its own route", () => {
    expect(html).toContain(`href="/daily/${latestDate}"`)
    expect(html).toContain("Read the edition")
  })

  it("keeps search and archive reachable", () => {
    expect(html).toContain('href="/archive"')
    expect(html).toContain("browse the archive")
    expect(html).toContain('action="/search"')
  })

  it("renders the edition illustration only when one exists", () => {
    if (edition!.illustration) expect(html).toContain(edition!.illustration.src)
    else expect(html).not.toContain("editorial illustration")
  })

  it("shows listen actions only when the edition has a podcast", () => {
    const podcast = getPublishedDailyPodcast(latestDate)
    if (podcast) expect(html).toContain("Listen in English")
    else expect(html).not.toContain("Listen in English")
  })

  it("never autoplays and loads no audio before the reader asks", () => {
    expect(html).not.toContain("autoplay")
    expect(html).not.toContain(".mp3")
  })

  it("still lists recent issues and sector navigation", () => {
    expect(html).toContain("Latest issues")
    expect(html).toContain("Sectors")
  })
})
