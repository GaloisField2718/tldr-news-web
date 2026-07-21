import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import DailyEditionPage from "@/app/daily/[date]/page"
import DailyArticlePage from "@/app/daily/[date]/article/[articleKey]/page"
import HomePage from "@/app/page"
import { SiteHeader } from "@/components/site-header"
import {
  findDailyArticle,
  getDailyArticlePosition,
  getLatestDailyDate,
  getNextDailyDate,
  getPreviousDailyDate,
  isValidDailyDate,
  normalizeDailyPage,
} from "@/lib/daily"
import { dailyArticleKey } from "../scripts/daily-data-lib.mjs"
import { generateFrontendArtifacts } from "../scripts/tldr-data-lib.mjs"
import { makeArticle, makeIssue, writeDataset } from "./helpers/dataset"

let temporary: string
const latestDate = "2026-09-02"
const olderDate = "2026-09-01"
const articles = [
  makeArticle("lead", "editorial", { title: "Daily lead", summary: "Complete lead summary.", url: "https://publisher.example/lead", source_domain: "publisher.example" }),
  makeArticle("duplicate", "editorial", { order: 2, title: "Duplicate", url: "https://publisher.example/lead?utm_source=tldr" }),
  makeArticle("nolink", "editorial", { order: 3, title: "No link", summary: "No-link complete summary.", url: null, source_domain: null }),
  makeArticle("resource", "github_repo", { order: 4, title: "Useful repository", url: "https://github.com/example/repo" }),
  makeArticle("sponsor", "sponsor", { order: 5, title: "Sponsor entry", url: "https://sponsor.example/item" }),
  ...Array.from({ length: 15 }, (_, index) => makeArticle(`extra-${index}`, "editorial", {
    order: index + 6,
    title: `Extra story ${index}`,
    url: `https://example.com/extra/${index}`,
  })),
]

beforeAll(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "daily-frontend-"))
  const generated = path.join(temporary, "generated")
  const output = path.join(temporary, "artifacts")
  await writeDataset(generated, [
    makeIssue({ sector: "TLDR", sectorSlug: "tldr", date: latestDate, articles }),
    makeIssue({ date: latestDate, articles: [makeArticle("ai", "editorial", { url: "https://ai.example/story" })] }),
    makeIssue({ sector: "TLDR", sectorSlug: "tldr", date: olderDate, parseStatus: "failed", articles: [] }),
    makeIssue({ date: olderDate, parseStatus: "partial", articles: [makeArticle("older", "editorial", { url: "https://example.com/older" })] }),
  ])
  await generateFrontendArtifacts({ generatedDir: generated, outputDir: output, sourceRepository: "owner/source", requestedRef: "test", resolvedSourceCommit: "e".repeat(40), sourceMode: "local" })
  process.env.TLDR_GENERATED_DIR = output
  process.env.TLDR_ISSUES_DIR = generated
})

afterAll(async () => {
  delete process.env.TLDR_GENERATED_DIR
  delete process.env.TLDR_ISSUES_DIR
  await rm(temporary, { recursive: true, force: true })
})

describe("Daily routing", () => {
  it("resolves latest and adjacent readable editions", () => {
    expect(getLatestDailyDate()).toBe(latestDate)
    expect(getPreviousDailyDate(latestDate)).toBe(olderDate)
    expect(getNextDailyDate(olderDate)).toBe(latestDate)
  })

  it("validates dates and normalizes page values", () => {
    expect(isValidDailyDate("2026-02-29")).toBe(false)
    expect(isValidDailyDate(latestDate)).toBe(true)
    for (const value of [undefined, "", "0", "-1", "1.5", "word"]) expect(normalizeDailyPage(value)).toBe(1)
    expect(normalizeDailyPage("2")).toBe(2)
    expect(normalizeDailyPage("999999999999999999999")).toBe(Number.MAX_SAFE_INTEGER)
  })

  it("finds articles and deterministic reader positions", () => {
    const key = dailyArticleKey(`tldr:${latestDate}`, "lead")
    expect(findDailyArticle(latestDate, key)?.title).toBe("Daily lead")
    const position = getDailyArticlePosition(latestDate, key)
    expect(position?.page).toBe(1)
    expect(position?.nextKey).toBeTruthy()
    expect(findDailyArticle(latestDate, "invalid")).toBeUndefined()
  })

  it("returns not-found behavior for an out-of-range numeric page", async () => {
    await expect(DailyEditionPage({ params: Promise.resolve({ date: latestDate }), searchParams: Promise.resolve({ page: "999" }) })).rejects.toThrow()
  })
})

