import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import type {
  DailyArticle,
  DailyEdition,
  DailyPage,
  DailyPageSlot,
  DailySlotRole,
} from "./daily-types"

const SHA256_PATTERN = /^sha256:([a-f0-9]{64})$/
const ARTICLE_KEY_PATTERN = /^[a-f0-9]{32,64}$/
const SECTOR_PATTERN = /^tldr(?:-[a-z0-9]+)*$/
const EDITORIAL_STATUSES = new Set(["ai_complete", "editorial_only"])
const FRONT_PAGE_ROLES = new Set<DailySlotRole>(["lead", "secondary", "brief"])
const RESOURCE_TYPES = new Set(["github_repo", "course", "tool"])
const IMAGE_ATTRIBUTION = "AI-generated editorial illustration"
const DEFAULT_IMAGE_HOST = "tldr-assets.noisy-dew-7159.workers.dev"

export interface DailyEditorialIllustration {
  src: string
  width: number
  height: number
  alt: string
  attribution: typeof IMAGE_ATTRIBUTION
}

export interface DailyEditorialResult {
  edition: DailyEdition
  illustration?: DailyEditorialIllustration
}

interface EditorialReference {
  issue_id: string
  article_id: string
}

interface EditorialFrontPageReference extends EditorialReference {
  role: "lead" | "secondary" | "brief"
}

interface EditorialPlan {
  lead: EditorialReference
  frontPage: EditorialFrontPageReference[]
  sectionOrder: string[]
  altText: string
}

interface EditorialArtifactProjection {
  status: "ai_complete" | "editorial_only"
  plan: EditorialPlan
  illustration?: DailyEditorialIllustration
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function parseReference(value: unknown): EditorialReference {
  if (!isObject(value) || !nonEmptyString(value.issue_id) || !nonEmptyString(value.article_id)) {
    throw new Error("Editorial article reference is invalid")
  }
  return { issue_id: value.issue_id, article_id: value.article_id }
}

function referenceId(reference: EditorialReference): string {
  return `${reference.issue_id}\0${reference.article_id}`
}

function configuredImageHost(): string {
  const host = process.env.TLDR_EDITORIAL_IMAGE_HOST ?? DEFAULT_IMAGE_HOST
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    throw new Error("Configured editorial image hostname is invalid")
  }
  return host
}

function projectIllustration(
  artifact: Record<string, unknown>,
  date: string,
  altText: string,
): DailyEditorialIllustration | undefined {
  if (artifact.status !== "ai_complete") return undefined
  if (!isObject(artifact.illustration)) throw new Error("Editorial illustration is missing")
  const illustration = artifact.illustration
  if (
    illustration.status !== "ready" ||
    illustration.storage_verified !== true ||
    illustration.media_type !== "image/webp" ||
    illustration.aspect_ratio !== "3:2" ||
    illustration.attribution !== IMAGE_ATTRIBUTION ||
    !nonEmptyString(illustration.public_url) ||
    !nonEmptyString(illustration.object_key) ||
    !nonEmptyString(illustration.sha256) ||
    !Number.isInteger(illustration.width) ||
    !Number.isInteger(illustration.height) ||
    (illustration.width as number) <= 0 ||
    (illustration.height as number) <= 0
  ) throw new Error("Editorial illustration is not ready")

  const objectMatch = illustration.object_key.match(
    /^daily\/(\d{4})\/(\d{2})\/(\d{2})\/([a-f0-9]{64})\.webp$/,
  )
  const shaMatch = illustration.sha256.match(SHA256_PATTERN)
  if (
    !objectMatch ||
    !shaMatch ||
    `${objectMatch[1]}-${objectMatch[2]}-${objectMatch[3]}` !== date ||
    objectMatch[4] !== shaMatch[1]
  ) throw new Error("Editorial illustration identity is invalid")

  let url: URL
  try {
    url = new URL(illustration.public_url)
  } catch {
    throw new Error("Editorial illustration URL is invalid")
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== configuredImageHost() ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== `/${illustration.object_key}` ||
    url.search !== "" ||
    url.hash !== ""
  ) throw new Error("Editorial illustration URL is not allowed")

  const width = illustration.width as number
  const height = illustration.height as number
  if (Math.abs(width / height / 1.5 - 1) > 0.02) {
    throw new Error("Editorial illustration ratio is invalid")
  }
  return {
    src: url.toString(),
    width,
    height,
    alt: altText,
    attribution: IMAGE_ATTRIBUTION,
  }
}

