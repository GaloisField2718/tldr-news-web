import Link from "next/link"
import type { IssueListItem } from "@/lib/types"
import { formatLongDate, formatMonoDate } from "@/lib/format"

interface IssueListRowProps {
  issue: IssueListItem
  /** Hide the sector label when the surrounding list is already sector-scoped. */
  showSector?: boolean
}

// A single editorial row: date rail, title, and metadata. No enclosing card.
export function IssueListRow({ issue, showSector = true }: IssueListRowProps) {
  const href = `/issues/${issue.sector_slug}/${issue.date}`
  return (
    <article>
      <Link
        href={href}
        className="group grid grid-cols-1 items-baseline gap-y-1 py-4 md:grid-cols-[7.5rem_1fr] md:gap-x-6"
      >
        <time
          dateTime={issue.date}
          className="font-mono text-xs tabular-nums text-faint-foreground md:text-[13px]"
        >
          {formatMonoDate(issue.date)}
        </time>

        <div className="min-w-0">
          <h3 className="font-serif text-lg leading-snug text-foreground text-pretty underline-offset-4 group-hover:text-accent group-hover:underline md:text-xl">
            {issue.title}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-muted-foreground">
            {showSector && (
              <span className="uppercase tracking-wide text-accent">{issue.sector}</span>
            )}
            <span className="text-faint-foreground">{formatLongDate(issue.date)}</span>
            <span aria-hidden="true" className="text-border-strong">
              ·
            </span>
            <span>
              {issue.section_count} sections · {issue.article_count} entries
            </span>
            {issue.parse_status !== "complete" && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
                {issue.parse_status} parse
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
