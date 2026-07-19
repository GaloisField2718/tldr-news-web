import { createHash } from "node:crypto"
import { gzipSync } from "node:zlib"
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

export const SUPPORTED_SCHEMA_VERSION = "1.0.0"
export const PARSE_STATUSES = new Set(["complete", "partial", "failed"])
export const FORMAT_FAMILIES = new Set(["links_block", "inline_url", "unknown"])
export const CONTENT_TYPES = new Set([
  "editorial",
  "sponsor",
  "github_repo",
  "course",
  "tool",
])

export const CANONICAL_SECTORS = [
  ["TLDR", "tldr"],
  ["TLDR AI", "tldr-ai"],
  ["TLDR Crypto", "tldr-crypto"],
  ["TLDR Marketing", "tldr-marketing"],
  ["TLDR Design", "tldr-design"],
  ["TLDR Web Dev", "tldr-web-dev"],
  ["TLDR InfoSec", "tldr-infosec"],
  ["TLDR Founders", "tldr-founders"],
  ["TLDR Product", "tldr-product"],
  ["TLDR Dev", "tldr-dev"],
  ["TLDR Cybersecurity", "tldr-cybersecurity"],
]

function fail(message) {
  throw new Error(`TLDR data validation failed: ${message}`)
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`)
}

function string(value, label, { empty = false } = {}) {
  if (typeof value !== "string" || (!empty && value.length === 0)) fail(`${label} must be a${empty ? "" : " non-empty"} string`)
}

function nullableString(value, label) {
  if (value !== null && typeof value !== "string") fail(`${label} must be a string or null`)
}

function integer(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return
  if (!Number.isInteger(value)) fail(`${label} must be an integer${nullable ? " or null" : ""}`)
}

function relativePath(value, label) {
  string(value, label)
  if (value.includes("\\") || path.posix.isAbsolute(value)) fail(`${label} must be a relative POSIX path`)
  const normalized = path.posix.normalize(value)
  if (normalized !== value || normalized.startsWith("../") || normalized === "..") {
    fail(`${label} escapes its allowed root: ${value}`)
  }
}

function validDate(value, label) {
  string(value, label)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${label} must use YYYY-MM-DD`)
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) fail(`${label} is not a real date`)
}

