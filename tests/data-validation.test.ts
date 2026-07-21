import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  generateFrontendArtifacts,
  validateGeneratedDataset,
} from "../scripts/tldr-data-lib.mjs"
import { makeIssue, representativeIssues, writeDataset } from "./helpers/dataset"

let temporary: string
let generated: string

beforeEach(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "tldr-data-test-"))
  generated = path.join(temporary, "generated")
})
afterEach(async () => {
  await rm(temporary, { recursive: true, force: true })
})

describe("source synchronization validation", () => {
  it("accepts a valid temporary source dataset", async () => {
    await writeDataset(generated, representativeIssues())
    const result = await validateGeneratedDataset(generated)
    expect(result.issueCount).toBe(3)
    expect(result.articleCount).toBe(6)
  })

  it("rejects a missing manifest", async () => {
    await mkdir(generated)
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("manifest.json")
  })

  it("rejects malformed manifest JSON", async () => {
    await mkdir(generated)
    await writeFile(path.join(generated, "manifest.json"), "{")
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("not valid JSON")
  })

  it("rejects an unsupported schema version", async () => {
    const manifest = await writeDataset(generated, [makeIssue()])
    manifest.schema_version = "2.0.0"
    await writeFile(path.join(generated, "manifest.json"), JSON.stringify(manifest))
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("unsupported manifest schema_version")
  })

  it("rejects a missing derived issue file", async () => {
    const manifest = await writeDataset(generated, [makeIssue()])
    await unlink(path.join(generated, manifest.issues[0].derived_path))
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("missing derived issue file")
  })

  it("rejects malformed issue JSON", async () => {
    const manifest = await writeDataset(generated, [makeIssue()])
    await writeFile(path.join(generated, manifest.issues[0].derived_path), "{")
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("not valid JSON")
  })

  it("rejects duplicate issue IDs", async () => {
    const issue = makeIssue()
    await writeDataset(generated, [issue, issue])
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("duplicate manifest issue_id")
  })

  it("rejects duplicate source paths", async () => {
    const first = makeIssue()
    const second = makeIssue({ date: "2026-07-18" })
    second.source_path = first.source_path
    await writeDataset(generated, [first, second])
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("duplicate manifest source_path")
  })

  it("rejects duplicate derived paths", async () => {
    const manifest = await writeDataset(generated, [
      makeIssue(),
      makeIssue({ date: "2026-07-18" }),
    ])
    manifest.issues[1].derived_path = manifest.issues[0].derived_path
    await writeFile(path.join(generated, "manifest.json"), JSON.stringify(manifest))
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("duplicate manifest derived_path")
  })

  it("rejects derived path traversal", async () => {
    const manifest = await writeDataset(generated, [makeIssue()])
    manifest.issues[0].derived_path = "../outside.json"
    await writeFile(path.join(generated, "manifest.json"), JSON.stringify(manifest))
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("escapes its allowed root")
  })

  it("rejects issue file count mismatches and stale files", async () => {
    await writeDataset(generated, [makeIssue()])
    const extra = path.join(generated, "issues", "tldr-ai", "2026", "extra.json")
    await writeFile(extra, "{}")
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("issue file count")
  })

  it("rejects unwanted GoDaddy output", async () => {
    await writeDataset(generated, [makeIssue()])
    await writeFile(path.join(generated, "GoDaddy-output.json"), "{}")
    await expect(validateGeneratedDataset(generated)).rejects.toThrow("GoDaddy")
  })

  it("records immutable source SHA metadata", async () => {
    await writeDataset(generated, representativeIssues())
    const output = path.join(temporary, "artifacts")
    const result = await generateFrontendArtifacts({
      generatedDir: generated,
      outputDir: output,
      sourceRepository: "owner/source",
      requestedRef: "main",
      resolvedSourceCommit: "a".repeat(40),
      sourceMode: "local",
    })
    expect(result.metadata.resolved_source_commit).toBe("a".repeat(40))
    expect(result.catalogue.resolved_source_commit).toBe(result.metadata.resolved_source_commit)
    expect(result.searchMetadata.resolved_source_commit).toBe(result.metadata.resolved_source_commit)
    expect(result.dailyMetadata.resolved_source_commit).toBe(result.metadata.resolved_source_commit)
  })
})
