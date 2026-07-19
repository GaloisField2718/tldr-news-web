import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { generateFrontendArtifacts } from "../scripts/tldr-data-lib.mjs"
import {
  MAX_SEARCH_PAGE,
  SEARCH_PAGE_SIZE,
  normalizeSearchPage,
  searchArticles,
} from "@/lib/search"
import { makeArticle, makeIssue, writeDataset } from "./helpers/dataset"

let temporary: string

beforeAll(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "tldr-search-pages-test-"))
  const generated = path.join(temporary, "generated")
  const artifacts = path.join(temporary, "artifacts")
  const articles = Array.from({ length: 125 }, (_, index) => {
    const number = index + 1
    return makeArticle(`tldr-ai:2026-08-01:a${String(number).padStart(3, "0")}`, number <= 100 ? "editorial" : "tool", {
      order: number,
      title: `Paged model ${String(number).padStart(3, "0")}`,
      summary: `Pagination fixture article ${number}`,
      reading_time_minutes: number <= 100 ? 7 : null,
    })
  })
  await writeDataset(generated, [makeIssue({ date: "2026-08-01", articles })])
  await generateFrontendArtifacts({
    generatedDir: generated,
    outputDir: artifacts,
    sourceRepository: "owner/source",
    requestedRef: "test",
    resolvedSourceCommit: "d".repeat(40),
    sourceMode: "local",
  })
  process.env.TLDR_GENERATED_DIR = artifacts
  process.env.TLDR_ISSUES_DIR = generated
})

afterAll(async () => {
  delete process.env.TLDR_GENERATED_DIR
  delete process.env.TLDR_ISSUES_DIR
  await rm(temporary, { recursive: true, force: true })
})

describe("bounded server-side search pagination", () => {
  it("returns exactly 50 items for a filter-only search and reports the exact total", () => {
    const result = searchArticles({ sector: "tldr-ai" })
    expect(result).toMatchObject({
      total: 125,
      page: 1,
      page_size: SEARCH_PAGE_SIZE,
      page_count: 3,
    })
    expect(result.items).toHaveLength(SEARCH_PAGE_SIZE)
  })

  it("returns the next deterministic window on page 2 without duplication", () => {
    const first = searchArticles({ sector: "tldr-ai", page: 1 })
    const second = searchArticles({ sector: "tldr-ai", page: 2 })
    const firstIds = new Set(first.items.map((item) => item.article.id))
    expect(second.items).toHaveLength(SEARCH_PAGE_SIZE)
    expect(second.items.every((item) => !firstIds.has(item.article.id))).toBe(true)
    expect(first.items[0].article.id).toBe("tldr-ai:2026-08-01:a001")
    expect(second.items[0].article.id).toBe("tldr-ai:2026-08-01:a051")
  })

  it("never returns more than SEARCH_PAGE_SIZE results", () => {
    for (const page of [1, 2, 3, 4, MAX_SEARCH_PAGE]) {
      expect(searchArticles({ sector: "tldr-ai", page }).items.length).toBeLessThanOrEqual(
        SEARCH_PAGE_SIZE,
      )
    }
    expect(searchArticles({ sector: "tldr-ai", page: 3 }).items).toHaveLength(25)
  })

  it("normalizes invalid and excessively large page values safely", () => {
    for (const value of [undefined, "", "0", "-1", "1.5", "abc", 0, -2, 2.5]) {
      expect(normalizeSearchPage(value)).toBe(1)
    }
    expect(normalizeSearchPage("999999999999999999999999")).toBe(MAX_SEARCH_PAGE)
    expect(searchArticles({ sector: "tldr-ai", page: "abc" }).page).toBe(1)
  })

  it("returns an empty window for an out-of-range page while preserving totals", () => {
    const result = searchArticles({ sector: "tldr-ai", page: 4 })
    expect(result.items).toEqual([])
    expect(result).toMatchObject({ total: 125, page: 4, page_count: 3 })
  })

  it("keeps combined filters exact", () => {
    const result = searchArticles({
      query: "PAGED MODEL",
      sector: "tldr-ai",
      year: "2026",
      contentType: "editorial",
      readingTime: "medium",
      page: 2,
    })
    expect(result.total).toBe(100)
    expect(result.items).toHaveLength(50)
    expect(result.items.every((item) => item.article.content_type === "editorial")).toBe(true)
  })

  it("rejects unknown filters instead of interpreting them as valid buckets", () => {
    expect(searchArticles({ sector: "unknown" }).total).toBe(0)
    expect(searchArticles({ year: "2099" }).total).toBe(0)
    expect(searchArticles({ contentType: "unknown" }).total).toBe(0)
    expect(searchArticles({ readingTime: "unknown" }).total).toBe(0)
  })

  it("returns only page metadata and the bounded window, not a complete result array", () => {
    const result = searchArticles({ sector: "tldr-ai" })
    expect(Object.keys(result).sort()).toEqual([
      "items",
      "page",
      "page_count",
      "page_size",
      "total",
    ])
    expect(result.total).toBeGreaterThan(result.items.length)
    expect(result.items).toHaveLength(SEARCH_PAGE_SIZE)
  })
})
