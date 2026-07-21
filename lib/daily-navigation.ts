import type { DailyPage } from "./daily-types"

export interface DailyPageNavigationItem {
  number: number
  title: string
  sectors: string[]
  storyCount: number
  href: string
}

export interface DailyEditionNavigation {
  date: string
  formattedDate: string
  currentPage: number
  pageCount: number
  previousPageHref?: string
  nextPageHref?: string
  firstPageHref: string
  lastPageHref: string
  previousEditionHref?: string
  nextEditionHref?: string
  latestEditionHref?: string
  pages: DailyPageNavigationItem[]
}

export function dailyPageHref(date: string, page: number): string {
  return page === 1 ? `/daily/${date}` : `/daily/${date}?page=${page}`
}

export function exactDailyPageUrl(origin: string, date: string, page: number): string {
  return new URL(dailyPageHref(date, page), origin).toString()
}

export function createDailyEditionNavigation({
  date,
  formattedDate,
  currentPage,
  pages,
  previousDate,
  nextDate,
  latestDate,
}: {
  date: string
  formattedDate: string
  currentPage: number
  pages: DailyPage[]
  previousDate?: string
  nextDate?: string
  latestDate?: string
}): DailyEditionNavigation {
  const pageCount = pages.length
  return {
    date,
    formattedDate,
    currentPage,
    pageCount,
    previousPageHref: currentPage > 1 ? dailyPageHref(date, currentPage - 1) : undefined,
    nextPageHref: currentPage < pageCount ? dailyPageHref(date, currentPage + 1) : undefined,
    firstPageHref: dailyPageHref(date, 1),
    lastPageHref: dailyPageHref(date, pageCount),
    previousEditionHref: previousDate ? dailyPageHref(previousDate, 1) : undefined,
    nextEditionHref: nextDate ? dailyPageHref(nextDate, 1) : undefined,
    latestEditionHref: latestDate && latestDate !== date ? dailyPageHref(latestDate, 1) : undefined,
    pages: pages.map((page) => ({
      number: page.number,
      title: page.title ?? "Daily Edition",
      sectors: [...page.sectors],
      storyCount: page.slots.length,
      href: dailyPageHref(date, page.number),
    })),
  }
}
