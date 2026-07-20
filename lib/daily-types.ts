import type { ContentType, ParseStatus } from "./types"

export type DailyPageTemplate =
  | "front-page"
  | "section-lead"
  | "three-column"
  | "briefs"
  | "resources"
  | "sponsored"

export type DailySlotRole =
  | "lead"
  | "secondary"
  | "standard"
  | "brief"
  | "resource"
  | "sponsor"

export interface DailyMetadataEntry {
  date: string
  file: string
  issue_count: number
  occurrence_count: number
  unique_article_count: number
  editorial_count: number
  resource_count: number
  sponsor_count: number
  page_count: number
  gzip_bytes: number
  uncompressed_bytes: number
  sha256: string
}

export interface DailyMetadata {
  resolved_source_commit: string
  edition_count: number
  article_occurrence_count: number
  unique_article_count: number
  gzip_bytes: number
  uncompressed_bytes: number
  dates: DailyMetadataEntry[]
}

export interface DailyIssueSummary {
  issue_id: string
  title: string
  route: string
  sector: string
  sector_slug: string
  parse_status: ParseStatus
  article_count: number
  available: boolean
}

export interface DailyArticleOccurrence {
  article_key: string
  article_id: string
  issue_id: string
  issue_title: string
  issue_route: string
  issue_parse_status: ParseStatus
  sector: string
  sector_slug: string
  section_id: string
  section_heading: string
  section_order: number
  article_order: number
  content_type: ContentType
  is_sponsor: boolean
}

export interface DailyArticle {
  article_key: string
  id: string
  issue_id: string
  issue_title: string
  issue_route: string
  issue_parse_status: ParseStatus
  date: string
  sector: string
  sector_slug: string
  section_id: string
  section_heading: string
  section_order: number
  article_order: number
  title: string
  summary: string
  url: string | null
  canonical_url: string | null
  source_domain: string | null
  reading_time_minutes: number | null
  content_type: ContentType
  is_sponsor: boolean
  occurrences: DailyArticleOccurrence[]
}

export interface DailyPageSlot {
  role: DailySlotRole
  article_key: string
}

export interface DailyPage {
  number: number
  template: DailyPageTemplate
  title: string | null
  kicker: string | null
  sectors: string[]
  slots: DailyPageSlot[]
}

export interface DailyEdition {
  date: string
  resolved_source_commit: string
  issues: DailyIssueSummary[]
  pages: DailyPage[]
  articles: DailyArticle[]
  article_pages: Record<string, number>
  article_order: string[]
}

export interface DailyArticlePosition {
  article: DailyArticle
  page: number
  index: number
  total: number
  previousKey: string | null
  nextKey: string | null
}
