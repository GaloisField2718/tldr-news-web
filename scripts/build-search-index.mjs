// Builds the static Pagefind search index from the generated yearly search documents.
//
// The index is a build artifact, never committed: it is derived from `.generated/`,
// which `data:sync` produces immediately before this runs. Output lands in `public/`
// so Next serves it as plain static files — the browser fetches only the index chunks
// matching a query, so no application server ever executes a search.
import { readFileSync, existsSync, rmSync, mkdirSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import * as pagefind from "pagefind"

const GENERATED = process.env.TLDR_GENERATED_DIR
  ? path.resolve(process.env.TLDR_GENERATED_DIR)
  : path.join(process.cwd(), ".generated")
const OUTPUT = path.join(process.cwd(), "public", "search-index")

function readMetadata() {
  const file = path.join(GENERATED, "search-metadata.json")
  if (!existsSync(file)) {
    throw new Error(`Search documents are unavailable (${file}). Run \`npm run data:sync\` first.`)
  }
  return JSON.parse(readFileSync(file, "utf8"))
}

function readSegment(file) {
  return JSON.parse(gunzipSync(readFileSync(path.join(GENERATED, "search", file))).toString("utf8"))
}

// Any surrogate left without its pair -- whether already present in the source or
// created by truncation -- is not valid UTF-8 and the indexer rejects the record.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/** Truncate by code point, not code unit, so emoji and other astral characters survive. */
function truncate(value, max) {
  const points = Array.from(value)
  const cut = points.length <= max ? value : points.slice(0, max).join("")
  return cut.replace(LONE_SURROGATE, "")
}

async function main() {
  const metadata = readMetadata()
  rmSync(OUTPUT, { recursive: true, force: true })
  mkdirSync(OUTPUT, { recursive: true })

  const { index } = await pagefind.createIndex({ forceLanguage: "en" })
  const started = Date.now()
  let indexed = 0
  let skipped = 0
  let collisions = 0

  for (const segment of metadata.segments) {
    const documents = readSegment(segment.file)
    // 4.3% of article ids collide inside their own issue -- an upstream id-generation
    // defect. A deterministic occurrence suffix gives every record a unique key without
    // touching the article identity used for routing.
    const seen = new Map()
    for (const document of documents) {
      const title = (document.title ?? "").trim().replace(LONE_SURROGATE, "")
      const summary = (document.summary ?? "").trim().replace(LONE_SURROGATE, "")
      if (!title && !summary) {
        skipped += 1
        continue
      }
      const occurrence = seen.get(document.id) ?? 0
      seen.set(document.id, occurrence + 1)
      if (occurrence > 0) collisions += 1
      const key = occurrence === 0 ? document.id : `${document.id}#${occurrence}`

      await index.addCustomRecord({
        // Every record needs its own URL. Records sharing one are not merged -- the
        // later overwrites the earlier, which silently drops ~94% of the corpus while
        // still reporting every record as indexed. The anchor makes each article
        // distinct; `meta.route` carries the address results actually link to.
        url: `${document.issue_route}#${encodeURIComponent(key)}`,
        content: [title, summary, document.source_domain, document.sector, document.section_heading]
          .filter(Boolean)
          .join(". "),
        language: "en",
        meta: {
          key,
          title,
          summary: truncate(summary, 400),
          date: document.issue_date,
          sector: document.sector,
          sector_slug: document.sector_slug,
          domain: document.source_domain ?? "",
          url: document.url ?? "",
          route: document.issue_route,
          section: document.section_heading ?? "",
          type: document.content_type,
        },
        filters: {
          year: [document.issue_date.slice(0, 4)],
          sector: [document.sector_slug],
          type: [document.content_type],
        },
      })
      indexed += 1
    }
  }

  const { errors } = await index.writeFiles({ outputPath: OUTPUT })
  await pagefind.close()
  if (errors?.length) throw new Error(`Pagefind reported errors: ${errors.join(", ")}`)

  const seconds = ((Date.now() - started) / 1000).toFixed(0)
  console.log(
    `Search index built in ${seconds}s: ${indexed} records indexed, ${skipped} unusable skipped, ` +
      `${collisions} duplicate ids disambiguated -> ${path.relative(process.cwd(), OUTPUT)}`,
  )
}

await main()
