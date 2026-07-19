import Link from "next/link"
import type { SearchResultItem } from "@/lib/archive"
import { ArticleMetadata } from "@/components/article-metadata"
import { ArrowUpRightIcon } from "@/components/icons"
import { formatMonoDate } from "@/lib/format"

interface SearchResultProps {
  item: SearchResultItem
  query?: string
}

// Highlights case-insensitive query matches within a text run.
function highlight(text: string, query?: string): React.ReactNode {
  const q = query?.trim()
  if (!q) return text
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < text.length) {
    const found = lower.indexOf(needle, i)
    if (found === -1) {
      parts.push(text.slice(i))
      break
    }
    if (found > i) parts.push(text.slice(i, found))
    parts.push(
      <mark key={key++} className="bg-accent-soft text-accent-hover">
        {text.slice(found, found + needle.length)}
      </mark>,
    )
    i = found + needle.length
  }
  return parts
}

// A dense, readable result row. No card — hairline separation only.
export function SearchResult({ item, query }: SearchResultProps) {
  const { article } = item
  const issueHref = `/issues/${item.sector_slug}/${item.date}`

  const sectorExtra = (
    <Link
      href={issueHref}
      className="text-accent underline-offset-4 hover:underline"
    >
      {item.sector}
    </Link>
  )

  return (
    <article className={item.article.is_sponsor ? "border-l-2 border-accent pl-4 py-4" : "py-4"}>
      {article.is_sponsor && (
        <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-widest text-accent">
          Sponsored
        </p>
      )}

      <h3 className="font-serif text-lg leading-snug text-pretty">
        {article.url ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group text-foreground underline-offset-4 hover:text-accent hover:underline"
          >
            {highlight(article.title, query)}
            <ArrowUpRightIcon
              className="ml-1 inline h-3.5 w-3.5 -translate-y-px text-faint-foreground group-hover:text-accent"
              aria-hidden="true"
            />
          </a>
        ) : (
          <span className="text-foreground">{highlight(article.title, query)}</span>
        )}
      </h3>

      <p className="mt-1.5 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground text-pretty">
        {highlight(article.summary, query)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs tabular-nums text-faint-foreground">
          {formatMonoDate(item.date)}
        </span>
        <span aria-hidden="true" className="text-border-strong">
          ·
        </span>
        <ArticleMetadata article={article} extra={sectorExtra} />
      </div>
    </article>
  )
}
