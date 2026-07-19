import type { Metadata } from "next"
import Link from "next/link"
import { SearchField } from "@/components/search-field"
import { SearchFilters } from "@/components/search-filters"
import { SearchResult } from "@/components/search-result"
import { getSectors, getYears } from "@/lib/archive"
import {
  normalizeSearchPage,
  searchArticles,
  SEARCH_PAGE_SIZE,
  validateSearchFilters,
  type SearchPageResult,
} from "@/lib/search"

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

function paginationHref(
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(searchParams)) {
    const selected = first(value)
    if (selected !== undefined) params.set(name, selected)
  }
  params.set("page", String(page))
  return `/search?${params.toString()}`
}

function emptySearchPage(page: number): SearchPageResult {
  return {
    items: [],
    total: 0,
    page,
    page_size: SEARCH_PAGE_SIZE,
    page_count: 0,
  }
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const query = first(sp.q) ?? ""
  const requestedSector = first(sp.sector) ?? "all"
  const requestedYear = first(sp.year) ?? "all"
  const requestedContentType = first(sp.type) ?? "all"
  const requestedReadingTime = first(sp.reading) ?? "any"
  const requestedPage = first(sp.page)
  const page = normalizeSearchPage(requestedPage)

  const sectors = getSectors()
  const years = getYears()
  const filters = validateSearchFilters({
    sector: requestedSector,
    year: requestedYear,
    contentType: requestedContentType,
    readingTime: requestedReadingTime,
  })

  const hasCriteria =
    query.trim() !== "" ||
    requestedSector !== "all" ||
    requestedYear !== "all" ||
    requestedContentType !== "all" ||
    requestedReadingTime !== "any"

  const results = hasCriteria
    ? searchArticles({
        query,
        sector: requestedSector,
        year: requestedYear,
        contentType: requestedContentType,
        readingTime: requestedReadingTime,
        page: requestedPage,
      })
    : emptySearchPage(page)

  const previousPage =
    results.page_count > 0 && results.page > 1
      ? Math.min(results.page - 1, results.page_count)
      : null
  const nextPage = results.page < results.page_count ? results.page + 1 : null

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <header className="border-b border-border-strong pb-8">
        <h1 className="font-serif text-3xl text-foreground md:text-4xl">Search the archive</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
          Full-text search across article titles and summaries. Refine with
          sector, year, content type, and reading-time filters.
        </p>

        {/* Omitting page resets pagination to page 1 on every new form submission. */}
        <form action="/search" role="search" className="mt-6">
          <SearchField standalone={false} defaultValue={query} size="lg" autoFocus />
          <SearchFilters
            sectors={sectors}
            years={years}
            selected={{
              sector: filters.sector,
              year: filters.year,
              contentType: filters.contentType,
              readingTime: filters.readingTime,
            }}
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
                {results.total.toLocaleString()} {results.total === 1 ? "match" : "matches"}
              </span>
            </div>

            {results.total === 0 ? (
              <p className="mt-6 font-sans text-sm text-muted-foreground">
                No entries match these criteria. Try broadening your filters.
              </p>
            ) : results.items.length === 0 ? (
              <p className="mt-6 font-sans text-sm text-muted-foreground">
                No entries are available on this page.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {results.items.map((item, index) => (
                  <SearchResult
                    key={`${item.issue_id}-${item.section_heading}-${item.article.id}-${index}`}
                    item={item}
                    query={query}
                  />
                ))}
              </div>
            )}

            {results.page_count > 0 && (
              <nav
                aria-label="Search result pages"
                className="mt-8 flex items-center justify-between border-t border-border pt-4"
              >
                <div>
                  {previousPage !== null && (
                    <Link
                      href={paginationHref(sp, previousPage)}
                      rel="prev"
                      className="font-sans text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
                    >
                      Previous
                    </Link>
                  )}
                </div>
                <span className="font-mono text-xs tabular-nums text-faint-foreground">
                  Page {results.page.toLocaleString()} of {results.page_count.toLocaleString()}
                </span>
                <div>
                  {nextPage !== null && (
                    <Link
                      href={paginationHref(sp, nextPage)}
                      rel="next"
                      className="font-sans text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  )
}
