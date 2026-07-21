import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync, gzipSync } from "node:zlib"

export const DAILY_SECTOR_ORDER = [
  "tldr",
  "tldr-ai",
  "tldr-dev",
  "tldr-web-dev",
  "tldr-infosec",
  "tldr-cybersecurity",
  "tldr-crypto",
  "tldr-product",
  "tldr-design",
  "tldr-founders",
  "tldr-marketing",
]

const TRACKING_PARAMETERS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "mc_cid",
  "mc_eid",
])
const RESOURCE_TYPES = new Set(["github_repo", "course", "tool"])
const DAILY_FILE = /^\d{4}-\d{2}-\d{2}\.json\.gz$/

export function presentationClass(article) {
  if (article.is_sponsor || article.content_type === "sponsor") return "sponsor"
  return RESOURCE_TYPES.has(article.content_type) ? "resource" : "editorial"
}

const PRESENTATION_CLASS_RANK = { editorial: 0, resource: 1, sponsor: 2 }

function sectorRank(slug) {
  const index = DAILY_SECTOR_ORDER.indexOf(slug)
  return index === -1 ? DAILY_SECTOR_ORDER.length : index
}

function occurrenceCompare(a, b) {
  return (
    sectorRank(a.sector_slug) - sectorRank(b.sector_slug) ||
    (sectorRank(a.sector_slug) === DAILY_SECTOR_ORDER.length
      ? a.sector_slug.localeCompare(b.sector_slug)
      : 0) ||
    a.section_order - b.section_order ||
    a.article_order - b.article_order ||
    a.issue_id.localeCompare(b.issue_id) ||
    a.article_id.localeCompare(b.article_id)
  )
}

export function canonicalizeDailyUrl(value) {
  if (typeof value !== "string" || value.length === 0) return null
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  parsed.hostname = parsed.hostname.toLowerCase()
  parsed.hash = ""
  const parameters = []
  for (const [name, parameterValue] of parsed.searchParams) {
    if (!TRACKING_PARAMETERS.has(name.toLowerCase())) parameters.push([name, parameterValue])
  }
  parameters.sort(([aName, aValue], [bName, bValue]) =>
    aName.localeCompare(bName) || aValue.localeCompare(bValue),
  )
  parsed.search = ""
  for (const [name, parameterValue] of parameters) parsed.searchParams.append(name, parameterValue)
  return parsed.toString()
}

export function dailyArticleKey(issueId, articleId) {
  return createHash("sha256").update(`${issueId}\0${articleId}`).digest("hex")
}

function toOccurrence(issue, section, article, articleKey) {
  return {
    article_key: articleKey,
    article_id: article.id,
    issue_id: issue.issue_id,
    issue_title: issue.title,
    issue_route: `/issues/${issue.sector_slug}/${issue.date}`,
    issue_parse_status: issue.parse_status,
    sector: issue.sector,
    sector_slug: issue.sector_slug,
    section_id: section.id,
    section_heading: section.heading,
    section_order: section.order,
    article_order: article.order,
    content_type: article.content_type,
    is_sponsor: article.is_sponsor,
  }
}

function toArticle(issue, section, source, key, canonicalUrl, occurrences) {
  return {
    article_key: key,
    id: source.id,
    issue_id: issue.issue_id,
    issue_title: issue.title,
    issue_route: `/issues/${issue.sector_slug}/${issue.date}`,
    issue_parse_status: issue.parse_status,
    date: issue.date,
    sector: issue.sector,
    sector_slug: issue.sector_slug,
    section_id: section.id,
    section_heading: section.heading,
    section_order: section.order,
    article_order: source.order,
    title: source.title,
    summary: source.summary,
    url: source.url,
    canonical_url: canonicalUrl,
    source_domain: source.source_domain,
    reading_time_minutes: source.reading_time_minutes,
    content_type: source.content_type,
    is_sponsor: source.is_sponsor,
    occurrences,
  }
}

