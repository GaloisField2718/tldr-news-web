import { readFileSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import {
  getArchiveCatalogue,
  getGeneratedDataRoot,
  readGeneratedJson,
} from "./archive"
import type { Article, SearchDocument } from "./types"

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
  issue_route: string
}
interface SearchSegment {
  year: number
  file: string
}
interface SearchMetadata {
  resolved_source_commit: string
  segments: SearchSegment[]
}

function matchesReadingTime(minutes: number | null, bucket: ReadingTimeBucket): boolean {
  if (bucket === "any") return true
  if (minutes === null) return false
  if (bucket === "short") return minutes <= 4
  if (bucket === "medium") return minutes >= 5 && minutes <= 9
  return minutes >= 10
}

function searchSegments(year: string | undefined): SearchSegment[] {
  const root = getGeneratedDataRoot()
  const metadata = readGeneratedJson<SearchMetadata>(
    path.join(root, "search-metadata.json"),
    "search metadata",
  )
  const catalogue = getArchiveCatalogue()
  if (metadata.resolved_source_commit !== catalogue.resolved_source_commit) {
    throw new Error("Search data and archive catalogue were generated from different source commits")
  }
  if (year && year !== "all") {
    return metadata.segments.filter((segment) => String(segment.year) === year)
  }
  return metadata.segments
}

function readSearchDocuments(segment: SearchSegment): SearchDocument[] {
  const file = path.join(getGeneratedDataRoot(), "search", segment.file)
  try {
    return JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as SearchDocument[]
  } catch (error) {
    throw new Error(`Real TLDR search data is unavailable (${segment.file}). Run \`npm run data:sync\`.`, { cause: error })
  }
}

export function searchArticles(params: SearchParams): SearchResultItem[] {
  const query = params.query?.trim().toLocaleLowerCase() ?? ""
  const bucket = params.readingTime ?? "any"
  const results: SearchResultItem[] = []
  for (const segment of searchSegments(params.year)) {
    for (const document of readSearchDocuments(segment)) {
      if (params.sector && params.sector !== "all" && document.sector_slug !== params.sector) continue
      if (params.contentType && params.contentType !== "all" && document.content_type !== params.contentType) continue
      if (!matchesReadingTime(document.reading_time_minutes, bucket)) continue
      if (query && !`${document.title} ${document.summary}`.toLocaleLowerCase().includes(query)) continue
      results.push({
        article: {
          id: document.id,
          order: 0,
          title: document.title,
          summary: document.summary,
          url: document.url,
          reading_time_minutes: document.reading_time_minutes,
          source_domain: document.source_domain,
          content_type: document.content_type,
          is_sponsor: document.is_sponsor,
        },
        issue_id: document.issue_id,
        sector: document.sector,
        sector_slug: document.sector_slug,
        date: document.issue_date,
        section_heading: document.section_heading,
        issue_route: document.issue_route,
      })
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date) || a.article.id.localeCompare(b.article.id))
}
