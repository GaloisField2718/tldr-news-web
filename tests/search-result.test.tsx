import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SearchResult } from "@/components/search-result"
import type { Article } from "@/lib/types"
import type { SearchResultItem } from "@/lib/search"

const baseArticle: Article = {
  id: "a1",
  order: 1,
  title: "Model pricing keeps falling",
  summary: "A summary of the story.",
  url: "https://publisher.example/story",
  reading_time_minutes: 4,
  source_domain: "publisher.example",
  content_type: "editorial",
  is_sponsor: false,
}

function item(overrides: Partial<Article> = {}): SearchResultItem {
  return {
    article: { ...baseArticle, ...overrides },
    issue_id: "tldr:2026-07-24",
    sector: "TLDR",
    sector_slug: "tldr",
    date: "2026-07-24",
    section_heading: "Big Tech & Startups",
    issue_route: "/issues/tldr/2026-07-24",
  }
}

describe("SearchResult external article links", () => {
  it("opens a valid external article URL in a new tab with safe rel attributes", () => {
    const html = renderToStaticMarkup(<SearchResult item={item()} />)
    expect(html).toContain('href="https://publisher.example/story"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("links to the internal issue route in the same tab", () => {
    const html = renderToStaticMarkup(<SearchResult item={item()} />)
    expect(html).toContain('href="/issues/tldr/2026-07-24"')
    const issueLinkStart = html.indexOf('href="/issues/tldr/2026-07-24"')
    const tagStart = html.lastIndexOf("<a", issueLinkStart)
    const tagEnd = html.indexOf(">", issueLinkStart)
    const tag = html.slice(tagStart, tagEnd)
    expect(tag).not.toContain("target=")
  })

  it("renders safely without an external link when the URL is missing", () => {
    const html = renderToStaticMarkup(<SearchResult item={item({ url: null })} />)
    expect(html).not.toContain("target=")
    expect(html).toContain("Model pricing keeps falling")
  })

  it("renders safely instead of a clickable link when the URL is malformed", () => {
    const html = renderToStaticMarkup(<SearchResult item={item({ url: "not a url" })} />)
    expect(html).not.toContain('href="not a url"')
  })
})