function frontPageEligible(article) {
  return article.title.trim().length > 0 && article.summary.trim().length > 0
}

function selectFrontPage(editorial) {
  if (editorial.length === 0) return []
  const eligible = editorial.filter(frontPageEligible)
  // Incomplete entries remain in the interior pool whenever any complete
  // editorial selection exists. They are a deterministic last fallback only
  // for dates on which no editorial entry has both a title and summary.
  const candidates = eligible.length > 0 ? eligible : editorial
  const lead = candidates.find((article) => article.sector_slug === "tldr") ?? candidates[0]
  const remaining = candidates.filter((article) => article.article_key !== lead.article_key)
  const selected = [lead]
  const sectors = new Set([lead.sector_slug])
  // Four secondary positions prefer distinct sectors before normal filling.
  for (const article of remaining) {
    if (selected.length >= 5) break
    if (!sectors.has(article.sector_slug)) {
      selected.push(article)
      sectors.add(article.sector_slug)
    }
  }
  for (const article of remaining) {
    if (selected.length >= 9) break
    if (!selected.some((selectedArticle) => selectedArticle.article_key === article.article_key)) {
      selected.push(article)
    }
  }
  return selected
}

export function balancedChunks(items, maxCapacity = 15) {
  if (!Number.isInteger(maxCapacity) || maxCapacity < 1) throw new Error("Daily page capacity must be a positive integer")
  if (items.length === 0) return []
  const pageCount = Math.ceil(items.length / maxCapacity)
  const baseSize = Math.floor(items.length / pageCount)
  const largerPages = items.length % pageCount
  const chunks = []
  let offset = 0
  for (let index = 0; index < pageCount; index += 1) {
    const size = baseSize + (index < largerPages ? 1 : 0)
    chunks.push(items.slice(offset, offset + size))
    offset += size
  }
  return chunks
}

function pageSlots(articles, firstRole = "lead") {
  return articles.map((article, index) => ({
    role: index === 0 ? firstRole : index < 6 ? "standard" : "brief",
    article_key: article.article_key,
  }))
}

