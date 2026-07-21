import type { IssueDocument } from "../lib/types"
import type { DailyEdition, DailyMetadata, DailyMetadataEntry } from "../lib/daily-types"

export const DAILY_SECTOR_ORDER: readonly string[]
export function presentationClass(article: {
  content_type: string
  is_sponsor: boolean
}): "sponsor" | "resource" | "editorial"
export function canonicalizeDailyUrl(value: string | null): string | null
export function balancedChunks<T>(items: T[], maxCapacity?: number): T[][]
export function dailyArticleKey(issueId: string, articleId: string): string
export function composeDailyEdition(options: {
  date: string
  documents: Array<{ entry: { date: string }; issue: IssueDocument }>
  resolvedSourceCommit: string
  articleKeyFactory?: (issueId: string, articleId: string) => string
}): DailyEdition
export function generateDailyArtifacts(options: {
  documents: Array<{ entry: { date: string }; issue: IssueDocument }>
  outputDir: string
  resolvedSourceCommit: string
}): Promise<DailyMetadata>
export function validateDailyEdition(
  edition: DailyEdition,
  metadataEntry: DailyMetadataEntry,
  sourceCommit: string,
): DailyEdition
export function assertDailyArtifacts(options: {
  outputDir: string
  resolvedSourceCommit: string
}): Promise<DailyMetadata>
