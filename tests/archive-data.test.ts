import { gunzipSync } from "node:zlib"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { generateFrontendArtifacts } from "../scripts/tldr-data-lib.mjs"
import {
  getArchiveCatalogue,
  getArchiveIndex,
  getLatestIssues,
} from "@/lib/archive"
import { getIssue } from "@/lib/issues"
import { searchArticles } from "@/lib/search"
import { representativeIssues, writeDataset } from "./helpers/dataset"

let temporary: string
let generated: string
let artifacts: string

beforeAll(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "tldr-archive-test-"))
  generated = path.join(temporary, "generated")
  artifacts = path.join(temporary, "artifacts")
  await writeDataset(generated, representativeIssues())
  await generateFrontendArtifacts({
    generatedDir: generated,
    outputDir: artifacts,
    sourceRepository: "owner/source",
    requestedRef: "test",
    resolvedSourceCommit: "b".repeat(40),
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

describe("archive catalogue", () => {
  it("orders latest issues and computes issue, section, and article counts", () => {
    const catalogue = getArchiveCatalogue()
    expect(catalogue.total_issues).toBe(3)
    expect(catalogue.article_count).toBe(6)
    expect(getLatestIssues().map((issue) => issue.date)).toEqual([
      "2026-07-17",
      "2026-06-01",
      "2023-01-17",
    ])
    expect(getLatestIssues()[0]).toMatchObject({ section_count: 1, article_count: 5 })
  })

  it("computes sector counts and represents the canonical sector lineup", () => {
    const catalogue = getArchiveCatalogue()
    expect(catalogue.sectors).toHaveLength(11)
    expect(catalogue.sectors.find((sector) => sector.sector_slug === "tldr-ai")?.issue_count).toBe(2)
    expect(catalogue.sectors.find((sector) => sector.sector_slug === "tldr")?.issue_count).toBe(1)
  })

  it("groups archive years and months in descending order", () => {
    const archive = getArchiveIndex()
    expect(archive.map((year) => year.year)).toEqual([2026, 2023])
    expect(archive[0].months.map((month) => month.month)).toEqual([7, 6])
    expect(archive[0].issue_count).toBe(2)
  })

  it("resolves issues by sector/date and handles a failed issue", () => {
    expect(getIssue("tldr-ai", "2026-07-17")?.format_family).toBe("links_block")
    expect(getIssue("tldr", "2023-01-17")).toMatchObject({ parse_status: "failed", sections: [] })
    expect(getIssue("missing", "2026-07-17")).toBeUndefined()
  })

  it("covers the complete raw unions and nullable historical fields", () => {
    const modern = getIssue("tldr-ai", "2026-07-17")!
    const historical = getIssue("tldr-ai", "2026-06-01")!
    const failed = getIssue("tldr", "2023-01-17")!
    expect(new Set([modern.format_family, historical.format_family, failed.format_family])).toEqual(
      new Set(["links_block", "inline_url", "unknown"]),
    )
    expect(new Set(modern.sections[0].articles.map((article) => article.content_type))).toEqual(
      new Set(["editorial", "sponsor", "github_repo", "course", "tool"]),
    )
    expect(modern.sections[0].articles.find((article) => article.content_type === "course")?.summary).toBe("")
    expect(historical).toMatchObject({ parse_status: "partial" })
    expect(historical.parse_warnings[0]).toEqual({
      code: "partial_fixture",
      message: "partial fixture",
      line: null,
    })
    expect(historical.sections[0].articles[0]).toMatchObject({
      title: "",
      url: null,
      reading_time_minutes: null,
      source_domain: null,
    })
  })
})

describe("server-side segmented search", () => {
  it("searches titles and summaries case-insensitively", () => {
    expect(searchArticles({ query: "MODEL" })).toHaveLength(1)
    expect(searchArticles({ query: "historical summary" })).toHaveLength(1)
  })

  it("supports sector, year, content type, reading time, and combined filters", () => {
    expect(searchArticles({ sector: "tldr-ai" })).toHaveLength(6)
    expect(searchArticles({ year: "2023" })).toHaveLength(0)
    expect(searchArticles({ contentType: "sponsor" })).toHaveLength(1)
    expect(searchArticles({ readingTime: "medium" })).toHaveLength(5)
    expect(
      searchArticles({
        query: "model",
        sector: "tldr-ai",
        year: "2026",
        contentType: "editorial",
        readingTime: "medium",
      }),
    ).toHaveLength(1)
  })

  it("returns no results safely and preserves nullable fields and issue routes", () => {
    expect(searchArticles({ query: "not present anywhere" })).toEqual([])
    const [result] = searchArticles({ query: "historical summary" })
    expect(result.article).toMatchObject({ url: null, reading_time_minutes: null })
    expect(result.issue_route).toBe("/issues/tldr-ai/2026-06-01")
  })

  it("does not leak raw issue-only data into compact search documents", async () => {
    const metadata = JSON.parse(await readFile(path.join(artifacts, "search-metadata.json"), "utf8"))
    const compressed = await readFile(path.join(artifacts, "search", metadata.segments[0].file))
    const documents = JSON.parse(gunzipSync(compressed).toString("utf8"))
    const serialized = JSON.stringify(documents)
    for (const forbidden of ["parse_warnings", "source_path", "source_content_hash", "sections"]) {
      expect(serialized).not.toContain(forbidden)
    }
  })
})

describe("production data safety", () => {
  it("has no production fixture import or moving-main issue URL", async () => {
    const archiveSource = await readFile(path.join(process.cwd(), "lib", "archive.ts"), "utf8")
    const syncSource = await readFile(path.join(process.cwd(), "scripts", "sync-tldr-data.mjs"), "utf8")
    expect(archiveSource).not.toMatch(/from ["']\.\/fixtures["']/)
    expect(syncSource).not.toContain("raw.githubusercontent.com")
  })

  it("fails clearly rather than falling back when generated data is absent", () => {
    process.env.TLDR_GENERATED_DIR = path.join(temporary, "absent")
    expect(() => getArchiveCatalogue()).toThrow("Real TLDR archive data is unavailable")
    process.env.TLDR_GENERATED_DIR = artifacts
  })
})
