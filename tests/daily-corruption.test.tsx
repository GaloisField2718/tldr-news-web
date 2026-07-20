import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import DailyIndexPage from "@/app/daily/page"
import { getDailyEdition, getLatestDailyDate } from "@/lib/daily"
import { generateFrontendArtifacts } from "../scripts/tldr-data-lib.mjs"
import { makeIssue, writeDataset } from "./helpers/dataset"
import type { IssueDocument } from "@/lib/types"

let temporary: string

afterEach(async () => {
  delete process.env.TLDR_GENERATED_DIR
  delete process.env.TLDR_ISSUES_DIR
  await rm(temporary, { recursive: true, force: true })
})

async function prepare(issues: IssueDocument[]): Promise<string> {
  temporary = await mkdtemp(path.join(os.tmpdir(), "daily-corruption-"))
  const generated = path.join(temporary, "generated")
  const output = path.join(temporary, "artifacts")
  await writeDataset(generated, issues)
  await generateFrontendArtifacts({
    generatedDir: generated,
    outputDir: output,
    sourceRepository: "owner/source",
    requestedRef: "test",
    resolvedSourceCommit: "e".repeat(40),
    sourceMode: "local",
  })
  process.env.TLDR_GENERATED_DIR = output
  process.env.TLDR_ISSUES_DIR = generated
  return output
}

describe("Daily operational corruption stays loud", () => {
  it("renders the unavailable page only for a valid corpus with no readable edition", async () => {
    await prepare([makeIssue({ parseStatus: "failed", articles: [] })])
    expect(getLatestDailyDate()).toBeUndefined()
    const html = renderToStaticMarkup(<DailyIndexPage />)
    expect(html).toContain("The Daily Index is unavailable")
  })

  it("throws from /daily when Daily metadata disagrees with the archive source SHA", async () => {
    const output = await prepare([makeIssue()])
    const metadataFile = path.join(output, "daily-metadata.json")
    const metadata = JSON.parse(await readFile(metadataFile, "utf8"))
    metadata.resolved_source_commit = "f".repeat(40)
    await writeFile(metadataFile, JSON.stringify(metadata))
    expect(() => DailyIndexPage()).toThrow(/source commits/)
  })

  it("throws from /daily when Daily metadata is unreadable", async () => {
    const output = await prepare([makeIssue()])
    await writeFile(path.join(output, "daily-metadata.json"), "not json")
    expect(() => DailyIndexPage()).toThrow(/Daily metadata/)
  })

  it("rejects a tampered edition file at read time via its checksum", async () => {
    const output = await prepare([makeIssue({ date: "2026-09-02" })])
    const file = path.join(output, "daily", "2026-09-02.json.gz")
    const bytes = await readFile(file)
    await writeFile(file, bytes.subarray(0, Math.floor(bytes.length / 2)))
    expect(() => getDailyEdition("2026-09-02")).toThrow(/checksum mismatch/)
  })
})
