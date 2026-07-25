import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ExternalArticleLink } from "@/components/external-article-link"
import { isExternalArticleUrl } from "@/lib/links"

describe("isExternalArticleUrl", () => {
  it("accepts absolute http and https URLs", () => {
    expect(isExternalArticleUrl("https://example.com/story")).toBe(true)
    expect(isExternalArticleUrl("http://example.com/story")).toBe(true)
  })

  it("rejects missing, empty, and non-string values", () => {
    expect(isExternalArticleUrl(null)).toBe(false)
    expect(isExternalArticleUrl(undefined)).toBe(false)
    expect(isExternalArticleUrl("")).toBe(false)
  })

  it("rejects malformed strings and relative internal paths", () => {
    expect(isExternalArticleUrl("not a url")).toBe(false)
    expect(isExternalArticleUrl("/daily/2026-07-24")).toBe(false)
    expect(isExternalArticleUrl("/archive")).toBe(false)
    expect(isExternalArticleUrl("/search?q=ai")).toBe(false)
  })

  it("rejects unsafe non-http(s) schemes", () => {
    expect(isExternalArticleUrl("javascript:alert(1)")).toBe(false)
    expect(isExternalArticleUrl("mailto:a@example.com")).toBe(false)
    expect(isExternalArticleUrl("data:text/html,<script>")).toBe(false)
  })
})

describe("ExternalArticleLink shared component", () => {
  it("renders target=_blank and rel=noopener noreferrer for a valid URL", () => {
    const html = renderToStaticMarkup(
      <ExternalArticleLink url="https://example.com/story">Read more</ExternalArticleLink>,
    )
    expect(html).toBe('<a href="https://example.com/story" target="_blank" rel="noopener noreferrer">Read more</a>')
  })

  it("preserves className, and the visible label stays the accessible name", () => {
    const html = renderToStaticMarkup(
      <ExternalArticleLink url="https://example.com/story" className="story-link">
        Read more
      </ExternalArticleLink>,
    )
    expect(html).toContain('class="story-link"')
    expect(html).toContain(">Read more<")
  })

  it("renders the fallback instead of a link when the URL is missing", () => {
    const html = renderToStaticMarkup(
      <ExternalArticleLink url={null} fallback={<span>No link</span>}>
        Read more
      </ExternalArticleLink>,
    )
    expect(html).toBe("<span>No link</span>")
  })

  it("renders the fallback instead of a link when the URL is malformed", () => {
    const html = renderToStaticMarkup(
      <ExternalArticleLink url="not a url" fallback={<span>No link</span>}>
        Read more
      </ExternalArticleLink>,
    )
    expect(html).toBe("<span>No link</span>")
  })

  it("falls back to the children when no explicit fallback is given", () => {
    const html = renderToStaticMarkup(<ExternalArticleLink url={null}>Read more</ExternalArticleLink>)
    expect(html).toBe("Read more")
  })
})