export function composeDailyEdition({ date, documents, resolvedSourceCommit, articleKeyFactory = dailyArticleKey }) {
  const sortedDocuments = [...documents].sort((a, b) =>
    occurrenceCompare(
      { sector_slug: a.issue.sector_slug, section_order: 0, article_order: 0, issue_id: a.issue.issue_id, article_id: "" },
      { sector_slug: b.issue.sector_slug, section_order: 0, article_order: 0, issue_id: b.issue.issue_id, article_id: "" },
    ),
  )
  const keys = new Map()
  const candidates = []
  const issues = []

  for (const { issue } of sortedDocuments) {
    const issueArticleCount = issue.sections.reduce((sum, section) => sum + section.articles.length, 0)
    issues.push({
      issue_id: issue.issue_id,
      title: issue.title,
      route: `/issues/${issue.sector_slug}/${issue.date}`,
      sector: issue.sector,
      sector_slug: issue.sector_slug,
      parse_status: issue.parse_status,
      article_count: issueArticleCount,
      available: issueArticleCount > 0,
    })
    for (const section of [...issue.sections].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
      for (const article of [...section.articles].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
        const key = articleKeyFactory(issue.issue_id, article.id)
        if (!/^[a-f0-9]{32,64}$/.test(key)) throw new Error(`Daily article key is not URL-safe: ${key}`)
        const pair = `${issue.issue_id}\0${article.id}`
        if (keys.has(key) && keys.get(key) !== pair) throw new Error(`Daily article key collision: ${key}`)
        keys.set(key, pair)
        const occurrence = toOccurrence(issue, section, article, key)
        candidates.push({ issue, section, article, key, occurrence, canonicalUrl: canonicalizeDailyUrl(article.url) })
      }
    }
  }

  // Repeated listings of the same source pair (identical issue and article ID,
  // e.g. one placement parsed into two sections) are one article and must not
  // split into two Daily articles sharing one key. Merge them first; if any
  // listing is sponsored, the merged article is sponsored, so paid placements
  // can never lose their label to a duplicate editorial listing.
  const byKey = new Map()
  for (const candidate of candidates) {
    if (!byKey.has(candidate.key)) byKey.set(candidate.key, [])
    byKey.get(candidate.key).push(candidate)
  }
  const mergedCandidates = []
  for (const listings of byKey.values()) {
    listings.sort(
      (a, b) =>
        PRESENTATION_CLASS_RANK[presentationClass(b.article)] -
          PRESENTATION_CLASS_RANK[presentationClass(a.article)] ||
        occurrenceCompare(a.occurrence, b.occurrence),
    )
    mergedCandidates.push({ ...listings[0], listings })
  }

  // Deduplication groups are scoped by presentation class in addition to the
  // canonical URL: a sponsored placement can never merge with editorial
  // coverage of the same URL, and resources never absorb editorial stories.
  const groups = new Map()
  for (const candidate of mergedCandidates) {
    const groupKey = candidate.canonicalUrl
      ? `${presentationClass(candidate.article)}|url:${candidate.canonicalUrl}`
      : `key:${candidate.key}`
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey).push(candidate)
  }

  const articles = []
  for (const group of groups.values()) {
    group.sort((a, b) => occurrenceCompare(a.occurrence, b.occurrence))
    const primary = group[0]
    const occurrences = group
      .flatMap((candidate) => candidate.listings.map((listing) => listing.occurrence))
      .sort(occurrenceCompare)
    articles.push(
      toArticle(
        primary.issue,
        primary.section,
        primary.article,
        primary.key,
        primary.canonicalUrl,
        occurrences,
      ),
    )
  }
  articles.sort((a, b) => occurrenceCompare({ ...a, article_id: a.id }, { ...b, article_id: b.id }))

  const pages = []
  const assigned = new Set()
  const editorial = articles.filter((article) => !article.is_sponsor && article.content_type === "editorial")
  const resources = articles.filter((article) => !article.is_sponsor && RESOURCE_TYPES.has(article.content_type))
  const sponsors = articles.filter((article) => article.is_sponsor || article.content_type === "sponsor")
  const frontArticles = selectFrontPage(editorial.length ? editorial : resources.slice(0, 1))
  if (frontArticles.length) {
    frontArticles.forEach((article) => assigned.add(article.article_key))
    pages.push({
      number: 1,
      template: "front-page",
      title: "Today’s Index",
      kicker: "Across today’s newsletters",
      sectors: [...new Set(frontArticles.map((article) => article.sector))],
      slots: frontArticles.map((article, index) => ({
        role: index === 0 ? "lead" : index < 5 ? "secondary" : "brief",
        article_key: article.article_key,
      })),
    })
  }

  const remainingEditorial = editorial.filter((article) => !assigned.has(article.article_key))
  const bySector = new Map()
  for (const article of remainingEditorial) {
    if (!bySector.has(article.sector_slug)) bySector.set(article.sector_slug, [])
    bySector.get(article.sector_slug).push(article)
  }
  for (const sectorArticles of bySector.values()) {
    for (const [continuation, chunk] of balancedChunks(sectorArticles).entries()) {
      chunk.forEach((article) => assigned.add(article.article_key))
      pages.push({
        number: pages.length + 1,
        template: continuation === 0 ? "section-lead" : "three-column",
        title: continuation === 0 ? chunk[0].sector : `${chunk[0].sector} — continued`,
        kicker: continuation === 0 ? chunk[0].section_heading : "Continued",
        sectors: [chunk[0].sector],
        slots: pageSlots(chunk, continuation === 0 ? "lead" : "standard"),
      })
    }
  }

  const remainingResources = resources.filter((article) => !assigned.has(article.article_key))
  for (let offset = 0; offset < remainingResources.length; offset += 18) {
    const chunk = remainingResources.slice(offset, offset + 18)
    chunk.forEach((article) => assigned.add(article.article_key))
    pages.push({
      number: pages.length + 1,
      template: "resources",
      title: offset === 0 ? "Resources & Tools" : "Resources & Tools — continued",
      kicker: "Repositories, courses and useful tools",
      sectors: [...new Set(chunk.map((article) => article.sector))],
      slots: chunk.map((article) => ({ role: "resource", article_key: article.article_key })),
    })
  }

  for (let offset = 0; offset < sponsors.length; offset += 18) {
    const chunk = sponsors.slice(offset, offset + 18)
    chunk.forEach((article) => assigned.add(article.article_key))
    pages.push({
      number: pages.length + 1,
      template: "sponsored",
      title: offset === 0 ? "Sponsored" : "Sponsored — continued",
      kicker: "Paid placements from today’s newsletters",
      sectors: [...new Set(chunk.map((article) => article.sector))],
      slots: chunk.map((article) => ({ role: "sponsor", article_key: article.article_key })),
    })
  }

  if (assigned.size !== articles.length || pages.flatMap((page) => page.slots).length !== articles.length) {
    throw new Error(`Daily edition ${date} does not assign every unique article exactly once`)
  }
  const articlePages = {}
  const articleOrder = []
  for (const page of pages) {
    for (const slot of page.slots) {
      if (articlePages[slot.article_key]) throw new Error(`Duplicate Daily page assignment: ${slot.article_key}`)
      articlePages[slot.article_key] = page.number
      articleOrder.push(slot.article_key)
    }
  }
  return {
    date,
    resolved_source_commit: resolvedSourceCommit,
    issues,
    pages,
    articles,
    article_pages: articlePages,
    article_order: articleOrder,
  }
}