describe("Daily rendering", () => {
  it("renders one selected newspaper page with internal reader links", async () => {
    const html = renderToStaticMarkup(await DailyEditionPage({ params: Promise.resolve({ date: latestDate }), searchParams: Promise.resolve({}) }))
    const key = dailyArticleKey(`tldr:${latestDate}`, "lead")
    expect(html).toContain("THE DAILY INDEX")
    expect(html).toContain("1 of")
    expect(html).toContain(`/daily/${latestDate}/article/${key}`)
    expect(html).not.toContain('href="https://publisher.example/lead"')
    expect(html).not.toContain("Extra story 14")
    expect(html).toContain("Contents")
    expect(html).toContain("daily-story-span-8")
    expect(html).toContain("daily-story-span-4")
    expect(html).toContain("daily-story-span-3")
    expect(html).toMatch(/daily-page-count[^>]*>1 of/)
    expect(html).not.toMatch(/daily-page-count[^>]*aria-current/)
    expect(html).toContain('aria-disabled="true"')
  })

  it("omits page=1 from canonical newspaper links", async () => {
    const html = renderToStaticMarkup(await DailyEditionPage({ params: Promise.resolve({ date: latestDate }), searchParams: Promise.resolve({ page: "2" }) }))
    expect(html).toContain(`href="/daily/${latestDate}"`)
    expect(html).not.toContain(`href="/daily/${latestDate}?page=1"`)
  })

  it("reader renders the full summary, external link, duplicate metadata, and back page", async () => {
    const key = dailyArticleKey(`tldr:${latestDate}`, "lead")
    const html = renderToStaticMarkup(await DailyArticlePage({ params: Promise.resolve({ date: latestDate, articleKey: key }) }))
    expect(html).toContain("Complete lead summary.")
    expect(html).toContain("Summary from the TLDR newsletter")
    expect(html).toContain('href="https://publisher.example/lead"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain("Also appeared in")
    expect(html).toContain("Back to page 1")
  })

  it("reader handles null URLs and labels resources and sponsors", async () => {
    const noLink = renderToStaticMarkup(await DailyArticlePage({ params: Promise.resolve({ date: latestDate, articleKey: dailyArticleKey(`tldr:${latestDate}`, "nolink") }) }))
    expect(noLink).toContain("Original link unavailable")
    const resource = renderToStaticMarkup(await DailyArticlePage({ params: Promise.resolve({ date: latestDate, articleKey: dailyArticleKey(`tldr:${latestDate}`, "resource") }) }))
    expect(resource).toContain("GitHub repository")
    const sponsor = renderToStaticMarkup(await DailyArticlePage({ params: Promise.resolve({ date: latestDate, articleKey: dailyArticleKey(`tldr:${latestDate}`, "sponsor") }) }))
    expect(sponsor).toContain("Sponsored")
  })

  it("navigation and homepage expose Daily without redesigning Browse", () => {
    expect(renderToStaticMarkup(<SiteHeader />)).toContain('href="/daily"')
    const home = renderToStaticMarkup(<HomePage />)
    expect(home).toContain("Read today’s Daily Index")
    expect(home).toContain("Latest issues")
  })

  it("never uses dangerouslySetInnerHTML in Daily output", async () => {
    const html = renderToStaticMarkup(await DailyArticlePage({ params: Promise.resolve({ date: latestDate, articleKey: dailyArticleKey(`tldr:${latestDate}`, "lead") }) }))
    expect(html).not.toContain("dangerouslySetInnerHTML")
  })
})
