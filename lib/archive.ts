import { readFileSync } from "node:fs"
import path from "node:path"
import type {
  ArchiveCatalogue,
  ArchiveCatalogueEntry,
  ArchiveSourceMetadata,
  SectorSummary,
} from "./types"

export function getGeneratedDataRoot(): string {
  if (process.env.TLDR_GENERATED_DIR) return path.resolve(process.env.TLDR_GENERATED_DIR)
  return path.join(/* turbopackIgnore: true */ process.cwd(), ".generated")
}

export function readGeneratedJson<T>(file: string, label: string): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T
  } catch (error) {
    throw new Error(
      `Real TLDR archive data is unavailable (${label}). Run \`npm run data:sync\` before starting or building the application.`,
      { cause: error },
    )
  }
}

let catalogueCache: { root: string; value: ArchiveCatalogue } | undefined
export function getArchiveCatalogue(): ArchiveCatalogue {
  const root = getGeneratedDataRoot()
  if (catalogueCache?.root !== root) {
    catalogueCache = {
      root,
      value: readGeneratedJson<ArchiveCatalogue>(
        path.join(root, "archive-catalogue.json"),
        "archive catalogue",
      ),
    }
  }
  return catalogueCache.value
}

export function getSourceMetadata(): ArchiveSourceMetadata {
  return getArchiveCatalogue()
}

function byDateDesc(a: ArchiveCatalogueEntry, b: ArchiveCatalogueEntry): number {
  return b.date.localeCompare(a.date) || a.sector_slug.localeCompare(b.sector_slug)
}

export function getLatestIssues(limit?: number): ArchiveCatalogueEntry[] {
  const issues = getArchiveCatalogue().issues
  return typeof limit === "number" ? issues.slice(0, limit) : issues
}

export function getSectors(): SectorSummary[] {
  return getArchiveCatalogue().sectors
}

export function getYears(): number[] {
  return getArchiveCatalogue().years
}

export function findCatalogueIssue(
  sectorSlug: string,
  date: string,
): ArchiveCatalogueEntry | undefined {
  return getArchiveCatalogue().issues.find(
    (issue) => issue.sector_slug === sectorSlug && issue.date === date,
  )
}

export function getIssuesBySector(sectorSlug: string): ArchiveCatalogueEntry[] {
  return getArchiveCatalogue().issues.filter((issue) => issue.sector_slug === sectorSlug)
}

export interface ArchiveMonth {
  month: number
  monthLabel: string
  issues: ArchiveCatalogueEntry[]
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
  const yearMap = new Map<number, Map<number, ArchiveCatalogueEntry[]>>()
  for (const issue of getArchiveCatalogue().issues) {
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
      const months = [...monthMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, issues]) => ({
          month,
          monthLabel: MONTH_LABELS[month - 1],
          issues: issues.sort(byDateDesc),
        }))
      return {
        year,
        issue_count: months.reduce((sum, month) => sum + month.issues.length, 0),
        months,
      }
    })
}
