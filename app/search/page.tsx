import type { Metadata } from "next"
import { SearchField } from "@/components/search-field"
import { SearchFilters } from "@/components/search-filters"
import { SearchResult } from "@/components/search-result"
import {
  getSectors,
  getYears,
  searchArticles,
  type ReadingTimeBucket,
} from "@/lib/archive"

export const metadata: Metadata = {
  title: "Search",
  description: "Search titles and summaries across the TLDR archive, filtered by sector, year, content type, and reading time.",
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const query = first(sp.q) ?? ""
  const sector = first(sp.sector) ?? "all"
  const year = first(sp.year) ?? "all"
  const contentType = first(sp.type) ?? "all"
  const readingTime = (first(sp.reading) ?? "any") as ReadingTimeBucket

  const sectors = getSectors()
  const years = getYears()

  const hasCriteria =
    query.trim() !== "" ||
    sector !== "all" ||
    year !== "all" ||
    contentType !== "all" ||
    readingTime !== "any"

  const results = hasCriteria
    ? searchArticles({ query, sector, year, contentType, readingTime })
    : []

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <header className="border-b border-border-strong pb-8">
        <h1 className="font-serif text-3xl text-foreground md:text-4xl">Search the archive</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
          Full-text search across article titles and summaries. Refine with
          sector, year, content type, and reading-time filters.
        </p>

        {/* Single GET form: query + filters submit together, keeping results shareable. */}
        <form action="/search" role="search" className="mt-6">
          <SearchField standalone={false} defaultValue={query} size="lg" autoFocus />
          <SearchFilters
            sectors={sectors}
            years={years}
            selected={{ sector, year, contentType, readingTime }}
          />
        </form>
      </header>

      <section aria-live="polite" className="pt-8">
        {!hasCriteria ? (
          <p className="font-sans text-sm text-muted-foreground">
            Enter a query or choose a filter to begin.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground">
                Results
              </h2>
              <span className="font-mono text-xs tabular-nums text-faint-foreground">
                {results.length} {results.length === 1 ? "match" : "matches"}
              </span>
            </div>

            {results.length === 0 ? (
              <p className="mt-6 font-sans text-sm text-muted-foreground">
                No entries match these criteria. Try broadening your filters.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {results.map((item) => (
                  <SearchResult key={item.article.id} item={item} query={query} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
