import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
  Article,
  ContentType,
  FormatFamily,
  IssueDocument,
  ParseStatus,
  RawManifest,
  RawManifestEntry,
} from "@/lib/types"

const hash = `sha256:${"0".repeat(64)}`

export function makeArticle(
  id: string,
  content_type: ContentType = "editorial",
  overrides: Partial<Article> = {},
): Article {
  return {
    id,
    order: 1,
    title: "Model systems launch",
    summary: "A practical summary about reliable inference.",
    url: "https://example.com/article",
    reading_time_minutes: 7,
    source_domain: "example.com",
    content_type,
    is_sponsor: content_type === "sponsor",
    ...overrides,
  }
}

export function makeIssue({
  sector = "TLDR AI",
  sectorSlug = "tldr-ai",
  date = "2026-07-17",
  formatFamily = "links_block",
  parseStatus = "complete",
  articles = [makeArticle(`${sectorSlug}:${date}:a01`)],
}: {
  sector?: string
  sectorSlug?: string
  date?: string
  formatFamily?: FormatFamily
  parseStatus?: ParseStatus
  articles?: Article[]
} = {}): IssueDocument {
  return {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: `${sectorSlug}:${date}`,
    sector,
    sector_slug: sectorSlug,
    date,
    source_path: `${sector}/article_${date}.md`,
    source_content_hash: hash,
    format_family: formatFamily,
    parse_status: parseStatus,
    parse_warnings:
      parseStatus === "complete"
        ? []
        : [{ code: `${parseStatus}_fixture`, message: `${parseStatus} fixture`, line: null }],
    title: `${sector} ${date}`,
    sections:
      parseStatus === "failed"
        ? []
        : [{ id: "general", heading: "GENERAL", order: 1, articles }],
  }
}

export function manifestEntry(issue: IssueDocument): RawManifestEntry {
  return {
    issue_id: issue.issue_id,
    sector: issue.sector,
    sector_slug: issue.sector_slug,
    date: issue.date,
    source_path: issue.source_path,
    source_content_hash: issue.source_content_hash,
    schema_version: issue.schema_version,
    generator_version: issue.generator_version,
    format_family: issue.format_family,
    parse_status: issue.parse_status,
    derived_path: `issues/${issue.sector_slug}/${issue.date.slice(0, 4)}/${issue.date}.json`,
  }
}

export async function writeDataset(root: string, issues: IssueDocument[]): Promise<RawManifest> {
  const manifest: RawManifest = {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issues: issues.map(manifestEntry),
  }
  await mkdir(root, { recursive: true })
  for (const [index, issue] of issues.entries()) {
    const entry = manifest.issues[index]
    const file = path.join(root, entry.derived_path)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, `${JSON.stringify(issue, null, 2)}\n`)
  }
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

export function representativeIssues(): IssueDocument[] {
  const date = "2026-07-17"
  return [
    makeIssue({
      date,
      articles: [
        makeArticle(`tldr-ai:${date}:a01`, "editorial"),
        makeArticle(`tldr-ai:${date}:a02`, "sponsor", { title: "Sponsored platform", order: 2 }),
        makeArticle(`tldr-ai:${date}:a03`, "github_repo", { title: "Repository", order: 3 }),
        makeArticle(`tldr-ai:${date}:a04`, "course", {
          title: "Course",
          summary: "",
          order: 4,
        }),
        makeArticle(`tldr-ai:${date}:a05`, "tool", { title: "Tool", order: 5 }),
      ],
    }),
    makeIssue({
      date: "2026-06-01",
      formatFamily: "inline_url",
      parseStatus: "partial",
      articles: [
        makeArticle("tldr-ai:2026-06-01:o001", "editorial", {
          title: "",
          summary: "Historical SUMMARY text",
          url: null,
          reading_time_minutes: null,
          source_domain: null,
        }),
      ],
    }),
    makeIssue({
      sector: "TLDR",
      sectorSlug: "tldr",
      date: "2023-01-17",
      formatFamily: "unknown",
      parseStatus: "failed",
      articles: [],
    }),
  ]
}
