#!/usr/bin/env node

import { execFile } from "node:child_process"
import { mkdir, readdir, rename, rm } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import {
  copyGeneratedDataset,
  generateFrontendArtifacts,
  validateGeneratedDataset,
} from "./tldr-data-lib.mjs"

const exec = promisify(execFile)
const projectRoot = path.resolve(import.meta.dirname, "..")
const cacheRoot = path.join(projectRoot, ".cache", "tldr-data")
const outputDir = path.join(projectRoot, ".generated")
const sourceRepository = process.env.TLDR_DATA_REPO || "GaloisField2718/tldr_news"
const requestedRef = process.env.TLDR_DATA_REF || (process.env.VERCEL_GIT_COMMIT_REF === "feat/bilingual-podcast" ? "feat/daily-podcast-mvp" : "main")
const localPath = process.env.TLDR_DATA_LOCAL_PATH

function normalizeRepository(value) {
  const match = value.match(/^(?:https:\/\/github\.com\/|git@github\.com:)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/)
  if (!match) throw new Error(`TLDR_DATA_REPO must identify a public GitHub owner/repository: ${value}`)
  return match[1]
}

function validateRef(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) || value.includes("..")) {
    throw new Error(`TLDR_DATA_REF is not a safe Git ref: ${value}`)
  }
}

async function runGit(args, options = {}) {
  try {
    return await exec("git", args, { maxBuffer: 10 * 1024 * 1024, ...options })
  } catch (error) {
    const detail = error.stderr?.trim() || error.message
    throw new Error(`public source Git operation failed: git ${args.join(" ")}\n${detail}`)
  }
}

async function cleanStaleSyncState() {
  await mkdir(cacheRoot, { recursive: true })
  for (const entry of await readdir(cacheRoot, { withFileTypes: true })) {
    if (entry.name.startsWith(".sync-") && entry.isDirectory()) {
      await rm(path.join(cacheRoot, entry.name), { recursive: true, force: true })
    }
  }
  for (const entry of await readdir(projectRoot, { withFileTypes: true })) {
    if (entry.name.startsWith(".generated.tmp-") && entry.isDirectory()) {
      await rm(path.join(projectRoot, entry.name), { recursive: true, force: true })
    }
  }
}

async function resolveLocalCommit(generatedPath) {
  if (process.env.TLDR_DATA_LOCAL_SHA) {
    const sha = process.env.TLDR_DATA_LOCAL_SHA.toLowerCase()
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("TLDR_DATA_LOCAL_SHA must be a 40-character Git commit SHA")
    return sha
  }
  try {
    const { stdout } = await runGit(["-C", generatedPath, "rev-parse", "HEAD"])
    const sha = stdout.trim().toLowerCase()
    if (/^[a-f0-9]{40}$/.test(sha)) return sha
  } catch {
    // The explicit error below explains how non-repository fixtures can opt in.
  }
  throw new Error("TLDR_DATA_LOCAL_PATH must be inside a Git checkout, or TLDR_DATA_LOCAL_SHA must provide its immutable source commit")
}

async function synchronizeLocal() {
  const source = path.resolve(localPath)
  const generatedPath = path.basename(source) === "generated" ? source : path.join(source, "generated")
  const resolvedSourceCommit = await resolveLocalCommit(generatedPath)
  const cacheDir = path.join(cacheRoot, resolvedSourceCommit)
  const cachedGenerated = path.join(cacheDir, "generated")
  await validateGeneratedDataset(generatedPath)
  await rm(cacheDir, { recursive: true, force: true })
  await copyGeneratedDataset(generatedPath, cachedGenerated)
  return { resolvedSourceCommit, cachedGenerated, sourceMode: "local" }
}

async function synchronizeRemote(repository) {
  validateRef(requestedRef)
  const temporary = path.join(cacheRoot, `.sync-${process.pid}-${Date.now()}`)
  const checkout = path.join(temporary, "repo")
  await mkdir(checkout, { recursive: true })
  try {
    await runGit(["init", "--quiet", checkout])
    await runGit(["-C", checkout, "remote", "add", "origin", `https://github.com/${repository}.git`])
    await runGit(["-C", checkout, "sparse-checkout", "set", "generated"])
    await runGit(["-C", checkout, "fetch", "--quiet", "--depth=1", "--filter=blob:none", "origin", requestedRef])
    const { stdout } = await runGit(["-C", checkout, "rev-parse", "FETCH_HEAD"])
    const resolvedSourceCommit = stdout.trim().toLowerCase()
    if (!/^[a-f0-9]{40}$/.test(resolvedSourceCommit)) throw new Error("source ref did not resolve to an immutable Git commit SHA")
    const cacheDir = path.join(cacheRoot, resolvedSourceCommit)
    const cachedGenerated = path.join(cacheDir, "generated")

    try {
      await validateGeneratedDataset(cachedGenerated)
      return { resolvedSourceCommit, cachedGenerated, sourceMode: "remote", cacheHit: true }
    } catch {
      await rm(cacheDir, { recursive: true, force: true })
    }

    await runGit(["-C", checkout, "checkout", "--quiet", "--detach", resolvedSourceCommit])
    await validateGeneratedDataset(path.join(checkout, "generated"))
    await mkdir(cacheDir, { recursive: true })
    await rename(path.join(checkout, "generated"), cachedGenerated)
    return { resolvedSourceCommit, cachedGenerated, sourceMode: "remote", cacheHit: false }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function main() {
  await cleanStaleSyncState()
  const repository = normalizeRepository(sourceRepository)
  const synchronized = localPath
    ? await synchronizeLocal()
    : await synchronizeRemote(repository)
  const artifacts = await generateFrontendArtifacts({
    generatedDir: synchronized.cachedGenerated,
    outputDir,
    sourceRepository: repository,
    requestedRef,
    resolvedSourceCommit: synchronized.resolvedSourceCommit,
    sourceMode: synchronized.sourceMode,
  })
  console.log(JSON.stringify({
    ok: true,
    requested_ref: requestedRef,
    resolved_source_commit: synchronized.resolvedSourceCommit,
    cache: path.relative(projectRoot, path.dirname(synchronized.cachedGenerated)),
    ...artifacts.metadata,
    cache_hit: synchronized.cacheHit ?? false,
    search_uncompressed_bytes: artifacts.searchMetadata.uncompressed_bytes,
    search_gzip_bytes: artifacts.searchMetadata.gzip_bytes,
    daily_edition_count: artifacts.dailyMetadata.edition_count,
    daily_unique_article_count: artifacts.dailyMetadata.unique_article_count,
    daily_uncompressed_bytes: artifacts.dailyMetadata.uncompressed_bytes,
    daily_gzip_bytes: artifacts.dailyMetadata.gzip_bytes,
  }, null, 2))
}

main().catch((error) => {
  console.error(`data:sync failed\n${error.stack || error.message}`)
  process.exitCode = 1
})
