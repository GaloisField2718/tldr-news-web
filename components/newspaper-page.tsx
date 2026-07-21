import Link from "next/link"
import type { DailyArticle, DailyPage } from "@/lib/daily-types"

const CONTENT_LABELS: Record<string, string> = {
  github_repo: "GitHub repository",
  course: "Course",
  tool: "Tool",
}

function balancedGridSpan(index: number, total: number, start: number): number {
  const position = index - start
  const count = total - start
  const remainder = count % 3
  if (remainder === 1 && position === count - 1) return 12
  if (remainder === 2 && position >= count - 2) return 6
  return 4
}

function storySpan(page: DailyPage, index: number): number {
  const total = page.slots.length
  if (page.template === "front-page") {
    if (index === 0) return total === 1 ? 12 : 8
    if (index === 1) return 4
    if (index < 5) return 12 / Math.min(3, total - 2)
    return 12 / Math.min(4, total - 5)
  }
  if (page.template === "section-lead") {
    if (total === 1) return 12
    if (index === 0) return 8
    if (index === 1) return 4
    return balancedGridSpan(index, total, 2)
  }
  return balancedGridSpan(index, total, 0)
}

function DailyStory({ article, role, span }: { article: DailyArticle; role: string; span: number }) {
  const href = `/daily/${article.date}/article/${article.article_key}`
  const title = article.title.trim() || "Untitled entry"
  const summary = article.summary.trim()
  return (
    <article className={`daily-story daily-story-${role} daily-story-span-${span}`}>
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
        {page.slots.map((slot, index) => {
          const article = byKey.get(slot.article_key)
          return article ? <DailyStory key={slot.article_key} article={article} role={slot.role} span={storySpan(page, index)} /> : null
        })}
      </div>
      <footer className="newspaper-page-footer">
        <span>TLDR Index</span><span>Page {page.number}</span>
      </footer>
    </article>
  )
}
