import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import HomePage from "@/app/page"
import { getLatestPublishedDaily, getPublishedDailyPodcast } from "@/lib/daily-latest"
import { formatLongDate } from "@/lib/format"

// Rendered against the real synced archive, so this covers the wiring the mocked
// selection tests deliberately bypass.
const html = renderToStaticMarkup(<HomePage />)
const edition = getLatestPublishedDaily()

/** Editorial text carries apostrophes, which React escapes in the rendered markup. */
const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;")

describe("homepage", () => {
  it("has a latest edition to present", () => {
    expect(edition).toBeDefined()
  })

  it("leads with the latest edition, its date and its lead story", () => {
    expect(html).toContain("Latest Daily Edition")
    expect(html).toContain(formatLongDate(edition!.date))
    expect(html).toContain(`dateTime="${edition!.date}"`)
    expect(html).toContain(escapeHtml(edition!.title))
    expect(html).toContain(escapeHtml(edition!.introduction))
  })

  it("links the edition to its own route", () => {
    expect(html).toContain(`href="/daily/${edition!.date}"`)
    expect(html).toContain("Read the edition")
  })

  it("keeps search and archive reachable", () => {
    expect(html).toContain('href="/archive"')
    expect(html).toContain("browse the archive")
    expect(html).toContain("form")
  })

  it("renders the edition illustration only when one exists", () => {
    if (edition!.illustration) {
      expect(html).toContain(edition!.illustration.src)
      expect(html).toContain(edition!.illustration.attribution)
    } else {
      expect(html).not.toContain("editorial illustration")
    }
  })

  it("never autoplays and loads no audio before the reader asks", () => {
    expect(html).not.toContain("autoplay")
    // The listen actions register nothing on render: no episode URL reaches the homepage
    // markup, and the dock stays absent until one of them is pressed.
    const podcast = getPublishedDailyPodcast(edition!.date)
    if (podcast) expect(html).not.toContain(podcast.languages.en.audio_url)
  })

  it("still lists recent issues and sector navigation", () => {
    expect(html).toContain("Latest issues")
    expect(html).toContain("Sectors")
  })
})
