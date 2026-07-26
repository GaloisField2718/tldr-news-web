/* eslint-disable @next/next/no-img-element -- Editorial assets must load directly from the immutable Worker URL. */
import Link from "next/link"
import { SearchField } from "@/components/search-field"
import { SectorNav } from "@/components/sector-nav"
import { IssueList } from "@/components/issue-list"
import { DailyPodcastListenActions } from "@/components/podcast-provider"
import { getLatestIssues, getSectors, getYears, getArchiveCatalogue } from "@/lib/archive"
import { getLatestPublishedDaily, getPublishedDailyPodcast } from "@/lib/daily-latest"
import { formatLongDate } from "@/lib/format"

export default function HomePage() {
  const latest = getLatestIssues(5)
  const sectors = getSectors()
  const years = getYears()
  const manifest = getArchiveCatalogue()
  const edition = getLatestPublishedDaily()
  const podcast = edition ? getPublishedDailyPodcast(edition.date) : undefined

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-9">
      {/* The latest edition leads the page; the archive remains one click away below. */}
      <section className="border-b border-border-strong pb-8" aria-labelledby="latest-edition-heading">
        {edition ? (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-faint-foreground">
              Latest Daily Edition ·{" "}
              <time dateTime={edition.date}>{formatLongDate(edition.date)}</time>
            </p>
            {edition.illustration && (
              <figure className="mt-4">
                <img
                  src={edition.illustration.src}
                  width={edition.illustration.width}
                  height={edition.illustration.height}
                  alt={edition.illustration.alt}
                  className="h-auto w-full border border-border"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
                <figcaption className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-faint-foreground">
                  {edition.illustration.attribution}
                </figcaption>
              </figure>
            )}
            <h1
              id="latest-edition-heading"
              className="mt-4 max-w-3xl font-serif text-[1.7rem] leading-[1.1] text-foreground text-balance md:text-[2.35rem]"
            >
              {edition.title}
            </h1>
            <p className="home-lede mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-foreground text-pretty">
              {edition.introduction}
            </p>
            {/* The page's primary action: given more weight than the surrounding text,
                with the counts as aligned metadata underneath rather than a trailing aside. */}
            <div className="mt-5">
              <Link
                href={`/daily/${edition.date}`}
                className="group inline-flex items-baseline gap-2 font-serif text-xl font-semibold text-foreground decoration-2 underline-offset-[6px] hover:text-accent hover:underline"
              >
                Read the edition
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <p className="mt-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {edition.articleCount} stories · {edition.issueCount} newsletters
              </p>
            </div>
            {podcast && <DailyPodcastListenActions date={edition.date} podcast={podcast} className="podcast-listen" />}
          </>
        ) : (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-faint-foreground">
              The TLDR Newsletter Archive
            </p>
            <h1
              id="latest-edition-heading"
              className="mt-3 max-w-3xl font-serif text-3xl leading-[1.08] text-foreground text-balance md:text-[2.6rem]"
            >
              A searchable index of every TLDR issue
            </h1>
            <p className="mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-foreground text-pretty">
              {manifest.total_issues.toLocaleString()} indexed issues across {sectors.length} sectors, normalized into
              sections and articles for close reading and research. No Daily edition is available yet.
            </p>
          </>
        )}

      </section>

      {/* A section of its own, so the front page reads as distinct from exploration. */}
      <section className="border-b border-border pb-7 pt-7" aria-labelledby="search-heading">
        <h2
          id="search-heading"
          className="font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground"
        >
          Search all editions
        </h2>
        <div className="mt-3 max-w-2xl">
          <SearchField size="lg" />
        </div>
        <p className="mt-2 font-sans text-xs text-muted-foreground">
          Or{" "}
          <Link href="/archive" className="underline underline-offset-4 hover:text-accent">
            browse the archive
          </Link>
          .
        </p>
      </section>

      <div className="grid grid-cols-1 gap-x-12 gap-y-12 pt-10 lg:grid-cols-[1fr_15rem]">
        {/* Latest issues as an editorial list */}
        <section aria-labelledby="latest-heading">
          <h2
            id="latest-heading"
            className="font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground"
          >
            Latest issues
          </h2>
          <div className="mt-4">
            <IssueList issues={latest} />
          </div>
          {/* The home shows a taste of the index; the rest belongs to Browse and Archive. */}
          <Link
            href="/archive"
            className="mt-4 inline-block font-sans text-xs text-muted-foreground underline underline-offset-4 hover:text-accent"
          >
            View all issues →
          </Link>
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
            <SectorNav sectors={sectors.slice(0, 6)} />
            {sectors.length > 6 && (
              <Link
                href="/archive"
                className="mt-3 inline-block font-sans text-xs text-muted-foreground underline underline-offset-4 hover:text-accent"
              >
                All {sectors.length} sectors →
              </Link>
            )}
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