async function parseJson(file, label) {
  let text
  try {
    text = await readFile(file, "utf8")
  } catch (error) {
    fail(`${label} cannot be read: ${error.message}`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`)
  }
}

async function walk(root) {
  const files = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(full)
      else if (entry.isFile()) files.push(full)
      else fail(`unsupported filesystem entry: ${full}`)
    }
  }
  try {
    await visit(root)
  } catch (error) {
    if (error.code === "ENOENT") return []
    throw error
  }
  return files.sort()
}

function validateWarning(warning, label) {
  object(warning, label)
  string(warning.code, `${label}.code`)
  string(warning.message, `${label}.message`)
  if (warning.line !== null) integer(warning.line, `${label}.line`)
}

function validateArticle(article, label) {
  object(article, label)
  string(article.id, `${label}.id`)
  integer(article.order, `${label}.order`)
  if (article.order < 1) fail(`${label}.order must be positive`)
  string(article.title, `${label}.title`, { empty: true })
  string(article.summary, `${label}.summary`, { empty: true })
  nullableString(article.url, `${label}.url`)
  integer(article.reading_time_minutes, `${label}.reading_time_minutes`, { nullable: true })
  nullableString(article.source_domain, `${label}.source_domain`)
  if (!CONTENT_TYPES.has(article.content_type)) fail(`${label}.content_type is unsupported: ${article.content_type}`)
  if (typeof article.is_sponsor !== "boolean") fail(`${label}.is_sponsor must be boolean`)
}

function validateIssue(issue, entry, label) {
  object(issue, label)
  for (const field of [
    "schema_version",
    "generator_version",
    "issue_id",
    "sector",
    "sector_slug",
    "date",
    "source_path",
    "source_content_hash",
    "format_family",
    "parse_status",
    "title",
  ]) string(issue[field], `${label}.${field}`, { empty: field === "title" })
  if (issue.schema_version !== SUPPORTED_SCHEMA_VERSION) fail(`${label} uses unsupported schema_version ${issue.schema_version}`)
  if (!FORMAT_FAMILIES.has(issue.format_family)) fail(`${label}.format_family is unsupported: ${issue.format_family}`)
  if (!PARSE_STATUSES.has(issue.parse_status)) fail(`${label}.parse_status is unsupported: ${issue.parse_status}`)
  if (!/^tldr(?:-[a-z0-9]+)*$/.test(issue.sector_slug)) fail(`${label}.sector_slug is invalid`)
  validDate(issue.date, `${label}.date`)
  relativePath(issue.source_path, `${label}.source_path`)
  if (!/^sha256:[a-f0-9]{64}$/.test(issue.source_content_hash)) fail(`${label}.source_content_hash is invalid`)
  if (issue.issue_id !== `${issue.sector_slug}:${issue.date}`) fail(`${label}.issue_id does not match sector/date`)
  if (!Array.isArray(issue.parse_warnings)) fail(`${label}.parse_warnings must be an array`)
  issue.parse_warnings.forEach((warning, index) => validateWarning(warning, `${label}.parse_warnings[${index}]`))
  if (!Array.isArray(issue.sections)) fail(`${label}.sections must be an array`)
  issue.sections.forEach((section, sectionIndex) => {
    const sectionLabel = `${label}.sections[${sectionIndex}]`
    object(section, sectionLabel)
    string(section.id, `${sectionLabel}.id`)
    string(section.heading, `${sectionLabel}.heading`, { empty: true })
    integer(section.order, `${sectionLabel}.order`)
    if (section.order < 1) fail(`${sectionLabel}.order must be positive`)
    if (!Array.isArray(section.articles)) fail(`${sectionLabel}.articles must be an array`)
    section.articles.forEach((article, articleIndex) => validateArticle(article, `${sectionLabel}.articles[${articleIndex}]`))
  })

  for (const field of [
    "schema_version",
    "generator_version",
    "issue_id",
    "sector",
    "sector_slug",
    "date",
    "source_path",
    "source_content_hash",
    "format_family",
    "parse_status",
  ]) {
    if (issue[field] !== entry[field]) fail(`${label}.${field} does not match its manifest entry`)
  }
}

export async function validateGeneratedDataset(generatedDir) {
  const root = path.resolve(generatedDir)
  const manifestPath = path.join(root, "manifest.json")
  let manifest
  try {
    manifest = await parseJson(manifestPath, "generated/manifest.json")
  } catch (error) {
    if (error.message.includes("ENOENT")) fail("missing generated/manifest.json")
    throw error
  }
  object(manifest, "manifest")
  if (manifest.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    fail(`unsupported manifest schema_version ${manifest.schema_version}`)
  }
  string(manifest.generator_version, "manifest.generator_version")
  if (!Array.isArray(manifest.issues)) fail("manifest.issues must be an array")

  const allFiles = await walk(root)
  for (const file of allFiles) {
    const relative = path.relative(root, file).split(path.sep).join("/")
    if (/godaddy/i.test(relative)) fail(`unexpected GoDaddy output: ${relative}`)
  }
  const issueFiles = allFiles.filter((file) => {
    const relative = path.relative(root, file).split(path.sep).join("/")
    return relative.startsWith("issues/")
  })
  for (const file of issueFiles) {
    if (!file.endsWith(".json")) fail(`unexpected non-JSON or temporary issue file: ${path.relative(root, file)}`)
  }
  const issueIds = new Set()
  const sourcePaths = new Set()
  const derivedPaths = new Set()
  const documents = []
  let articleCount = 0

  for (const [index, entry] of manifest.issues.entries()) {
    const label = `manifest.issues[${index}]`
    object(entry, label)
    for (const field of [
      "issue_id",
      "sector",
      "sector_slug",
      "date",
      "source_path",
      "source_content_hash",
      "schema_version",
      "generator_version",
      "format_family",
      "parse_status",
      "derived_path",
    ]) string(entry[field], `${label}.${field}`)
    if (entry.schema_version !== SUPPORTED_SCHEMA_VERSION) fail(`${label} uses unsupported schema_version ${entry.schema_version}`)
    if (entry.generator_version !== manifest.generator_version) fail(`${label}.generator_version does not match manifest`)
    if (!FORMAT_FAMILIES.has(entry.format_family)) fail(`${label}.format_family is unsupported`)
    if (!PARSE_STATUSES.has(entry.parse_status)) fail(`${label}.parse_status is unsupported`)
    if (!/^tldr(?:-[a-z0-9]+)*$/.test(entry.sector_slug)) fail(`${label}.sector_slug is invalid`)
    validDate(entry.date, `${label}.date`)
    relativePath(entry.source_path, `${label}.source_path`)
    relativePath(entry.derived_path, `${label}.derived_path`)
    if (/godaddy/i.test(entry.source_path)) fail(`unexpected GoDaddy source path: ${entry.source_path}`)
    for (const [set, value, name] of [
      [issueIds, entry.issue_id, "issue_id"],
      [sourcePaths, entry.source_path, "source_path"],
      [derivedPaths, entry.derived_path, "derived_path"],
    ]) {
      if (set.has(value)) fail(`duplicate manifest ${name}: ${value}`)
      set.add(value)
    }
    if (entry.issue_id !== `${entry.sector_slug}:${entry.date}`) fail(`${label}.issue_id does not match sector/date`)
    const expectedPath = `issues/${entry.sector_slug}/${entry.date.slice(0, 4)}/${entry.date}.json`
    if (entry.derived_path !== expectedPath) fail(`${label}.derived_path does not correspond to sector/date`)

    const file = path.resolve(root, entry.derived_path)
    if (file !== path.join(root, ...entry.derived_path.split("/"))) fail(`${label}.derived_path escapes generated/`)
    let fileStat
    try {
      fileStat = await stat(file)
    } catch (error) {
      if (error.code === "ENOENT") fail(`missing derived issue file: ${entry.derived_path}`)
      throw error
    }
    if (!fileStat.isFile()) fail(`derived issue is not a file: ${entry.derived_path}`)
    const issue = await parseJson(file, entry.derived_path)
    validateIssue(issue, entry, entry.derived_path)
    articleCount += issue.sections.reduce((sum, section) => sum + section.articles.length, 0)
    documents.push({ entry, issue })
  }

  if (issueFiles.length !== manifest.issues.length) {
    fail(`issue file count (${issueFiles.length}) does not equal manifest entry count (${manifest.issues.length})`)
  }

  return {
    manifest,
    documents,
    issueCount: documents.length,
    articleCount,
  }
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

export async function generateFrontendArtifacts({
  generatedDir,
  outputDir,
  sourceRepository,
  requestedRef,
  resolvedSourceCommit,
  sourceMode = "remote",
}) {
  const validated = await validateGeneratedDataset(generatedDir)
  if (!/^[a-f0-9]{40}$/.test(resolvedSourceCommit)) fail("resolved source commit must be an immutable 40-character Git SHA")

  const output = path.resolve(outputDir)
  const temporary = `${output}.tmp-${process.pid}`
  await rm(temporary, { recursive: true, force: true })
  await mkdir(path.join(temporary, "search"), { recursive: true })

  const metadata = {
    source_repository: sourceRepository,
    requested_ref: requestedRef,
    resolved_source_commit: resolvedSourceCommit,
    source_mode: sourceMode,
    schema_version: validated.manifest.schema_version,
    generator_version: validated.manifest.generator_version,
    issue_count: validated.issueCount,
    article_count: validated.articleCount,
  }

  const entries = []
  const searchByYear = new Map()
  const sectorValues = new Map()
  for (const { entry, issue } of validated.documents) {
    const sectionCount = issue.sections.length
    const issueArticleCount = issue.sections.reduce((sum, section) => sum + section.articles.length, 0)
    entries.push({
      issue_id: entry.issue_id,
      sector: entry.sector,
      sector_slug: entry.sector_slug,
      date: entry.date,
      title: issue.title,
      parse_status: entry.parse_status,
      format_family: entry.format_family,
      section_count: sectionCount,
      article_count: issueArticleCount,
      derived_path: entry.derived_path,
    })
    sectorValues.set(entry.sector_slug, entry.sector)
    const year = entry.date.slice(0, 4)
    if (!searchByYear.has(year)) searchByYear.set(year, [])
    const searchDocuments = searchByYear.get(year)
    for (const section of issue.sections) {
      for (const article of section.articles) {
        searchDocuments.push({
          id: article.id,
          title: article.title,
          summary: article.summary,
          url: article.url,
          source_domain: article.source_domain,
          reading_time_minutes: article.reading_time_minutes,
          content_type: article.content_type,
          is_sponsor: article.is_sponsor,
          issue_id: entry.issue_id,
          issue_date: entry.date,
          sector: entry.sector,
          sector_slug: entry.sector_slug,
          issue_route: `/issues/${entry.sector_slug}/${entry.date}`,
          section_heading: section.heading,
        })
      }
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || a.sector_slug.localeCompare(b.sector_slug))

  const counts = new Map()
  for (const entry of entries) counts.set(entry.sector_slug, (counts.get(entry.sector_slug) ?? 0) + 1)
  const known = new Set(CANONICAL_SECTORS.map(([, slug]) => slug))
  const sectors = CANONICAL_SECTORS.map(([sector, sector_slug]) => ({
    sector: sectorValues.get(sector_slug) ?? sector,
    sector_slug,
    issue_count: counts.get(sector_slug) ?? 0,
  }))
  for (const [sector_slug, sector] of [...sectorValues].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!known.has(sector_slug)) sectors.push({ sector, sector_slug, issue_count: counts.get(sector_slug) ?? 0 })
  }
  const years = [...new Set(entries.map((entry) => Number(entry.date.slice(0, 4))))].sort((a, b) => b - a)
  const catalogue = { ...metadata, total_issues: entries.length, sectors, years, issues: entries }
  await writeJson(path.join(temporary, "archive-metadata.json"), metadata)
  await writeJson(path.join(temporary, "archive-catalogue.json"), catalogue)
  await cp(path.join(path.resolve(generatedDir), "issues"), path.join(temporary, "issues"), {
    recursive: true,
  })

  const segments = []
  for (const year of [...searchByYear.keys()].sort((a, b) => b.localeCompare(a))) {
    const documents = searchByYear.get(year)
    const uncompressed = Buffer.from(JSON.stringify(documents))
    const compressed = gzipSync(uncompressed, { level: 9, mtime: 0 })
    const filename = `${year}.json.gz`
    await writeFile(path.join(temporary, "search", filename), compressed)
    segments.push({
      year: Number(year),
      file: filename,
      document_count: documents.length,
      searchable_count: documents.filter((document) => document.title || document.summary).length,
      uncompressed_bytes: uncompressed.length,
      gzip_bytes: compressed.length,
      sha256: createHash("sha256").update(compressed).digest("hex"),
    })
  }
  const searchMetadata = {
    resolved_source_commit: resolvedSourceCommit,
    article_count: validated.articleCount,
    searchable_count: segments.reduce((sum, segment) => sum + segment.searchable_count, 0),
    uncompressed_bytes: segments.reduce((sum, segment) => sum + segment.uncompressed_bytes, 0),
    gzip_bytes: segments.reduce((sum, segment) => sum + segment.gzip_bytes, 0),
    segments,
  }
  await writeJson(path.join(temporary, "search-metadata.json"), searchMetadata)

  await rm(output, { recursive: true, force: true })
  await rename(temporary, output)
  return { metadata, catalogue, searchMetadata }
}

export async function copyGeneratedDataset(source, destination) {
  await rm(destination, { recursive: true, force: true })
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false })
}

export async function assertFrontendArtifacts({ generatedDir, outputDir }) {
  const validated = await validateGeneratedDataset(generatedDir)
  const metadata = await parseJson(path.join(outputDir, "archive-metadata.json"), "archive-metadata.json")
  const catalogue = await parseJson(path.join(outputDir, "archive-catalogue.json"), "archive-catalogue.json")
  const searchMetadata = await parseJson(path.join(outputDir, "search-metadata.json"), "search-metadata.json")
  const sha = metadata.resolved_source_commit
  if (!/^[a-f0-9]{40}$/.test(sha)) fail("archive metadata has no immutable source SHA")
  if (catalogue.resolved_source_commit !== sha || searchMetadata.resolved_source_commit !== sha) fail("source SHA differs across generated artifacts")
  if (metadata.issue_count !== validated.issueCount || catalogue.total_issues !== validated.issueCount) fail("generated issue counts are inconsistent")
  if (metadata.article_count !== validated.articleCount || searchMetadata.article_count !== validated.articleCount) fail("generated article counts are inconsistent")
  for (const segment of searchMetadata.segments) {
    const file = path.join(outputDir, "search", segment.file)
    const bytes = await readFile(file)
    if (createHash("sha256").update(bytes).digest("hex") !== segment.sha256) fail(`search segment checksum mismatch: ${segment.file}`)
  }
  return { metadata, catalogue, searchMetadata }
}
