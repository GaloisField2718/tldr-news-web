import type { Metadata } from "next"
import { getArchiveIndex, getSectors } from "@/lib/archive"
import { ArchiveIndex } from "@/components/archive-index"
import { SectorNav } from "@/components/sector-nav"

export const metadata: Metadata = {
  title: "Archive",
  description: "Browse the complete TLDR archive by year, month, and sector.",
}

export default function ArchivePage() {
  const years = getArchiveIndex()
  const sectors = getSectors()
  const totalIssues = years.reduce((n, y) => n + y.issue_count, 0)

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <header className="border-b border-border-strong pb-8">
        <h1 className="font-serif text-3xl text-foreground md:text-4xl">Archive</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
          The complete index, organized by year and month. {totalIssues} issues
          across {sectors.length} sectors.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-x-12 gap-y-12 pt-10 lg:grid-cols-[1fr_14rem]">
        <div className="order-2 lg:order-1">
          <ArchiveIndex years={years} />
        </div>

        <aside className="order-1 lg:order-2 lg:border-l lg:border-border lg:pl-8">
          <h2 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground">
            Browse by sector
          </h2>
          <SectorNav sectors={sectors} />
        </aside>
      </div>
    </div>
  )
}
