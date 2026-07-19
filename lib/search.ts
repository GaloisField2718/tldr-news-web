import { readFileSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import {
  getArchiveCatalogue,
  getGeneratedDataRoot,
  readGeneratedJson,
} from "./archive"
import type { Article, ContentType, SearchDocument } from "./types"

export const SEARCH_PAGE_SIZE = 50
export const MAX_SEARCH_PAGE = 1_000_000

export type ReadingTimeBucket = "any" | "short" | "medium" | "long"
export interface SearchParams {
  query?: string
  sector?: string
  year?: string
  contentType?: string
  readingTime?: string
  page?: string | number
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
export interface SearchPageResult {
  items: SearchResultItem[]
  total: number
  page: number
  page_size: number
  page_count: number
}
export interface ValidatedSearchFilters {
  sector: string
  year: string
  contentType: string
  readingTime: ReadingTimeBucket
  valid: boolean
}
interface SearchSegment {
  year: number
  file: string
}
interface SearchMetadata {
  resolved_source_commit: string
  segments: SearchSegment[]
}

const CONTENT_TYPES = new Set<ContentType>([
  "editorial",
  "sponsor",
  "github_repo",
  "course",
  "tool",
])
const READING_TIMES = new Set<ReadingTimeBucket>(["any", "short", "medium", "long"])

export function normalizeSearchPage(value: string | number | undefined): number {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 1) return 1
    return Math.min(value, MAX_SEARCH_PAGE)
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) return MAX_SEARCH_PAGE
  return Math.min(parsed, MAX_SEARCH_PAGE)
}

export function validateSearchFilters(params: {
  sector?: string
  year?: string
  contentType?: string
  readingTime?: string
}): ValidatedSearchFilters {
  const catalogue = getArchiveCatalogue()
  const sectors = new Set(catalogue.sectors.map((sector) => sector.sector_slug))
  const years = new Set(catalogue.years.map(String))
  const sectorValid = !params.sector || params.sector === "all" || sectors.has(params.sector)
  const yearValid = !params.year || params.year === "all" || years.has(params.year)
  const typeValid =
    !params.contentType ||
    params.contentType === "all" ||
    CONTENT_TYPES.has(params.contentType as ContentType)
  const readingValid =
    !params.readingTime || READING_TIMES.has(params.readingTime as ReadingTimeBucket)

  return {
    sector: sectorValid ? (params.sector ?? "all") : "all",
    year: yearValid ? (params.year ?? "all") : "all",
    contentType: typeValid ? (params.contentType ?? "all") : "all",
    readingTime: readingValid ? ((params.readingTime ?? "any") as ReadingTimeBucket) : "any",
    valid: sectorValid && yearValid && typeValid && readingValid,
  }
}

function emptyResult(page: number): SearchPageResult {
  return {
    items: [],
    total: 0,
    page,
    page_size: SEARCH_PAGE_SIZE,
    page_count: 0,
  }
}

function matchesReadingTime(minutes: number | null, bucket: ReadingTimeBucket): boolean {
  if (bucket === "any") return true
  if (minutes === null) return false
  if (bucket === "short") return minutes <= 4
  if (bucket === "medium") return minutes >= 5 && minutes <= 9
  if (bucket === "long") return minutes >= 10
  return false
}

function searchSegments(year: string): SearchSegment[] {
  const root = getGeneratedDataRoot()
  const metadata = readGeneratedJson<SearchMetadata>(
    path.join(root, "search-metadata.json"),
    "search metadata",
  )
  const catalogue = getArchiveCatalogue()
  if (metadata.resolved_source_commit !== catalogue.resolved_source_commit) {
    throw new Error("Search data and archive catalogue were generated from different source commits")
  }
  if (year !== "all") {
    return metadata.segments.filter((segment) => String(segment.year) === year)
  }
  return metadata.segments
}

function readSearchDocuments(segment: SearchSegment): SearchDocument[] {
  const file = path.join(getGeneratedDataRoot(), "search", segment.file)
  try {
    return JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as SearchDocument[]
  } catch (error) {
    throw new Error(
      `Real TLDR search data is unavailable (${segment.file}). Run \`npm run data:sync\`.`,
      { cause: error },
    )
  }
}

function toSearchResult(document: SearchDocument): SearchResultItem {
  return {
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
  }
}

export function searchArticles(params: SearchParams): SearchPageResult {
  const page = normalizeSearchPage(params.page)
  const filters = validateSearchFilters(params)
  if (!filters.valid) return emptyResult(page)

  const query = params.query?.trim().toLocaleLowerCase() ?? ""
  const windowStart = (page - 1) * SEARCH_PAGE_SIZE
  const items: SearchResultItem[] = []
  let total = 0

  for (const segment of searchSegments(filters.year)) {
    for (const document of readSearchDocuments(segment)) {
      if (filters.sector !== "all" && document.sector_slug !== filters.sector) continue
      if (filters.contentType !== "all" && document.content_type !== filters.contentType) continue
      if (!matchesReadingTime(document.reading_time_minutes, filters.readingTime)) continue
      if (
        query &&
        !`${document.title} ${document.summary}`.toLocaleLowerCase().includes(query)
      ) {
        continue
      }

      if (total >= windowStart && items.length < SEARCH_PAGE_SIZE) {
        items.push(toSearchResult(document))
      }
      total += 1
    }
  }

  return {
    items,
    total,
    page,
    page_size: SEARCH_PAGE_SIZE,
    page_count: Math.ceil(total / SEARCH_PAGE_SIZE),
  }
}
