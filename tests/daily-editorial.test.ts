import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { applyDailyEditorial } from "@/lib/daily-editorial"
import type { DailyEdition } from "@/lib/daily-types"
import { composeDailyEdition } from "../scripts/daily-data-lib.mjs"
import { makeArticle, makeIssue } from "./helpers/dataset"

const DATE = "2026-07-21"
const IMAGE_HASH = "a".repeat(64)
const IMAGE_HOST = "tldr-assets.noisy-dew-7159.workers.dev"
const IMAGE_KEY = `daily/2026/07/21/${IMAGE_HASH}.webp`
let temporary: string
let edition: DailyEdition

function document(issue: ReturnType<typeof makeIssue>) {
  return { entry: { date: issue.date }, issue }
}

function ref(issue: string, article: string) {
  return { issue_id: issue, article_id: article }
}

function fixtureEdition(): DailyEdition {
  const issues = [
    makeIssue({
      sector: "TLDR",
      sectorSlug: "tldr",
      date: DATE,
      articles: [
        makeArticle(`tldr:${DATE}:google`, "editorial", { order: 1, title: "Google chip story", url: "https://example.com/google" }),
        makeArticle(`tldr:${DATE}:amd`, "editorial", { order: 2, title: "AMD Helios", url: "https://example.com/amd" }),
        makeArticle(`tldr:${DATE}:other`, "editorial", { order: 3, title: "TLDR remainder", url: "https://example.com/tldr-other" }),
        makeArticle(`tldr:${DATE}:tool`, "tool", { order: 4, title: "Useful tool", url: "https://example.com/tool" }),
      ],
    }),
    makeIssue({
      sector: "TLDR AI",
      sectorSlug: "tldr-ai",
      date: DATE,
      articles: [
        makeArticle(`tldr-ai:${DATE}:selected`, "editorial", { order: 1, title: "Selected AI", url: "https://example.com/ai-selected" }),
        makeArticle(`tldr-ai:${DATE}:other`, "editorial", { order: 2, title: "AI remainder", url: "https://example.com/ai-other" }),
      ],
    }),
    makeIssue({
      sector: "TLDR Design",
      sectorSlug: "tldr-design",
      date: DATE,
      articles: [
        makeArticle(`tldr-design:${DATE}:other`, "editorial", { title: "Design remainder", url: "https://example.com/design" }),
        makeArticle(`tldr-design:${DATE}:sponsor`, "sponsor", { order: 2, title: "Sponsor", url: "https://example.com/sponsor" }),
      ],
    }),
  ]
  return composeDailyEdition({
    date: DATE,
    documents: issues.map(document),
    resolvedSourceCommit: "b".repeat(40),
  }) as DailyEdition
}

function artifact(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "1.0.0",
    generator_version: "1.0.0",
    date: DATE,
    status: "ai_complete",
    editorial_input_hash: `sha256:${"b".repeat(64)}`,
    final_prompt: "must remain server-only",
    generation: { editorial_request_id: "private-request-id" },
    usage: { total_cost_usd: 42 },
    plan: {
      lead: ref(`tldr:${DATE}`, `tldr:${DATE}:amd`),
      front_page: [
        { ...ref(`tldr:${DATE}`, `tldr:${DATE}:amd`), role: "lead" },
        { ...ref(`tldr-ai:${DATE}`, `tldr-ai:${DATE}:selected`), role: "secondary" },
      ],
      section_order: ["tldr-design", "tldr-ai", "tldr"],
      visual_brief: { alt_text: "AMD Helios rack-scale editorial illustration" },
    },
    illustration: {
      status: "ready",
      storage_verified: true,
      media_type: "image/webp",
      aspect_ratio: "3:2",
      attribution: "AI-generated editorial illustration",
      public_url: `https://${IMAGE_HOST}/${IMAGE_KEY}`,
      object_key: IMAGE_KEY,
      sha256: `sha256:${IMAGE_HASH}`,
      width: 1264,
      height: 848,
    },
    ...overrides,
  }
}

