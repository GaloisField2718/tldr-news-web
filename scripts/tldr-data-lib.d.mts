interface SourceMetadata {
  source_repository: string
  requested_ref: string
  resolved_source_commit: string
  source_mode: "remote" | "local"
  schema_version: string
  generator_version: string
  issue_count: number
  article_count: number
}
interface SearchMetadata {
  resolved_source_commit: string
  article_count: number
  searchable_count: number
  uncompressed_bytes: number
  gzip_bytes: number
  segments: Array<{ year: number; file: string; gzip_bytes: number }>
}
interface DailyMetadata {
  resolved_source_commit: string
  edition_count: number
  article_occurrence_count: number
  unique_article_count: number
  gzip_bytes: number
  uncompressed_bytes: number
  dates: Array<{
    date: string
    file: string
    unique_article_count: number
    page_count: number
    gzip_bytes: number
    uncompressed_bytes: number
  }>
}
interface ValidationResult {
  manifest: { schema_version: string; generator_version: string }
  documents: Array<{ entry: unknown; issue: unknown }>
  issueCount: number
  articleCount: number
}
interface GenerationResult {
  metadata: SourceMetadata
  catalogue: SourceMetadata & { total_issues: number }
  searchMetadata: SearchMetadata
  dailyMetadata: DailyMetadata
}

export const SUPPORTED_SCHEMA_VERSION: string
export const PARSE_STATUSES: Set<string>
export const FORMAT_FAMILIES: Set<string>
export const CONTENT_TYPES: Set<string>
export const CANONICAL_SECTORS: readonly (readonly [string, string])[]
export function validateGeneratedDataset(generatedDir: string): Promise<ValidationResult>
export function generateFrontendArtifacts(options: {
  generatedDir: string
  outputDir: string
  sourceRepository: string
  requestedRef: string
  resolvedSourceCommit: string
  sourceMode?: "remote" | "local"
}): Promise<GenerationResult>
export function copyGeneratedDataset(source: string, destination: string): Promise<void>
export function assertFrontendArtifacts(options: {
  generatedDir: string
  outputDir: string
}): Promise<GenerationResult>
