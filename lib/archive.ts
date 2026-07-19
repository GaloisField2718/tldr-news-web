import { issues } from "./fixtures"
import type {
  Article,
  ContentType,
  Issue,
  Manifest,
  ManifestIssue,
  SectorSummary,
} from "./types"

// Data-access layer over the archive. Every read the UI performs goes through
// these helpers, so the underlying source (fixtures today, static JSON later)
// can change without touching components.

function toManifestIssue(issue: Issue): ManifestIssue {
  const article_count = issue.sections.reduce((sum, s) => sum + s.articles.length, 0)
  return {
    issue_id: issue.issue_id,
    sector: issue.sector,
    sector_slug: issue.sector_slug,
    date: issue.date,
    title: issue.title,
    parse_status: issue.parse_status,
    section_count: issue.sections.length,
    article_count,
  }
}

function byDateDesc(a: { date: string }, b: { date: string }): number {
  return b.date.localeCompare(a.date)
}

// The full published TLDR lineup, in editorial order. Issue counts are derived
// from the indexed archive below; sectors with no indexed issues yet resolve to
// a count of 0 rather than disappearing from the index.
const CANONICAL_SECTORS: { sector: string; sector_slug: string }[] = [
  { sector: "TLDR", sector_slug: "tldr" },
  { sector: "TLDR AI", sector_slug: "tldr-ai" },
  { sector: "TLDR Crypto", sector_slug: "tldr-crypto" },
  { sector: "TLDR Marketing", sector_slug: "tldr-marketing" },
  { sector: "TLDR Design", sector_slug: "tldr-design" },
  { sector: "TLDR Web Dev", sector_slug: "tldr-web-dev" },
  { sector: "TLDR InfoSec", sector_slug: "tldr-infosec" },
  { sector: "TLDR Founders", sector_slug: "tldr-founders" },
  { sector: "TLDR Product", sector_slug: "tldr-product" },
  { sector: "TLDR Dev", sector_slug: "tldr-dev" },
  { sector: "TLDR Cybersecurity", sector_slug: "tldr-cybersecurity" },
]

export function getManifest(): Manifest {
  const manifestIssues = issues.map(toManifestIssue).sort(byDateDesc)

  const counts = new Map<string, number>()
  for (const issue of issues) {
    counts.set(issue.sector_slug, (counts.get(issue.sector_slug) ?? 0) + 1)
  }
  const sectors: SectorSummary[] = CANONICAL_SECTORS.map((s) => ({
    sector: s.sector,
    sector_slug: s.sector_slug,
    issue_count: counts.get(s.sector_slug) ?? 0,
  }))

  const years = [...new Set(issues.map((i) => Number(i.date.slice(0, 4))))].sort((a, b) => b - a)

  return {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    total_issues: issues.length,
    sectors,
    years,
    issues: manifestIssues,
  }
}

export function getLatestIssues(limit?: number): ManifestIssue[] {
  const sorted = issues.map(toManifestIssue).sort(byDateDesc)
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted
}

export function getSectors(): SectorSummary[] {
  return getManifest().sectors
}

export function getYears(): number[] {
  return getManifest().years
}

export function getIssue(sectorSlug: string, date: string): Issue | undefined {
  return issues.find((i) => i.sector_slug === sectorSlug && i.date === date)
}

export function getIssuesBySector(sectorSlug: string): ManifestIssue[] {
  return issues
    .filter((i) => i.sector_slug === sectorSlug)
    .map(toManifestIssue)
    .sort(byDateDesc)
}

/** All issues grouped for the archive index: year -> month -> issues. */
export interface ArchiveMonth {
  month: number
  monthLabel: string
  issues: ManifestIssue[]
}
export interface ArchiveYear {
  year: number
  issue_count: number
  months: ArchiveMonth[]
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function getArchiveIndex(): ArchiveYear[] {
  const all = issues.map(toManifestIssue)
  const yearMap = new Map<number, Map<number, ManifestIssue[]>>()

  for (const issue of all) {
    const year = Number(issue.date.slice(0, 4))
    const month = Number(issue.date.slice(5, 7))
    if (!yearMap.has(year)) yearMap.set(year, new Map())
    const monthMap = yearMap.get(year)!
    if (!monthMap.has(month)) monthMap.set(month, [])
    monthMap.get(month)!.push(issue)
  }

  return [...yearMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, monthMap]) => {
      const months: ArchiveMonth[] = [...monthMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, monthIssues]) => ({
          month,
          monthLabel: MONTH_LABELS[month - 1],
          issues: monthIssues.sort(byDateDesc),
        }))
      const issue_count = months.reduce((sum, m) => sum + m.issues.length, 0)
      return { year, issue_count, months }
    })
}

// --- Search -----------------------------------------------------------------

export type ReadingTimeBucket = "any" | "short" | "medium" | "long"

export interface SearchParams {
  query?: string
  sector?: string
  year?: string
  contentType?: string
  readingTime?: ReadingTimeBucket
}

export interface SearchResultItem {
  article: Article
  issue_id: string
  sector: string
  sector_slug: string
  date: string
  section_heading: string
}

function matchesReadingTime(minutes: number | null, bucket: ReadingTimeBucket): boolean {
  if (bucket === "any") return true
  if (minutes === null) return false
  if (bucket === "short") return minutes <= 4
  if (bucket === "medium") return minutes >= 5 && minutes <= 9
  return minutes >= 10
}

export function searchArticles(params: SearchParams): SearchResultItem[] {
  const q = params.query?.trim().toLowerCase() ?? ""
  const results: SearchResultItem[] = []

  for (const issue of issues) {
    if (params.sector && params.sector !== "all" && issue.sector_slug !== params.sector) continue
    if (params.year && params.year !== "all" && !issue.date.startsWith(params.year)) continue

    for (const section of issue.sections) {
      for (const article of section.articles) {
        if (
          params.contentType &&
          params.contentType !== "all" &&
          article.content_type !== params.contentType
        ) {
          continue
        }
        if (!matchesReadingTime(article.reading_time_minutes, params.readingTime ?? "any")) continue
        if (q) {
          const haystack = `${article.title} ${article.summary}`.toLowerCase()
          if (!haystack.includes(q)) continue
        }
        results.push({
          article,
          issue_id: issue.issue_id,
          sector: issue.sector,
          sector_slug: issue.sector_slug,
          date: issue.date,
          section_heading: section.heading,
        })
      }
    }
  }

  // Most recent first, then by section order within a day.
  return results.sort((a, b) => b.date.localeCompare(a.date) || a.article.order - b.article.order)
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: "Article",
  sponsor: "Sponsor",
  quick_link: "Quick link",
  job: "Job",
  tool: "Tool",
}
