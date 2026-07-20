import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  canonicalizeDailyUrl,
  composeDailyEdition,
  dailyArticleKey,
  generateDailyArtifacts,
} from "../scripts/daily-data-lib.mjs"
import { makeArticle, makeIssue, manifestEntry } from "./helpers/dataset"
import type { IssueDocument } from "@/lib/types"

const SHA = "d".repeat(40)
let temporary: string
beforeEach(async () => { temporary = await mkdtemp(path.join(os.tmpdir(), "daily-data-")) })
afterEach(async () => { await rm(temporary, { recursive: true, force: true }) })

function document(issue: IssueDocument) {
  return { entry: manifestEntry(issue), issue }
}

function edition(issues: IssueDocument[]) {
  return composeDailyEdition({ date: issues[0].date, documents: issues.map(document), resolvedSourceCommit: SHA })
}

describe("Daily article keys and conservative URL canonicalization", () => {
  it("creates stable, distinct, URL-safe keys", () => {
    expect(dailyArticleKey("issue", "article")).toBe(dailyArticleKey("issue", "article"))
    expect(dailyArticleKey("issue", "article")).not.toBe(dailyArticleKey("issue", "other"))
    expect(dailyArticleKey("issue", "article")).toMatch(/^[a-f0-9]{64}$/)
  })

  it("removes fragments and tracking parameters but preserves meaningful queries", () => {
    expect(canonicalizeDailyUrl("https://EXAMPLE.com/a?utm_source=x&b=2&a=1#part"))
      .toBe("https://example.com/a?a=1&b=2")
    expect(canonicalizeDailyUrl("https://example.com/a?id=1"))
      .not.toBe(canonicalizeDailyUrl("https://example.com/a?id=2"))
  })

  it("fails generation when different pairs collide", () => {
    const issue = makeIssue({ articles: [makeArticle("a"), makeArticle("b", "editorial", { order: 2 })] })
    expect(() => composeDailyEdition({
      date: issue.date,
      documents: [document(issue)],
      resolvedSourceCommit: SHA,
      articleKeyFactory: () => "a".repeat(64),
    })).toThrow("collision")
  })
})

describe("Daily deduplication", () => {
  it("deduplicates exact and tracking-only URLs while preserving every occurrence", () => {
    const first = makeIssue({ sector: "TLDR", sectorSlug: "tldr", articles: [makeArticle("first", "editorial", { url: "https://example.com/story?utm_source=one#top" })] })
    const second = makeIssue({ articles: [makeArticle("second", "editorial", { url: "https://EXAMPLE.com/story?utm_medium=two" })] })
    const result = edition([second, first])
    expect(result.articles).toHaveLength(1)
    expect(result.articles[0].occurrences).toHaveLength(2)
    expect(result.articles[0].issue_id).toBe(first.issue_id)
  })

  it("does not deduplicate null URLs, meaningful query differences, or similar titles", () => {
    const issue = makeIssue({ articles: [
      makeArticle("a", "editorial", { url: null, title: "Same" }),
      makeArticle("b", "editorial", { url: null, title: "Same", order: 2 }),
      makeArticle("c", "editorial", { url: "https://example.com/a?id=1", title: "Same", order: 3 }),
      makeArticle("d", "editorial", { url: "https://example.com/a?id=2", title: "Same", order: 4 }),
    ] })
    expect(edition([issue]).articles).toHaveLength(4)
  })
})

