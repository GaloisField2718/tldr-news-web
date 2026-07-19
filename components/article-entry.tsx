import type { Article } from "@/lib/types"
import { ArticleMetadata } from "@/components/article-metadata"
import { ArrowUpRightIcon } from "@/components/icons"

interface ArticleEntryProps {
  article: Article
}

// A single article within an issue section. Sponsored entries are clearly
// differentiated with a left rule, soft tint, and an explicit label — never
// disguised as editorial content.
export function ArticleEntry({ article }: ArticleEntryProps) {
  const sponsored = article.is_sponsor

  const titleContent = (
    <span className="inline">
      {article.title}
      {article.url && (
        <ArrowUpRightIcon
          className="ml-1 inline h-3.5 w-3.5 -translate-y-px text-faint-foreground transition-colors group-hover:text-accent"
          aria-hidden="true"
        />
      )}
    </span>
  )

  return (
    <article
      className={
        sponsored
          ? "border-l-2 border-accent bg-accent-soft/60 py-4 pl-4"
          : "py-4"
      }
    >
      {sponsored && (
        <p className="mb-1.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-accent">
          Sponsored
        </p>
      )}

      <h3 className="font-serif text-lg leading-snug text-pretty md:text-xl">
        {article.url ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group text-foreground underline-offset-4 hover:text-accent hover:underline"
          >
            {titleContent}
          </a>
        ) : (
          <span className="group text-foreground">
            {titleContent}
            <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-wider text-faint-foreground">
              no link
            </span>
          </span>
        )}
      </h3>

      <p className="mt-1.5 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-foreground text-pretty">
        {article.summary}
      </p>

      <div className="mt-2">
        <ArticleMetadata article={article} />
      </div>
    </article>
  )
}
