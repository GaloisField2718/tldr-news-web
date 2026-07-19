import Link from "next/link"
import type { Issue } from "@/lib/types"
import { formatLongDate } from "@/lib/format"

interface IssueHeaderProps {
  issue: Issue
}

export function IssueHeader({ issue }: IssueHeaderProps) {
  const articleCount = issue.sections.reduce((n, s) => n + s.articles.length, 0)

  return (
    <header className="border-b border-border-strong pb-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs">
        <Link
          href={`/search?sector=${issue.sector_slug}`}
          className="uppercase tracking-widest text-accent underline-offset-4 hover:underline"
        >
          {issue.sector}
        </Link>
        <span aria-hidden="true" className="text-border-strong">
          /
        </span>
        <time dateTime={issue.date} className="font-mono text-faint-foreground">
          {formatLongDate(issue.date)}
        </time>
      </div>

      <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground text-balance md:text-4xl">
        {issue.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-faint-foreground">
        <span>{issue.sections.length} sections</span>
        <span aria-hidden="true">·</span>
        <span>{articleCount} entries</span>
        <span aria-hidden="true">·</span>
        <span>{issue.format_family.replaceAll("_", " ")}</span>
        <span aria-hidden="true">·</span>
        <span
          className={
            issue.parse_status === "complete" ? "text-faint-foreground" : "text-accent"
          }
        >
          {issue.parse_status} parse
        </span>
      </div>

      {issue.parse_warnings.length > 0 && (
        <div className="mt-4 border-l-2 border-accent bg-accent-soft px-4 py-2.5">
          <p className="font-sans text-xs font-medium uppercase tracking-wide text-accent-hover">
            Parse notes
          </p>
          <ul className="mt-1 list-inside list-disc font-sans text-sm text-foreground">
            {issue.parse_warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