describe("deterministic Daily composition", () => {
  it("uses general TLDR as lead, crosses sectors, and assigns every article once", () => {
    const general = makeIssue({ sector: "TLDR", sectorSlug: "tldr", articles: [makeArticle("general", "editorial", { url: "https://example.com/general" })] })
    const ai = makeIssue({ articles: [makeArticle("ai", "editorial", { url: "https://example.com/ai" })] })
    const result = edition([ai, general])
    expect(result.pages[0].sectors).toEqual(["TLDR", "TLDR AI"])
    expect(result.pages[0].slots[0].article_key).toBe(dailyArticleKey(general.issue_id, "general"))
    const assigned = result.pages.flatMap((page) => page.slots.map((slot) => slot.article_key))
    expect(new Set(assigned)).toEqual(new Set(result.articles.map((article) => article.article_key)))
    expect(assigned).toHaveLength(new Set(assigned).size)
    expect(result.pages.map((page) => page.number)).toEqual(result.pages.map((_, index) => index + 1))
  })

  it("never uses a sponsor as lead and isolates resources and sponsors", () => {
    const issue = makeIssue({ articles: [
      makeArticle("sponsor", "sponsor", { url: "https://example.com/sponsor" }),
      makeArticle("news", "editorial", { order: 2, url: "https://example.com/news" }),
      makeArticle("tool", "tool", { order: 3, url: "https://example.com/tool" }),
    ] })
    const result = edition([issue])
    expect(result.pages[0].slots[0].article_key).toBe(dailyArticleKey(issue.issue_id, "news"))
    expect(result.pages.find((page) => page.template === "resources")?.slots.every((slot) => slot.role === "resource")).toBe(true)
    expect(result.pages.find((page) => page.template === "sponsored")?.slots.every((slot) => slot.role === "sponsor")).toBe(true)
  })

  it("creates deterministic continuation pages for a long sector", () => {
    const articles = Array.from({ length: 45 }, (_, index) => makeArticle(`a${index}`, "editorial", { order: index + 1, url: `https://example.com/${index}` }))
    const result = edition([makeIssue({ articles })])
    expect(result.pages.length).toBeGreaterThan(2)
    expect(result.pages.some((page) => page.title?.includes("continued"))).toBe(true)
    expect(edition([makeIssue({ articles })]).pages).toEqual(result.pages)
  })

  it("supports unknown sectors, failed empty issues, partial issues, and sparse dates", () => {
    const failed = makeIssue({ sector: "TLDR", sectorSlug: "tldr", parseStatus: "failed", articles: [] })
    const future = makeIssue({ sector: "TLDR Quantum", sectorSlug: "tldr-quantum", parseStatus: "partial", articles: [makeArticle("quantum")] })
    const result = edition([future, failed])
    expect(result.issues.find((issue) => issue.parse_status === "failed")?.available).toBe(false)
    expect(result.articles[0].sector_slug).toBe("tldr-quantum")
    expect(result.pages).toHaveLength(1)
  })
})

describe("Daily artifacts", () => {
  it("aggregates dates into deterministic checked gzip files without raw source fields", async () => {
    const issues = [makeIssue({ date: "2026-07-17" }), makeIssue({ sector: "TLDR", sectorSlug: "tldr", date: "2026-07-17", articles: [makeArticle("general")] }), makeIssue({ date: "2026-07-16", articles: [makeArticle("older")] })]
    const first = path.join(temporary, "first")
    const second = path.join(temporary, "second")
    const metadata = await generateDailyArtifacts({ documents: issues.map(document), outputDir: first, resolvedSourceCommit: SHA })
    await generateDailyArtifacts({ documents: issues.map(document), outputDir: second, resolvedSourceCommit: SHA })
    expect(metadata.dates.map((entry) => entry.date)).toEqual(["2026-07-17", "2026-07-16"])
    expect(metadata.edition_count).toBe(2)
    expect(metadata.article_occurrence_count).toBe(3)
    expect(metadata.resolved_source_commit).toBe(SHA)
    const entry = metadata.dates[0]
    const bytes = await readFile(path.join(first, "daily", entry.file))
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256)
    expect(bytes).toEqual(await readFile(path.join(second, "daily", entry.file)))
    const raw = gunzipSync(bytes).toString("utf8")
    expect(raw).not.toContain("source_path")
    expect(raw).not.toContain("source_content_hash")
    expect(JSON.parse(raw).issues).toHaveLength(2)
  })
})
