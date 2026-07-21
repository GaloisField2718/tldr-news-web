import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DailyEditionShell } from "@/components/daily-edition-shell"
import { NewspaperPage } from "@/components/newspaper-page"
import { createDailyEditionNavigation } from "@/lib/daily-navigation"
import {
  getDailyEdition,
  getLatestDailyDate,
  getNextDailyDate,
  getPreviousDailyDate,
  isValidDailyDate,
  normalizeDailyPage,
} from "@/lib/daily"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ date: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

function formatToolbarDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params
  if (!isValidDailyDate(date)) return { title: "Daily edition not found" }
  const edition = getDailyEdition(date)
  if (!edition) return { title: "Daily edition not found" }
  const sectors = new Set(edition.issues.filter((issue) => issue.available).map((issue) => issue.sector_slug))
  return {
    title: `The Daily Index — ${formatDate(date)}`,
    description: `${edition.articles.length} unique stories from ${sectors.size} represented TLDR newsletters in the ${formatDate(date)} Daily Index.`,
    alternates: { canonical: `/daily/${date}` },
  }
}

export default async function DailyEditionPage({ params, searchParams }: PageProps) {
  const { date } = await params
  if (!isValidDailyDate(date)) notFound()
  const edition = getDailyEdition(date)
  if (!edition) notFound()
  const requestedPage = normalizeDailyPage(first((await searchParams).page))
  if (edition.pages.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-faint-foreground">Daily Edition · {date}</p>
        <h1 className="mt-3 font-serif text-4xl">No readable stories in this edition</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">The source issues are recorded, but no readable article summaries were available for this date.</p>
      </div>
    )
  }
  if (requestedPage > edition.pages.length) notFound()
  const selected = edition.pages[requestedPage - 1]
  const selectedKeys = new Set(selected.slots.map((slot) => slot.article_key))
  const articles = edition.articles.filter((article) => selectedKeys.has(article.article_key))
  const navigation = createDailyEditionNavigation({
    date,
    formattedDate: formatToolbarDate(date),
    currentPage: requestedPage,
    pages: edition.pages,
    previousDate: getPreviousDailyDate(date),
    nextDate: getNextDailyDate(date),
    latestDate: getLatestDailyDate(),
  })

  return (
    <div className="daily-viewer">
      <DailyEditionShell navigation={navigation}>
        <NewspaperPage page={selected} articles={articles} formattedDate={formatDate(date)} />
      </DailyEditionShell>
    </div>
  )
}
