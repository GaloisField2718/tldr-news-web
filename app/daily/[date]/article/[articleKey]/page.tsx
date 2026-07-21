import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getDailyArticlePosition, isValidDailyDate } from "@/lib/daily"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ date: string; articleKey: string }>
}

const CONTENT_LABELS: Record<string, string> = {
  github_repo: "GitHub repository",
  course: "Course",
  tool: "Tool",
}

function pageHref(date: string, page: number): string {
  return page === 1 ? `/daily/${date}` : `/daily/${date}?page=${page}`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date, articleKey } = await params
  if (!isValidDailyDate(date)) return { title: "Daily article not found" }
  const position = getDailyArticlePosition(date, articleKey)
  if (!position) return { title: "Daily article not found" }
  const title = position.article.title.trim() || "Untitled entry"
  const summary = position.article.summary.trim()
  return {
    title,
    description: `${summary.slice(0, 150)}${summary.length > 150 ? "…" : ""} — ${position.article.sector}, ${date}`,
    alternates: { canonical: `/daily/${date}/article/${articleKey}` },
  }
}

export default async function DailyArticlePage({ params }: PageProps) {
  const { date, articleKey } = await params
  if (!isValidDailyDate(date)) notFound()
  const position = getDailyArticlePosition(date, articleKey)
  if (!position) notFound()
  const { article } = position
  const title = article.title.trim() || "Untitled entry"
  const summary = article.summary.trim()
  const contentLabel = CONTENT_LABELS[article.content_type]

  return (
    <div className="daily-reader-shell">
      <nav aria-label="Daily reader" className="daily-reader-toolbar">
        <Link href={pageHref(date, position.page)}>← Back to page {position.page}</Link>
        <span>{position.index + 1} of {position.total}</span>
      </nav>
      <article className="daily-reader">
        <header>
          <p className="daily-reader-kicker">
            {article.is_sponsor ? <strong>Sponsored · </strong> : null}{article.sector} · {article.section_heading || "Newsletter entry"}
          </p>
          <h1>{title}</h1>
          <div className="daily-reader-meta">
            <time dateTime={date}>{date}</time>
            {article.source_domain && <span>{article.source_domain}</span>}
            {article.reading_time_minutes !== null && <span>{article.reading_time_minutes} min read</span>}
            {contentLabel && <span>{contentLabel}</span>}
          </div>
        </header>
        <section aria-labelledby="summary-heading" className="daily-reader-summary">
          <h2 id="summary-heading">Summary from the {article.sector} newsletter</h2>
          {summary ? <p>{summary}</p> : <p className="daily-reader-unavailable">Summary unavailable.</p>}
        </section>
        {article.occurrences.length > 1 && (
          <aside className="daily-reader-occurrences" aria-labelledby="also-heading">
            <h2 id="also-heading">Also appeared in</h2>
            <ul>
              {article.occurrences.filter((occurrence) => occurrence.article_key !== article.article_key).map((occurrence) => (
                <li key={occurrence.article_key}>
                  <Link href={occurrence.issue_route}>{occurrence.issue_title || occurrence.sector}</Link>
                  <span> · {occurrence.section_heading || "Newsletter entry"}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
        <div className="daily-reader-actions">
          {article.url ? (
            <a href={article.url} target="_blank" rel="noopener noreferrer">Read the original article ↗</a>
          ) : (
            <span>Original link unavailable</span>
          )}
          <Link href={article.issue_route}>View the archived {article.sector} issue</Link>
        </div>
      </article>
      <nav aria-label="Articles in this edition" className="daily-reader-pager">
        {position.previousKey ? <Link href={`/daily/${date}/article/${position.previousKey}`}>← Previous article</Link> : <span aria-disabled="true">← Previous article</span>}
        <Link href={pageHref(date, position.page)}>Newspaper page {position.page}</Link>
        {position.nextKey ? <Link href={`/daily/${date}/article/${position.nextKey}`}>Next article →</Link> : <span aria-disabled="true">Next article →</span>}
      </nav>
    </div>
  )
}