export async function generateDailyArtifacts({ documents, outputDir, resolvedSourceCommit }) {
  const dailyDir = path.join(outputDir, "daily")
  await mkdir(dailyDir, { recursive: true })
  const byDate = new Map()
  for (const document of documents) {
    if (!byDate.has(document.entry.date)) byDate.set(document.entry.date, [])
    byDate.get(document.entry.date).push(document)
  }
  const dates = []
  let occurrenceCount = 0
  let uniqueCount = 0
  const corpusKeys = new Map()
  for (const date of [...byDate.keys()].sort((a, b) => b.localeCompare(a))) {
    const edition = composeDailyEdition({ date, documents: byDate.get(date), resolvedSourceCommit })
    for (const article of edition.articles) {
      for (const occurrence of article.occurrences) {
        const pair = `${occurrence.issue_id}\0${occurrence.article_id}`
        if (corpusKeys.has(occurrence.article_key) && corpusKeys.get(occurrence.article_key) !== pair) {
          throw new Error(`Daily article key collision across corpus: ${occurrence.article_key}`)
        }
        corpusKeys.set(occurrence.article_key, pair)
      }
    }
    const uncompressed = Buffer.from(JSON.stringify(edition))
    const compressed = gzipSync(uncompressed, { level: 9, mtime: 0 })
    const file = `${date}.json.gz`
    await writeFile(path.join(dailyDir, file), compressed)
    const occurrences = edition.articles.reduce((sum, article) => sum + article.occurrences.length, 0)
    const editorial = edition.articles.filter((article) => !article.is_sponsor && article.content_type === "editorial").length
    const resources = edition.articles.filter((article) => !article.is_sponsor && RESOURCE_TYPES.has(article.content_type)).length
    const sponsors = edition.articles.filter((article) => article.is_sponsor || article.content_type === "sponsor").length
    occurrenceCount += occurrences
    uniqueCount += edition.articles.length
    dates.push({
      date,
      file,
      issue_count: edition.issues.length,
      occurrence_count: occurrences,
      unique_article_count: edition.articles.length,
      editorial_count: editorial,
      resource_count: resources,
      sponsor_count: sponsors,
      page_count: edition.pages.length,
      gzip_bytes: compressed.length,
      uncompressed_bytes: uncompressed.length,
      sha256: createHash("sha256").update(compressed).digest("hex"),
    })
  }
  const metadata = {
    resolved_source_commit: resolvedSourceCommit,
    edition_count: dates.length,
    article_occurrence_count: occurrenceCount,
    unique_article_count: uniqueCount,
    gzip_bytes: dates.reduce((sum, entry) => sum + entry.gzip_bytes, 0),
    uncompressed_bytes: dates.reduce((sum, entry) => sum + entry.uncompressed_bytes, 0),
    dates,
  }
  await writeFile(path.join(outputDir, "daily-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`)
  return metadata
}

export function validateDailyEdition(edition, metadataEntry, sourceCommit) {
  if (!edition || typeof edition !== "object" || Array.isArray(edition)) throw new Error("Daily edition must be an object")
  if (edition.date !== metadataEntry.date) throw new Error("Daily edition date mismatch")
  if (edition.resolved_source_commit !== sourceCommit) throw new Error("Daily edition source SHA mismatch")
  if (!Array.isArray(edition.articles) || !Array.isArray(edition.pages) || !Array.isArray(edition.issues)) throw new Error("Daily edition arrays are missing")
  const keys = new Set()
  for (const article of edition.articles) {
    if (!article || typeof article.article_key !== "string" || !/^[a-f0-9]{32,64}$/.test(article.article_key)) throw new Error("Invalid Daily article key")
    if (keys.has(article.article_key)) throw new Error("Duplicate Daily article key")
    keys.add(article.article_key)
    if (!Array.isArray(article.occurrences) || article.occurrences.length === 0) throw new Error("Daily article has no occurrences")
  }
  const assignments = []
  edition.pages.forEach((page, index) => {
    if (page.number !== index + 1 || !Array.isArray(page.slots)) throw new Error("Daily page numbering is invalid")
    for (const slot of page.slots) {
      assignments.push(slot.article_key)
      if (edition.article_pages?.[slot.article_key] !== page.number) throw new Error("Daily article-to-page mapping is invalid")
    }
  })
  if (
    assignments.length !== keys.size ||
    new Set(assignments).size !== keys.size ||
    assignments.some((key) => !keys.has(key)) ||
    !Array.isArray(edition.article_order) ||
    edition.article_order.some((key, index) => key !== assignments[index]) ||
    Object.keys(edition.article_pages ?? {}).length !== keys.size
  ) {
    throw new Error("Daily page assignments do not match unique articles")
  }
  if (metadataEntry.unique_article_count !== keys.size || metadataEntry.page_count !== edition.pages.length) throw new Error("Daily edition counts mismatch metadata")
  return edition
}

export async function assertDailyArtifacts({ outputDir, resolvedSourceCommit }) {
  const metadata = JSON.parse(await readFile(path.join(outputDir, "daily-metadata.json"), "utf8"))
  if (metadata.resolved_source_commit !== resolvedSourceCommit) throw new Error("Daily metadata source SHA mismatch")
  if (metadata.edition_count !== metadata.dates.length) throw new Error("Daily edition count mismatch")
  for (const entry of metadata.dates) {
    if (!DAILY_FILE.test(entry.file) || entry.file !== `${entry.date}.json.gz`) throw new Error(`Invalid Daily filename: ${entry.file}`)
    const file = path.join(outputDir, "daily", entry.file)
    const compressed = await readFile(file)
    if (createHash("sha256").update(compressed).digest("hex") !== entry.sha256) throw new Error(`Daily checksum mismatch: ${entry.file}`)
    if (compressed.length !== entry.gzip_bytes) throw new Error(`Daily gzip size mismatch: ${entry.file}`)
    const uncompressed = gunzipSync(compressed)
    if (uncompressed.length !== entry.uncompressed_bytes) throw new Error(`Daily uncompressed size mismatch: ${entry.file}`)
    validateDailyEdition(JSON.parse(uncompressed.toString("utf8")), entry, resolvedSourceCommit)
  }
  return metadata
}
