import Link from "next/link"
import { SearchField } from "@/components/search-field"
import { SectorNav } from "@/components/sector-nav"
import { IssueList } from "@/components/issue-list"
import { getLatestIssues, getSectors, getYears, getManifest } from "@/lib/archive"

export default function HomePage() {
  const latest = getLatestIssues(6)
  const sectors = getSectors()
  const years = getYears()
  const manifest = getManifest()

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      {/* Masthead — restrained, editorial, no marketing hero */}
      <section className="border-b border-border-strong pb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-faint-foreground">
          The TLDR Newsletter Archive
        </p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[1.05] text-foreground text-balance md:text-5xl">
          A searchable index of every TLDR issue
        </h1>
        <p className="mt-4 max-w-2xl font-sans text-base leading-relaxed text-muted-foreground text-pretty">
          {manifest.total_issues.toLocaleString()} indexed issues across{" "}
          {sectors.length} sectors, normalized into sections and articles for
          close reading and research.
        </p>

        <div className="mt-6 max-w-2xl">
          <SearchField size="lg" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-x-12 gap-y-12 pt-10 lg:grid-cols-[1fr_15rem]">
        {/* Latest issues as an editorial list */}
        <section aria-labelledby="latest-heading">
          <div className="flex items-baseline justify-between">
            <h2
              id="latest-heading"
              className="font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground"
            >
              Latest issues
            </h2>
            <Link
              href="/archive"
              className="font-sans text-xs text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
            >
              Full archive
            </Link>
          </div>
          <div className="mt-4">
            <IssueList issues={latest} />
          </div>
        </section>

        {/* Sectors + years, visible but not dominating */}
        <aside className="flex flex-col gap-10 lg:border-l lg:border-border lg:pl-8">
          <section aria-labelledby="sectors-heading">
            <h2
              id="sectors-heading"
              className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground"
            >
              Sectors
            </h2>
            <SectorNav sectors={sectors} />
          </section>

          <section aria-labelledby="years-heading">
            <h2
              id="years-heading"
              className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground"
            >
              By year
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {years.map((year) => (
                <li key={year}>
                  <Link
                    href={`/search?year=${year}`}
                    className="font-mono text-sm tabular-nums text-foreground underline-offset-4 hover:text-accent hover:underline"
                  >
                    {year}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
