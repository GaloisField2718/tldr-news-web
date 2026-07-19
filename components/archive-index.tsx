import Link from "next/link"
import type { ArchiveYear } from "@/lib/archive"
import { formatMonoDate } from "@/lib/format"

interface ArchiveIndexProps {
  years: ArchiveYear[]
}

// A typographic index of the archive: years as sections, months as sub-groups,
// issues as ruled rows. Deliberately avoids any calendar-widget aesthetic.
export function ArchiveIndex({ years }: ArchiveIndexProps) {
  return (
    <div className="flex flex-col gap-14">
      {years.map((year) => (
        <section key={year.year} aria-labelledby={`year-${year.year}`}>
          <div className="flex items-baseline justify-between border-b border-border-strong pb-2">
            <h2
              id={`year-${year.year}`}
              className="font-serif text-2xl text-foreground md:text-3xl"
            >
              {year.year}
            </h2>
            <span className="font-mono text-xs tabular-nums text-faint-foreground">
              {year.issue_count} {year.issue_count === 1 ? "issue" : "issues"}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-8">
            {year.months.map((month) => (
              <div
                key={`${year.year}-${month.month}`}
                className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-[9rem_1fr]"
              >
                <h3 className="font-sans text-sm font-semibold uppercase tracking-widest text-muted-foreground md:pt-2">
                  {month.monthLabel}
                </h3>

                <ul className="divide-y divide-border border-t border-border">
                  {month.issues.map((issue) => (
                    <li key={issue.issue_id}>
                      <Link
                        href={`/issues/${issue.sector_slug}/${issue.date}`}
                        className="group flex items-baseline justify-between gap-4 py-2.5"
                      >
                        <span className="flex min-w-0 items-baseline gap-3">
                          <time
                            dateTime={issue.date}
                            className="font-mono text-xs tabular-nums text-faint-foreground"
                          >
                            {formatMonoDate(issue.date)}
                          </time>
                          <span className="truncate font-sans text-sm text-foreground underline-offset-4 group-hover:text-accent group-hover:underline">
                            {issue.sector}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-faint-foreground">
                          {issue.article_count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
