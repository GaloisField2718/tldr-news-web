import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import { getArchiveCatalogue, getGeneratedDataRoot, readGeneratedJson } from "./archive"
import type {
  DailyArticlePosition,
  DailyEdition,
  DailyMetadata,
  DailyMetadataEntry,
} from "./daily-types"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ARTICLE_KEY_PATTERN = /^[a-f0-9]{32,64}$/
const editionCache = new Map<string, DailyEdition>()
let metadataCache: { root: string; value: DailyMetadata } | undefined

export function isValidDailyDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function assertMetadata(value: DailyMetadata): DailyMetadata {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray(value.dates) ||
    value.edition_count !== value.dates.length ||
    !/^[a-f0-9]{40}$/.test(value.resolved_source_commit)
  ) {
    throw new Error("Generated Daily metadata is invalid")
  }
  let previous = "9999-99-99"
  for (const entry of value.dates) {
    if (
      !isValidDailyDate(entry.date) ||
      entry.file !== `${entry.date}.json.gz` ||
      entry.date > previous ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !Number.isInteger(entry.unique_article_count) ||
      !Number.isInteger(entry.page_count)
    ) {
      throw new Error(`Generated Daily metadata entry is invalid: ${entry.date}`)
    }
    previous = entry.date
  }
  const source = getArchiveCatalogue().resolved_source_commit
  if (value.resolved_source_commit !== source) {
    throw new Error("Daily metadata and archive catalogue were generated from different source commits")
  }
  return value
}

export function getDailyMetadata(): DailyMetadata {
  const root = getGeneratedDataRoot()
  if (metadataCache?.root !== root) {
    metadataCache = {
      root,
      value: assertMetadata(
        readGeneratedJson<DailyMetadata>(
          path.join(root, "daily-metadata.json"),
          "Daily metadata",
        ),
      ),
    }
    editionCache.clear()
  }
  return metadataCache.value
}

export function getAvailableDailyDates(): DailyMetadataEntry[] {
  return getDailyMetadata().dates
}

export function getLatestDailyDate(): string | undefined {
  return getDailyMetadata().dates.find((entry) => entry.unique_article_count > 0)?.date
}

function metadataEntry(date: string): DailyMetadataEntry | undefined {
  if (!isValidDailyDate(date)) return undefined
  return getDailyMetadata().dates.find((entry) => entry.date === date)
}

function assertEdition(value: DailyEdition, entry: DailyMetadataEntry): DailyEdition {
  const metadata = getDailyMetadata()
  if (
    !value ||
    typeof value !== "object" ||
    value.date !== entry.date ||
    value.resolved_source_commit !== metadata.resolved_source_commit ||
    !Array.isArray(value.issues) ||
    !Array.isArray(value.pages) ||
    !Array.isArray(value.articles) ||
    !Array.isArray(value.article_order) ||
    !value.article_pages ||
    typeof value.article_pages !== "object"
  ) {
    throw new Error(`Generated Daily edition is invalid: ${entry.date}`)
  }
  const keys = new Set<string>()
  for (const article of value.articles) {
    if (
      !article ||
      !ARTICLE_KEY_PATTERN.test(article.article_key) ||
      article.date !== entry.date ||
      !Array.isArray(article.occurrences) ||
      article.occurrences.length === 0 ||
      keys.has(article.article_key)
    ) {
      throw new Error(`Generated Daily article is invalid: ${entry.date}`)
    }
    keys.add(article.article_key)
  }
  const assigned: string[] = []
  value.pages.forEach((page, index) => {
    if (page.number !== index + 1 || !Array.isArray(page.slots)) {
      throw new Error(`Generated Daily page numbering is invalid: ${entry.date}`)
    }
    for (const slot of page.slots) {
      assigned.push(slot.article_key)
      if (value.article_pages[slot.article_key] !== page.number) {
        throw new Error(`Generated Daily article-to-page mapping is invalid: ${entry.date}`)
      }
    }
  })
  if (
    keys.size !== entry.unique_article_count ||
    value.pages.length !== entry.page_count ||
    assigned.length !== keys.size ||
    new Set(assigned).size !== keys.size ||
    assigned.some((key) => !keys.has(key)) ||
    value.article_order.length !== keys.size ||
    value.article_order.some((key, index) => key !== assigned[index]) ||
    Object.keys(value.article_pages).length !== keys.size
  ) {
    throw new Error(`Generated Daily page assignment is invalid: ${entry.date}`)
  }
  return value
}

export function getDailyEdition(date: string): DailyEdition | undefined {
  const entry = metadataEntry(date)
  if (!entry) return undefined
  const root = getGeneratedDataRoot()
  const cacheKey = `${root}:${date}`
  const cached = editionCache.get(cacheKey)
  if (cached) return cached
  const dailyRoot = path.resolve(root, "daily")
  const file = path.resolve(dailyRoot, entry.file)
  if (!file.startsWith(`${dailyRoot}${path.sep}`)) throw new Error("Daily edition path escapes its generated root")
  let compressed: Buffer
  try {
    compressed = readFileSync(file)
  } catch (error) {
    throw new Error(
      `Real TLDR Daily data is unavailable (${entry.file}). Run \`npm run data:sync\`.`,
      { cause: error },
    )
  }
  if (createHash("sha256").update(compressed).digest("hex") !== entry.sha256) {
    throw new Error(`Daily edition checksum mismatch: ${entry.file}`)
  }
  let parsed: DailyEdition
  try {
    parsed = JSON.parse(gunzipSync(compressed).toString("utf8")) as DailyEdition
  } catch (error) {
    throw new Error(`Daily edition cannot be decompressed: ${entry.file}`, { cause: error })
  }
  const edition = assertEdition(parsed, entry)
  editionCache.set(cacheKey, edition)
  if (editionCache.size > 8) editionCache.delete(editionCache.keys().next().value!)
  return edition
}

export function findDailyArticle(date: string, articleKey: string) {
  if (!ARTICLE_KEY_PATTERN.test(articleKey)) return undefined
  return getDailyEdition(date)?.articles.find((article) => article.article_key === articleKey)
}

export function getPreviousDailyDate(date: string): string | undefined {
  const dates = getDailyMetadata().dates
  const index = dates.findIndex((entry) => entry.date === date)
  return index >= 0 ? dates.slice(index + 1).find((entry) => entry.unique_article_count > 0)?.date : undefined
}

export function getNextDailyDate(date: string): string | undefined {
  const dates = getDailyMetadata().dates
  const index = dates.findIndex((entry) => entry.date === date)
  if (index < 0) return undefined
  for (let next = index - 1; next >= 0; next -= 1) {
    if (dates[next].unique_article_count > 0) return dates[next].date
  }
  return undefined
}

export function normalizeDailyPage(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : 1
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

export function getDailyArticlePosition(date: string, articleKey: string): DailyArticlePosition | undefined {
  const edition = getDailyEdition(date)
  if (!edition) return undefined
  const index = edition.article_order.indexOf(articleKey)
  if (index < 0) return undefined
  const article = edition.articles.find((item) => item.article_key === articleKey)
  const page = edition.article_pages[articleKey]
  if (!article || !page) return undefined
  return {
    article,
    page,
    index,
    total: edition.article_order.length,
    previousKey: index > 0 ? edition.article_order[index - 1] : null,
    nextKey: index + 1 < edition.article_order.length ? edition.article_order[index + 1] : null,
  }
}
