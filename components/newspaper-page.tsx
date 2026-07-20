import Link from "next/link"
import type { DailyArticle, DailyPage } from "@/lib/daily-types"

const CONTENT_LABELS: Record<string, string> = {
  github_repo: "GitHub repository",
  course: "Course",
  tool: "Tool",
}

function DailyStory({ article, role }: { article: DailyArticle; role: string }) {
  const href = `/daily/${article.date}/article/${article.article_key}`
  const title = article.title.trim() || "Untitled entry"
  const summary = article.summary.trim()
  return (
    <article className={`daily-story daily-story-${role}`}>
      <p className="daily-story-label">
        {article.is_sponsor ? "Sponsored · " : ""}{article.sector}
        {CONTENT_LABELS[article.content_type] ? ` · ${CONTENT_LABELS[article.content_type]}` : ""}
      </p>
      <h3><Link href={href}>{title}</Link></h3>
      {summary ? <p className="daily-story-summary"><Link href={href}>{summary}</Link></p> : <p className="daily-story-empty">Summary unavailable</p>}
      <p className="daily-story-meta">
        {article.source_domain ?? "Source unavailable"}
        {article.reading_time_minutes !== null ? ` · ${article.reading_time_minutes} min` : ""}
      </p>
    </article>
  )
}

export function NewspaperPage({
  page,
  articles,
  formattedDate,
}: {
  page: DailyPage
  articles: DailyArticle[]
  formattedDate: string
}) {
  const byKey = new Map(articles.map((article) => [article.article_key, article]))
  return (
    <article className={`newspaper-sheet newspaper-${page.template}`} aria-labelledby="newspaper-page-title">
      <header className="newspaper-masthead">
        <p className="newspaper-edition-label">Daily Edition · Page {page.number}</p>
        <h1>THE DAILY INDEX</h1>
        <div className="newspaper-deck">
          <span>Technology, AI, software, security, crypto and business</span>
          <time dateTime={articles[0]?.date}>{formattedDate}</time>
        </div>
      </header>
      <div className="newspaper-page-heading">
        {page.kicker && <p>{page.kicker}</p>}
        <h2 id="newspaper-page-title">{page.title ?? "Daily Edition"}</h2>
      </div>
      <div className="newspaper-grid">
        {page.slots.map((slot) => {
          const article = byKey.get(slot.article_key)
          return article ? <DailyStory key={slot.article_key} article={article} role={slot.role} /> : null
        })}
      </div>
      <footer className="newspaper-page-footer">
        <span>TLDR Index</span><span>Page {page.number}</span>
      </footer>
    </article>
  )
}
