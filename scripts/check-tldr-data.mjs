#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import path from "node:path"
import { assertFrontendArtifacts } from "./tldr-data-lib.mjs"

const projectRoot = path.resolve(import.meta.dirname, "..")

async function main() {
  const metadata = JSON.parse(await readFile(path.join(projectRoot, ".generated", "archive-metadata.json"), "utf8"))
  const generatedDir = path.join(projectRoot, ".cache", "tldr-data", metadata.resolved_source_commit, "generated")
  const checked = await assertFrontendArtifacts({
    generatedDir,
    outputDir: path.join(projectRoot, ".generated"),
  })
  console.log(JSON.stringify({
    ok: true,
    resolved_source_commit: checked.metadata.resolved_source_commit,
    issue_count: checked.metadata.issue_count,
    article_count: checked.metadata.article_count,
  }))
}

main().catch((error) => {
  console.error(`data:check failed\n${error.stack || error.message}`)
  process.exitCode = 1
})