function projectArtifact(value: unknown, date: string): EditorialArtifactProjection {
  if (
    !isObject(value) ||
    value.schema_version !== "1.0.0" ||
    value.date !== date ||
    !EDITORIAL_STATUSES.has(String(value.status)) ||
    !isObject(value.plan) ||
    !Array.isArray(value.plan.front_page) ||
    !Array.isArray(value.plan.section_order) ||
    !isObject(value.plan.visual_brief) ||
    !nonEmptyString(value.plan.visual_brief.alt_text)
  ) throw new Error("Editorial artifact is stale or malformed")

  const lead = parseReference(value.plan.lead)
  if (value.plan.front_page.length < 1 || value.plan.front_page.length > 9) {
    throw new Error("Editorial front page size is invalid")
  }
  const frontPage = value.plan.front_page.map((item): EditorialFrontPageReference => {
    const reference = parseReference(item)
    if (!isObject(item) || !FRONT_PAGE_ROLES.has(item.role as DailySlotRole)) {
      throw new Error("Editorial front-page role is invalid")
    }
    return { ...reference, role: item.role as EditorialFrontPageReference["role"] }
  })
  const leads = frontPage.filter((item) => item.role === "lead")
  if (
    leads.length !== 1 ||
    frontPage[0].role !== "lead" ||
    referenceId(leads[0]) !== referenceId(lead)
  ) {
    throw new Error("Editorial lead does not match the front page")
  }
  if (frontPage.filter((item) => item.role === "secondary").length > 4) {
    throw new Error("Editorial front page has too many secondary stories")
  }
  if (new Set(frontPage.map(referenceId)).size !== frontPage.length) {
    throw new Error("Editorial front page contains duplicate references")
  }
  const sectionOrder: string[] = []
  for (const sector of value.plan.section_order) {
    if (!nonEmptyString(sector) || !SECTOR_PATTERN.test(sector) || sectionOrder.includes(sector)) {
      throw new Error("Editorial section order is invalid")
    }
    sectionOrder.push(sector)
  }
  const status = value.status as EditorialArtifactProjection["status"]
  const altText = value.plan.visual_brief.alt_text.trim()
  return {
    status,
    plan: { lead, frontPage, sectionOrder, altText },
    illustration: projectIllustration(value, date, altText),
  }
}

