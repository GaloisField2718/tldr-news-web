import Link from "next/link"
import type { SectorSummary } from "@/lib/types"

interface SectorNavProps {
  sectors: SectorSummary[]
}

// Sectors presented as a compact typographic list, not a card grid.
export function SectorNav({ sectors }: SectorNavProps) {
  return (
    <ul className="flex flex-col">
      {sectors.map((sector, i) => (
        <li key={sector.sector_slug}>
          <Link
            href={`/search?sector=${sector.sector_slug}`}
            className={`group flex items-baseline justify-between gap-4 py-2.5 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <span className="font-sans text-sm text-foreground underline-offset-4 group-hover:text-accent group-hover:underline">
              {sector.sector}
            </span>
            <span className="font-mono text-xs tabular-nums text-faint-foreground">
              {sector.issue_count}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
