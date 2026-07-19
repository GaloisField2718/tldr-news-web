// Data contract for the TLDR Index archive.
// These types mirror the normalized archive shape. Fixture data implements the
// same contract, so it can later be replaced by static JSON without UI changes.

export type ParseStatus = "complete" | "partial" | "failed"

export type FormatFamily = "links_block" | "prose" | "mixed"

export type ContentType = "article" | "sponsor" | "quick_link" | "job" | "tool"

export interface Article {
  id: string
  order: number
  title: string
  summary: string
  /** External destination. May be absent for malformed or unparsed entries. */
  url: string | null
  /** Estimated reading time in minutes. May be absent when not derivable. */
  reading_time_minutes: number | null
  /** Hostname of the linked source, e.g. "example.com". May be absent. */
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

export interface Issue {
  schema_version: string
  generator_version: string
  /** Stable identifier, e.g. "tldr-ai:2026-07-17". */
  issue_id: string
  /** Human-readable sector name, e.g. "TLDR AI". */
  sector: string
  /** URL-safe sector identifier, e.g. "tldr-ai". */
  sector_slug: string
  /** ISO date (YYYY-MM-DD). */
  date: string
  source_path: string
  source_content_hash: string
  format_family: FormatFamily
  parse_status: ParseStatus
  parse_warnings: string[]
  title: string
  sections: Section[]
}

/** Lightweight issue reference used in listings and the manifest. */
export interface ManifestIssue {
  issue_id: string
  sector: string
  sector_slug: string
  date: string
  title: string
  parse_status: ParseStatus
  /** Denormalized counts for fast listing without loading full issues. */
  section_count: number
  article_count: number
}

export interface Manifest {
  schema_version: string
  generator_version: string
  /** Total issue count across the archive. */
  total_issues: number
  /** Distinct sectors present in the archive. */
  sectors: SectorSummary[]
  /** Years represented in the archive, descending. */
  years: number[]
  issues: ManifestIssue[]
}

export interface SectorSummary {
  sector: string
  sector_slug: string
  issue_count: number
}
