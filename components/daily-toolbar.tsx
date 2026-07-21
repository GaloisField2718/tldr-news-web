import Link from "next/link"
import type { DailyEdition } from "@/lib/daily-types"

function pageHref(date: string, page: number): string {
  return page === 1 ? `/daily/${date}` : `/daily/${date}?page=${page}`
}

export function DailyToolbar({
  edition,
  page,
  previousDate,
  nextDate,
  latestDate,
}: {
  edition: DailyEdition
  page: number
  previousDate?: string
  nextDate?: string
  latestDate?: string
}) {
  const pageCount = edition.pages.length
  return (
    <div className="daily-toolbar">
      <div className="daily-toolbar-row">
        <Link href="/daily" className="daily-toolbar-link">Daily Editions</Link>
        <span className="daily-page-count">{page} of {pageCount}</span>
        <span className="daily-toolbar-date">{edition.date}</span>
      </div>
      <div className="daily-toolbar-row daily-toolbar-actions">
        <nav aria-label="Newspaper pages" className="daily-inline-nav">
          {page > 1 ? <Link rel="prev" href={pageHref(edition.date, page - 1)}>← Previous page</Link> : <span aria-disabled="true">← Previous page</span>}
          {page < pageCount ? <Link rel="next" href={pageHref(edition.date, page + 1)}>Next page →</Link> : <span aria-disabled="true">Next page →</span>}
        </nav>
        <details className="daily-contents">
          <summary>Contents</summary>
          <ol>
            {edition.pages.map((item) => (
              <li key={item.number}>
                <Link href={pageHref(edition.date, item.number)} aria-current={item.number === page ? "page" : undefined}>
                  <span>Page {item.number}: {item.title ?? "Daily Edition"}</span>
                  <small>{item.sectors.join(", ") || "Daily Index"} · {item.slots.length} stories</small>
                </Link>
              </li>
            ))}
          </ol>
        </details>
      </div>
      <nav aria-label="Daily editions" className="daily-edition-nav">
        {previousDate ? <Link href={`/daily/${previousDate}`}>← Previous edition</Link> : <span aria-disabled="true">← Previous edition</span>}
        {latestDate && latestDate !== edition.date ? <Link href={`/daily/${latestDate}`}>Latest edition</Link> : <span aria-disabled="true">Latest edition</span>}
        {nextDate ? <Link href={`/daily/${nextDate}`}>Next edition →</Link> : <span aria-disabled="true">Next edition →</span>}
      </nav>
    </div>
  )
}