async function writeEditorial(value: ReturnType<typeof artifact>) {
  const editorial = path.join(temporary, "editorial")
  const relative = `2026/${DATE}.json`
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`)
  await mkdir(path.join(editorial, "2026"), { recursive: true })
  await writeFile(path.join(editorial, relative), bytes)
  await writeFile(path.join(editorial, "manifest.json"), JSON.stringify({
    schema_version: "1.0.0",
    generator_version: "1.0.0",
    dates: [{
      date: DATE,
      file: relative,
      bytes: bytes.length,
      sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      status: value.status,
      editorial_input_hash: value.editorial_input_hash,
    }],
  }))
}

beforeEach(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "daily-editorial-"))
  edition = fixtureEdition()
})

afterEach(async () => {
  await rm(temporary, { recursive: true, force: true })
})

describe("Daily editorial artifact projection", () => {
  it("applies a valid editorial plan and ready production-ratio image", async () => {
    await writeEditorial(artifact())
    const result = applyDailyEditorial(temporary, edition)
    const leadKey = result.edition.pages[0].slots[0].article_key
    expect(result.edition.articles.find((item) => item.article_key === leadKey)?.title).toBe("AMD Helios")
    expect(result.edition.pages[0].slots.map((slot) => slot.role)).toEqual(["lead", "secondary"])
    expect(result.edition.pages[1].sectors).toEqual(["TLDR Design"])
    expect(result.illustration).toEqual({
      src: `https://${IMAGE_HOST}/${IMAGE_KEY}`,
      width: 1264,
      height: 848,
      alt: "AMD Helios rack-scale editorial illustration",
      attribution: "AI-generated editorial illustration",
    })
    expect(JSON.stringify(result)).not.toMatch(/final_prompt|request-id|total_cost/)

    const assignments = result.edition.pages.flatMap((page) => page.slots.map((slot) => slot.article_key))
    expect(assignments).toHaveLength(edition.articles.length)
    expect(new Set(assignments).size).toBe(edition.articles.length)
    expect(result.edition.article_order).toEqual(assignments)
    result.edition.pages.forEach((page) => page.slots.forEach((slot) => {
      expect(result.edition.article_pages[slot.article_key]).toBe(page.number)
    }))
    for (const slot of result.edition.pages[0].slots) {
      expect(result.edition.pages.slice(1).flatMap((page) => page.slots).some((item) => item.article_key === slot.article_key)).toBe(false)
    }
  })

  it("returns the untouched deterministic edition when the artifact is missing", () => {
    const result = applyDailyEditorial(temporary, edition)
    expect(result).toEqual({ edition })
    expect(result.edition).toBe(edition)
  })

  it.each([
    artifact({ date: "2026-07-20" }),
    artifact({ schema_version: "2.0.0" }),
    artifact({ editorial_input_hash: "sha256:stale" }),
    artifact({ plan: null }),
  ])("falls back atomically for a stale or malformed artifact %#", async (value) => {
    await writeEditorial(value)
    const result = applyDailyEditorial(temporary, edition)
    expect(result).toEqual({ edition })
    expect(result.edition).toBe(edition)
  })

  it("does not use disabled or deterministic-fallback plans and applies editorial-only plans without an image", async () => {
    for (const status of ["disabled", "deterministic_fallback"]) {
      await writeEditorial(artifact({ status }))
      expect(applyDailyEditorial(temporary, edition)).toEqual({ edition })
    }
    await writeEditorial(artifact({ status: "editorial_only" }))
    const editorialOnly = applyDailyEditorial(temporary, edition)
    expect(editorialOnly.edition).not.toBe(edition)
    expect(editorialOnly.illustration).toBeUndefined()
  })

  it.each([
    { status: "disabled" },
    { status: "ready", storage_verified: false },
  ])("suppresses an image that is disabled or not storage verified %#", async (illustrationOverride) => {
    const value = artifact()
    Object.assign(value.illustration, illustrationOverride)
    await writeEditorial(value)
    const result = applyDailyEditorial(temporary, edition)
    expect(result).toEqual({ edition })
    expect(result.edition).toBe(edition)
  })

  it.each([
    `http://${IMAGE_HOST}/${IMAGE_KEY}`,
    `https://other.workers.dev/${IMAGE_KEY}`,
    `https://${IMAGE_HOST}/wrong/${IMAGE_HASH}.webp`,
  ])("rejects invalid external illustration URL %s", async (publicUrl) => {
    const value = artifact()
    value.illustration.public_url = publicUrl
    await writeEditorial(value)
    const result = applyDailyEditorial(temporary, edition)
    expect(result).toEqual({ edition })
    expect(result.edition).toBe(edition)
  })

  it("rejects an illustration outside the two-percent 3:2 ratio tolerance", async () => {
    const value = artifact()
    value.illustration.width = 1200
    value.illustration.height = 900
    await writeEditorial(value)
    expect(applyDailyEditorial(temporary, edition)).toEqual({ edition })
  })

  it("requires an immutable date key whose filename hash matches illustration.sha256", async () => {
    const value = artifact()
    value.illustration.object_key = `daily/2026/07/21/${"c".repeat(64)}.webp`
    value.illustration.public_url = `https://${IMAGE_HOST}/${value.illustration.object_key}`
    await writeEditorial(value)
    expect(applyDailyEditorial(temporary, edition)).toEqual({ edition })
  })

  it("falls back atomically when an article reference is missing", async () => {
    const value = artifact()
    value.plan.front_page[1].article_id = "missing"
    await writeEditorial(value)
    const result = applyDailyEditorial(temporary, edition)
    expect(result).toEqual({ edition })
    expect(result.edition.pages[0].slots[0]).toEqual(edition.pages[0].slots[0])
  })

  it("falls back when the manifest checksum is stale", async () => {
    await writeEditorial(artifact())
    await writeFile(path.join(temporary, "editorial", "2026", `${DATE}.json`), "{}")
    expect(applyDailyEditorial(temporary, edition)).toEqual({ edition })
  })
})
