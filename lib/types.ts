// Raw generated contracts owned by GaloisField2718/tldr_news.

export type ParseStatus = "complete" | "partial" | "failed"
export type FormatFamily = "links_block" | "inline_url" | "unknown"
export type ContentType = "editorial" | "sponsor" | "github_repo" | "course" | "tool"

export interface ParseWarning {
  code: string
  message: string
  line: number | null
}

export interface Article {
  id: string
  order: number
  title: string
  summary: string
  url: string | null
  reading_time_minutes: number | null
  source_domain: string | null
  content_type: ContentType
  is_sponsor: boolean
}

export interface Section {
  id: string
  heading: string
  order: number
  articles: Article[]
}

export interface IssueDocument {
  schema_version: string
  generator_version: string
  issue_id: string
  sector: string
  sector_slug: string
  date: string
  source_path: string
  source_content_hash: string
  format_family: FormatFamily
  parse_status: ParseStatus
  parse_warnings: ParseWarning[]
  title: string
  sections: Section[]
}

export interface RawManifestEntry {
  issue_id: string
  sector: string
  sector_slug: string
  date: string
  source_path: string
  source_content_hash: string
  schema_version: string
  generator_version: string
  format_family: FormatFamily
  parse_status: ParseStatus
  derived_path: string
}

export interface RawManifest {
  schema_version: string
  generator_version: string
  issues: RawManifestEntry[]
}

// Frontend catalogue contracts generated from, but distinct from, the raw manifest.

export interface ArchiveCatalogueEntry {
  issue_id: string
  sector: string
  sector_slug: string
  date: string
  title: string
  parse_status: ParseStatus
  format_family: FormatFamily
  section_count: number
  article_count: number
  derived_path: string
}

export interface SectorSummary {
  sector: string
  sector_slug: string
  issue_count: number
}

export interface ArchiveSourceMetadata {
  source_repository: string
  requested_ref: string
  resolved_source_commit: string
  source_mode: "remote" | "local"
  schema_version: string
  generator_version: string
  issue_count: number
  article_count: number
}

export interface ArchiveCatalogue extends ArchiveSourceMetadata {
  total_issues: number
  sectors: SectorSummary[]
  years: number[]
  issues: ArchiveCatalogueEntry[]
}

// Compact server-side search contract. Raw issue-only fields are intentionally absent.

export interface SearchDocument {
  id: string
  title: string
  summary: string
  url: string | null
  source_domain: string | null
  reading_time_minutes: number | null
  content_type: ContentType
  is_sponsor: boolean
  issue_id: string
  issue_date: string
  sector: string
  sector_slug: string
  issue_route: string
  section_heading: string
}