function readProjectedArtifact(root: string, date: string): EditorialArtifactProjection | undefined {
  const editorialRoot = path.resolve(root, "editorial")
  const manifestFile = path.join(editorialRoot, "manifest.json")
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as unknown
  if (!isObject(manifest) || manifest.schema_version !== "1.0.0" || !Array.isArray(manifest.dates)) {
    throw new Error("Editorial manifest is malformed")
  }
  const matches = manifest.dates.filter((item) => isObject(item) && item.date === date)
  if (matches.length === 0) return undefined
  if (matches.length !== 1) throw new Error("Editorial manifest contains duplicate dates")
  const entry = matches[0]
  const expectedFile = `${date.slice(0, 4)}/${date}.json`
  if (
    entry.file !== expectedFile ||
    !Number.isInteger(entry.bytes) ||
    (entry.bytes as number) < 1 ||
    !nonEmptyString(entry.sha256) ||
    !SHA256_PATTERN.test(entry.sha256)
  ) throw new Error("Editorial manifest entry is malformed")
  const artifactFile = path.resolve(editorialRoot, expectedFile)
  if (!artifactFile.startsWith(`${editorialRoot}${path.sep}`)) {
    throw new Error("Editorial artifact path escapes its root")
  }
  const bytes = readFileSync(artifactFile)
  if (
    bytes.length !== entry.bytes ||
    `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== entry.sha256
  ) throw new Error("Editorial artifact does not match its manifest")
  const artifact = JSON.parse(bytes.toString("utf8")) as unknown
  if (
    !isObject(artifact) ||
    entry.status !== artifact.status ||
    !nonEmptyString(entry.editorial_input_hash) ||
    !SHA256_PATTERN.test(entry.editorial_input_hash) ||
    entry.editorial_input_hash !== artifact.editorial_input_hash
  ) throw new Error("Editorial artifact is stale relative to its manifest")
  return projectArtifact(artifact, date)
}

function balancedChunks<T>(items: T[], maximum = 15): T[][] {
  if (items.length === 0) return []
  const count = Math.ceil(items.length / maximum)
  const base = Math.floor(items.length / count)
  const larger = items.length % count
  const chunks: T[][] = []
  let offset = 0
  for (let index = 0; index < count; index += 1) {
    const size = base + (index < larger ? 1 : 0)
    chunks.push(items.slice(offset, offset + size))
    offset += size
  }
  return chunks
}

function slots(articles: DailyArticle[], firstRole: DailySlotRole): DailyPageSlot[] {
  return articles.map((article, index) => ({
    role: index === 0 ? firstRole : index < 6 ? "standard" : "brief",
    article_key: article.article_key,
  }))
}

function composeEditorialEdition(edition: DailyEdition, projection: EditorialArtifactProjection): DailyEdition {
  if (edition.pages.length === 0) throw new Error("Editorial plan cannot apply to an empty edition")
  const occurrenceMap = new Map<string, DailyArticle>()
  for (const article of edition.articles) {
    if (!ARTICLE_KEY_PATTERN.test(article.article_key)) throw new Error("Daily article key is invalid")
    for (const occurrence of article.occurrences) {
      const id = referenceId({ issue_id: occurrence.issue_id, article_id: occurrence.article_id })
      const existing = occurrenceMap.get(id)
      if (existing && existing.article_key !== article.article_key) {
        throw new Error("Editorial reference maps to multiple Daily articles")
      }
      occurrenceMap.set(id, article)
    }
  }

  const selected = projection.plan.frontPage.map((reference) => {
    const article = occurrenceMap.get(referenceId(reference))
    if (
      !article ||
      article.is_sponsor ||
      article.content_type !== "editorial" ||
      article.title.trim().length === 0 ||
      article.summary.trim().length === 0
    ) throw new Error("Editorial plan references a missing or ineligible article")
    return { article, role: reference.role }
  })
  const selectedKeys = new Set(selected.map(({ article }) => article.article_key))
  if (selectedKeys.size !== selected.length) {
    throw new Error("Editorial references collapse to duplicate Daily articles")
  }

  const editorial = edition.articles.filter(
    (article) => !article.is_sponsor && article.content_type === "editorial",
  )
  const resources = edition.articles.filter(
    (article) => !article.is_sponsor && RESOURCE_TYPES.has(article.content_type),
  )
  const sponsors = edition.articles.filter(
    (article) => article.is_sponsor || article.content_type === "sponsor",
  )
  const remainingEditorial = editorial.filter((article) => !selectedKeys.has(article.article_key))
  const bySector = new Map<string, DailyArticle[]>()
  for (const article of remainingEditorial) {
    const group = bySector.get(article.sector_slug) ?? []
    group.push(article)
    bySector.set(article.sector_slug, group)
  }
  for (const sector of projection.plan.sectionOrder) {
    if (!edition.articles.some((article) => article.sector_slug === sector)) {
      throw new Error("Editorial section order references a missing sector")
    }
  }
  const sectorOrder = [
    ...projection.plan.sectionOrder,
    ...[...bySector.keys()].filter((sector) => !projection.plan.sectionOrder.includes(sector)),
  ]

  const deterministicFront = edition.pages[0]
  const pages: DailyPage[] = [{
    number: 1,
    template: "front-page",
    title: deterministicFront.title,
    kicker: deterministicFront.kicker,
    sectors: [...new Set(selected.map(({ article }) => article.sector))],
    slots: selected.map(({ article, role }) => ({ role, article_key: article.article_key })),
  }]
  for (const sector of sectorOrder) {
    const sectorArticles = bySector.get(sector)
    if (!sectorArticles) continue
    for (const [continuation, chunk] of balancedChunks(sectorArticles).entries()) {
      pages.push({
        number: pages.length + 1,
        template: continuation === 0 ? "section-lead" : "three-column",
        title: continuation === 0 ? chunk[0].sector : `${chunk[0].sector} — continued`,
        kicker: continuation === 0 ? chunk[0].section_heading : "Continued",
        sectors: [chunk[0].sector],
        slots: slots(chunk, continuation === 0 ? "lead" : "standard"),
      })
    }
  }
  for (let offset = 0; offset < resources.length; offset += 18) {
    const chunk = resources.slice(offset, offset + 18)
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
    pages.push({
      number: pages.length + 1,
      template: "sponsored",
      title: offset === 0 ? "Sponsored" : "Sponsored — continued",
      kicker: "Paid placements from today’s newsletters",
      sectors: [...new Set(chunk.map((article) => article.sector))],
      slots: chunk.map((article) => ({ role: "sponsor", article_key: article.article_key })),
    })
  }

  const assigned = pages.flatMap((page) => page.slots.map((slot) => slot.article_key))
  const allKeys = new Set(edition.articles.map((article) => article.article_key))
  if (
    assigned.length !== edition.articles.length ||
    new Set(assigned).size !== assigned.length ||
    assigned.some((key) => !allKeys.has(key))
  ) throw new Error("Editorial composition does not assign every article exactly once")
  const articlePages: Record<string, number> = {}
  for (const page of pages) for (const slot of page.slots) articlePages[slot.article_key] = page.number
  return { ...edition, pages, article_pages: articlePages, article_order: assigned }
}

export function applyDailyEditorial(root: string, deterministic: DailyEdition): DailyEditorialResult {
  try {
    const projection = readProjectedArtifact(root, deterministic.date)
    if (!projection) return { edition: deterministic }
    const edition = composeEditorialEdition(deterministic, projection)
    return { edition, illustration: projection.illustration }
  } catch {
    return { edition: deterministic }
  }
}
