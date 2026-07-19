import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import SearchPage from "@/app/search/page"
import IssuePage from "@/app/issues/[sector]/[date]/page"
import { ArticleEntry } from "@/components/article-entry"
import { ArticleMetadata } from "@/components/article-metadata"
import { IssueHeader } from "@/components/issue-header"
import { SearchField } from "@/components/search-field"
import { issues } from "@/lib/fixtures"
import type { Article, ContentType } from "@/lib/types"
import { generateFrontendArtifacts } from "../scripts/tldr-data-lib.mjs"
import { representativeIssues, writeDataset } from "./helpers/dataset"

let temporary: string
beforeAll(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "tldr-frontend-test-"))
  const generated = path.join(temporary, "generated")
  const artifacts = path.join(temporary, "artifacts")
  await writeDataset(generated, representativeIssues())
  await generateFrontendArtifacts({
    generatedDir: generated,
    outputDir: artifacts,
    sourceRepository: "owner/source",
    requestedRef: "test",
    resolvedSourceCommit: "c".repeat(40),
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

const article = (contentType: ContentType): Article => ({
  id: `test-${contentType}`,
  order: 1,
  title: "Fixture title",
  summary: "Fixture summary",
  url: "https://example.com/item",
  reading_time_minutes: 5,
  source_domain: "example.com",
  content_type: contentType,
  is_sponsor: contentType === "sponsor",
})

describe("generated issue contract", () => {
  it("renders structured parse warnings without treating an object as a React child", () => {
    const issue = issues.find((item) => item.parse_warnings.length > 0)
    expect(issue).toBeDefined()

    const html = renderToStaticMarkup(<IssueHeader issue={issue!} />)
    const warning = issue!.parse_warnings[0]
    expect(html).toContain(warning.message)
    expect(html).toContain(warning.code)
  })

  it("keeps fixture content types and format families inside the generated unions", () => {
    const contentTypes = new Set(["editorial", "sponsor", "github_repo", "course", "tool"])
    const formatFamilies = new Set(["links_block", "inline_url", "unknown"])

    for (const issue of issues) {
      expect(formatFamilies.has(issue.format_family)).toBe(true)
      for (const section of issue.sections) {
        for (const item of section.articles) {
          expect(contentTypes.has(item.content_type)).toBe(true)
        }
      }
    }
  })
})

describe("search forms", () => {
  it("does not render a form in embedded SearchField mode", () => {
    const html = renderToStaticMarkup(<SearchField standalone={false} defaultValue="model" />)
    expect(html).not.toContain("<form")
    expect(html).toContain('name="q"')
  })

  it("renders one search-page form containing the query and every filter", async () => {
    const page = await SearchPage({
      searchParams: Promise.resolve({
        q: "model",
        sector: "tldr-ai",
        year: "2026",
        type: "editorial",
        reading: "medium",
      }),
    })
    const html = renderToStaticMarkup(page)

    expect(html.match(/<form/g)).toHaveLength(1)
    for (const name of ["q", "sector", "year", "type", "reading"]) {
      expect(html).toContain(`name="${name}"`)
    }
    expect(html).toContain('action="/search"')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Search<\/button>/)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Apply<\/button>/)
  })
})

describe("issue rendering", () => {
  it("renders a restrained message for a failed issue without sections", async () => {
    const page = await IssuePage({
      params: Promise.resolve({ sector: "tldr", date: "2023-01-17" }),
    })
    const html = renderToStaticMarkup(page)
    expect(html).toContain("no readable entries could be recovered")
    expect(html).toContain("failed parse")
  })
})

describe("article metadata", () => {
  it.each([
    ["editorial", null],
    ["sponsor", "Sponsor"],
    ["github_repo", "GitHub repository"],
    ["course", "Course"],
    ["tool", "Tool"],
  ] as const)("handles %s content", (contentType, label) => {
    const html = renderToStaticMarkup(<ArticleMetadata article={article(contentType)} />)
    if (label) expect(html).toContain(label)
    else expect(html).not.toContain("Article")
  })

  it("renders safely when the URL and reading time are missing", () => {
    const item = { ...article("editorial"), url: null, reading_time_minutes: null }
    const html = renderToStaticMarkup(<ArticleEntry article={item} />)
    expect(html).toContain("no link")
    expect(html).not.toContain("min read")
  })
})
