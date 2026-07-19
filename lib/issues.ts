import { readFileSync } from "node:fs"
import path from "node:path"
import { findCatalogueIssue, getArchiveCatalogue } from "./archive"
import type { IssueDocument } from "./types"

function resolveIssueFile(derivedPath: string): { root: string; file: string } {
  if (process.env.TLDR_ISSUES_DIR) {
    const root = path.resolve(process.env.TLDR_ISSUES_DIR)
    return { root, file: path.resolve(/* turbopackIgnore: true */ root, derivedPath) }
  }
  if (!derivedPath.startsWith("issues/")) throw new Error("Catalogue issue path is outside issues/")
  const root = path.join(process.cwd(), ".generated", "issues")
  return {
    root,
    file: path.resolve(/* turbopackIgnore: true */ root, derivedPath.slice("issues/".length)),
  }
}

export function getIssue(sectorSlug: string, date: string): IssueDocument | undefined {
  const catalogue = getArchiveCatalogue()
  const entry = findCatalogueIssue(sectorSlug, date)
  if (!entry) return undefined
  const { root, file } = resolveIssueFile(entry.derived_path)
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Catalogue issue path escapes the synchronized dataset")
  let issue: IssueDocument
  try {
    issue = JSON.parse(readFileSync(file, "utf8")) as IssueDocument
  } catch (error) {
    throw new Error(
      `Real TLDR archive data is unavailable (issue ${entry.issue_id}). Run \`npm run data:sync\`.`,
      { cause: error },
    )
  }
  if (
    issue.issue_id !== entry.issue_id ||
    issue.sector_slug !== entry.sector_slug ||
    issue.date !== entry.date ||
    issue.schema_version !== catalogue.schema_version ||
    issue.generator_version !== catalogue.generator_version
  ) {
    throw new Error(`Issue ${entry.issue_id} does not match archive catalogue source ${catalogue.resolved_source_commit}`)
  }
  return issue
}
