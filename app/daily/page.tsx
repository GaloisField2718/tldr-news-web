import Link from "next/link"
import { redirect } from "next/navigation"
import { getLatestDailyDate } from "@/lib/daily"

export const dynamic = "force-dynamic"

export default function DailyIndexPage() {
  let latest: string | undefined
  try {
    latest = getLatestDailyDate()
  } catch {
    latest = undefined
  }
  if (latest) redirect(`/daily/${latest}`)
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 text-center md:px-8">
      <p className="font-mono text-xs uppercase tracking-widest text-faint-foreground">Daily Editions</p>
      <h1 className="mt-3 font-serif text-4xl">The Daily Index is unavailable</h1>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        No readable Daily edition has been generated yet. The newsletter archive remains available.
      </p>
      <Link href="/archive" className="mt-6 inline-block text-sm underline underline-offset-4 hover:text-accent">Browse the archive</Link>
    </div>
  )
}
