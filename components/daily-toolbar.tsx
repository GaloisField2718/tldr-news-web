import type { RefObject } from "react"
import Link from "next/link"
import type { DailyEditionNavigation } from "@/lib/daily-navigation"

export function DailyToolbar({
  navigation,
  immersive,
  contentsRef,
  fullscreenButtonRef,
  onShare,
  onToggleImmersive,
}: {
  navigation: DailyEditionNavigation
  immersive: boolean
  contentsRef: RefObject<HTMLDetailsElement | null>
  fullscreenButtonRef: RefObject<HTMLButtonElement | null>
  onShare: () => void
  onToggleImmersive: () => void
}) {
  return (
    <div className="daily-toolbar" data-daily-toolbar>
      <div className="daily-toolbar-primary">
        <Link href="/daily" className="daily-toolbar-link">Daily Editions</Link>
        <time dateTime={navigation.date} className="daily-toolbar-date">{navigation.formattedDate}</time>
        <nav aria-label="Newspaper pages" className="daily-inline-nav">
          {navigation.previousPageHref ? (
            <Link rel="prev" href={navigation.previousPageHref} aria-label="Previous newspaper page">
              <span aria-hidden="true">←</span><span className="daily-nav-label"> Previous</span>
            </Link>
          ) : <span aria-disabled="true"><span aria-hidden="true">←</span><span className="daily-nav-label"> Previous</span></span>}
          <span className="daily-page-count">Page {navigation.currentPage} of {navigation.pageCount}</span>
          {navigation.nextPageHref ? (
            <Link rel="next" href={navigation.nextPageHref} aria-label="Next newspaper page">
              <span className="daily-nav-label">Next </span><span aria-hidden="true">→</span>
            </Link>
          ) : <span aria-disabled="true"><span className="daily-nav-label">Next </span><span aria-hidden="true">→</span></span>}
        </nav>
        <details className="daily-contents" ref={contentsRef}>
          <summary>Contents</summary>
          <ol>
            {navigation.pages.map((item) => (
              <li key={item.number}>
                <Link href={item.href} aria-current={item.number === navigation.currentPage ? "page" : undefined}>
                  <span>Page {item.number}: {item.title}</span>
                  <small>{item.sectors.join(", ") || "Daily Index"} · {item.storyCount} stories</small>
                </Link>
              </li>
            ))}
          </ol>
        </details>
        <button type="button" className="daily-toolbar-button" onClick={onShare}>Share</button>
        <button
          ref={fullscreenButtonRef}
          type="button"
          className="daily-toolbar-button daily-fullscreen-button"
          aria-pressed={immersive}
          onClick={onToggleImmersive}
        >
          {immersive ? "Exit" : "Full screen"}
        </button>
        <details className="daily-help">
          <summary aria-label="Keyboard shortcuts">?</summary>
          <div>
            <strong>Keyboard shortcuts</strong>
            <dl>
              <dt>← / →</dt><dd>Previous / next page</dd>
              <dt>Home</dt><dd>First page</dd>
              <dt>End</dt><dd>Last page</dd>
              <dt>F</dt><dd>Full screen</dd>
              <dt>Escape</dt><dd>Exit immersive mode</dd>
            </dl>
          </div>
        </details>
      </div>
      <nav aria-label="Daily editions" className="daily-edition-nav">
        {navigation.previousEditionHref ? <Link href={navigation.previousEditionHref}>← Previous edition</Link> : <span aria-disabled="true">← Previous edition</span>}
        {navigation.latestEditionHref ? <Link href={navigation.latestEditionHref}>Latest edition</Link> : <span aria-disabled="true">Latest edition</span>}
        {navigation.nextEditionHref ? <Link href={navigation.nextEditionHref}>Next edition →</Link> : <span aria-disabled="true">Next edition →</span>}
      </nav>
    </div>
  )
}
