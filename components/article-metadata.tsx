import type { Article } from "@/lib/types"
import { formatReadingTime } from "@/lib/format"
import { CONTENT_TYPE_LABELS } from "@/lib/archive"

interface ArticleMetadataProps {
  article: Article
  /** Optional trailing metadata (e.g. section or sector) for search results. */
  extra?: React.ReactNode
}

// Inline metadata line: domain, reading time, and content type.
// Tolerant of missing domain and reading time.
export function ArticleMetadata({ article, extra }: ArticleMetadataProps) {
  const readingTime = formatReadingTime(article.reading_time_minutes)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-muted-foreground">
      {article.source_domain ? (
        <span className="font-mono text-faint-foreground">{article.source_domain}</span>
      ) : (
        <span className="font-mono italic text-faint-foreground">source unknown</span>
      )}

      {readingTime && (
        <>
          <span aria-hidden="true" className="text-border-strong">
            ·
          </span>
          <span>{readingTime}</span>
        </>
      )}

      {article.content_type !== "editorial" && (
        <>
          <span aria-hidden="true" className="text-border-strong">
            ·
          </span>
          <span className="uppercase tracking-wide">
            {CONTENT_TYPE_LABELS[article.content_type]}
          </span>
        </>
      )}

      {extra && (
        <>
          <span aria-hidden="true" className="text-border-strong">
            ·
          </span>
          {extra}
        </>
      )}
    </div>
  )
}
