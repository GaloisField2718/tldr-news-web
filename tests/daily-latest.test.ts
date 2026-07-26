import { beforeEach, describe, expect, it, vi } from "vitest"

// Controlled stand-ins for the generated data, so the homepage selection rules can be
// exercised against cases the real archive does not currently contain.
const metadata: { dates: { date: string; unique_article_count: number }[] } = { dates: [] }
const editions = new Map<string, unknown>()
const illustrations = new Map<string, unknown>()
const podcasts = new Map<string, unknown>()

function resolve(store: Map<string, unknown>, date: string) {
  const value = store.get(date)
  if (value instanceof Error) throw value
  return value
}

vi.mock("@/lib/daily", () => ({
  getDailyMetadata: () => metadata,
  getDailyEdition: (date: string) => resolve(editions, date),
  getDailyEditorialIllustration: (date: string) => resolve(illustrations, date),
}))
vi.mock("@/lib/podcast", () => ({
  getDailyPodcast: (date: string) => resolve(podcasts, date),
}))

const { getLatestPublishedDaily, getPublishedDailyPodcast } = await import("@/lib/daily-latest")

function edition(date: string, title = "Lead story", summary = "Lead summary") {
  return {
    date,
    issues: [{ available: true }, { available: true }, { available: false }],
    pages: [{ number: 1, slots: [{ role: "lead", article_key: "k1" }, { role: "standard", article_key: "k2" }] }],
    articles: [
      { article_key: "k1", title, summary },
      { article_key: "k2", title: "Second", summary: "Second summary" },
    ],
    article_order: ["k1", "k2"],
  }
}
const illustration = { src: "https://example.test/a.webp", width: 1, height: 1, alt: "alt", attribution: "AI-generated editorial illustration" }
const podcast = { publication_date: "2026-07-24", languages: { en: {}, fr: {} } }

beforeEach(() => {
  metadata.dates = []
  editions.clear()
  illustrations.clear()
  podcasts.clear()
})

describe("latest published Daily selection", () => {
  it("returns the newest edition with its illustration and podcast", () => {
    metadata.dates = [{ date: "2026-07-24", unique_article_count: 2 }]
    editions.set("2026-07-24", edition("2026-07-24", "Chips", "A summary."))
    illustrations.set("2026-07-24", illustration)
    podcasts.set("2026-07-24", podcast)
    const latest = getLatestPublishedDaily()
    expect(latest).toMatchObject({ date: "2026-07-24", title: "Chips", introduction: "A summary.", articleCount: 2, issueCount: 2 })
    expect(latest?.illustration).toBe(illustration)
    expect(getPublishedDailyPodcast("2026-07-24")).toBe(podcast)
  })

  it("presents an edition that has an illustration but no podcast", () => {
    metadata.dates = [{ date: "2026-07-24", unique_article_count: 2 }]
    editions.set("2026-07-24", edition("2026-07-24"))
    illustrations.set("2026-07-24", illustration)
    const latest = getLatestPublishedDaily()
    expect(latest?.date).toBe("2026-07-24")
    expect(latest?.illustration).toBe(illustration)
    expect(getPublishedDailyPodcast("2026-07-24")).toBeUndefined()
  })

  it("presents an edition that has no illustration", () => {
    metadata.dates = [{ date: "2026-07-24", unique_article_count: 2 }]
    editions.set("2026-07-24", edition("2026-07-24"))
    const latest = getLatestPublishedDaily()
    expect(latest?.date).toBe("2026-07-24")
    expect(latest?.illustration).toBeUndefined()
  })

  it("returns nothing when no edition exists at all", () => {
    expect(getLatestPublishedDaily()).toBeUndefined()
  })

  // The calendar date is never assumed to carry an edition.
  it("falls back to the latest prior edition when the newest artifact is corrupt", () => {
    metadata.dates = [
      { date: "2026-07-24", unique_article_count: 2 },
      { date: "2026-07-23", unique_article_count: 2 },
    ]
    editions.set("2026-07-24", new Error("Daily edition checksum mismatch"))
    editions.set("2026-07-23", edition("2026-07-23", "Older lead"))
    expect(getLatestPublishedDaily()).toMatchObject({ date: "2026-07-23", title: "Older lead" })
  })

  it("skips an edition with no articles, no pages, or an empty lead title", () => {
    metadata.dates = [
      { date: "2026-07-24", unique_article_count: 0 },
      { date: "2026-07-23", unique_article_count: 2 },
      { date: "2026-07-22", unique_article_count: 2 },
      { date: "2026-07-21", unique_article_count: 2 },
    ]
    editions.set("2026-07-24", edition("2026-07-24"))
    editions.set("2026-07-23", { ...edition("2026-07-23"), pages: [] })
    editions.set("2026-07-22", edition("2026-07-22", "   "))
    editions.set("2026-07-21", edition("2026-07-21", "Usable"))
    expect(getLatestPublishedDaily()).toMatchObject({ date: "2026-07-21", title: "Usable" })
  })

  it("keeps the edition when only its illustration lookup fails", () => {
    metadata.dates = [{ date: "2026-07-24", unique_article_count: 2 }]
    editions.set("2026-07-24", edition("2026-07-24"))
    illustrations.set("2026-07-24", new Error("illustration artifact is invalid"))
    const latest = getLatestPublishedDaily()
    expect(latest?.date).toBe("2026-07-24")
    expect(latest?.illustration).toBeUndefined()
  })

  it("treats a malformed podcast artifact as absent rather than failing the page", () => {
    podcasts.set("2026-07-24", new Error("Podcast artifact is invalid: 2026-07-24"))
    expect(getPublishedDailyPodcast("2026-07-24")).toBeUndefined()
  })

  it("uses the first article in reading order when no slot is marked as the lead", () => {
    metadata.dates = [{ date: "2026-07-24", unique_article_count: 2 }]
    const withoutLead = edition("2026-07-24")
    withoutLead.pages[0].slots = [{ role: "standard", article_key: "k2" }]
    editions.set("2026-07-24", withoutLead)
    expect(getLatestPublishedDaily()?.title).toBe("Lead story")
  })
})
