import type { SectorSummary, ContentType } from "@/lib/types"
import { CONTENT_TYPE_LABELS } from "@/lib/archive"

interface SearchFiltersProps {
  sectors: SectorSummary[]
  years: number[]
  selected: {
    sector: string
    year: string
    contentType: string
    readingTime: string
  }
}

const READING_TIMES: { value: string; label: string }[] = [
  { value: "any", label: "Any length" },
  { value: "short", label: "Short · ≤ 4 min" },
  { value: "medium", label: "Medium · 5–9 min" },
  { value: "long", label: "Long · 10+ min" },
]

const CONTENT_TYPES = Object.entries(CONTENT_TYPE_LABELS) as [ContentType, string][]

function Field({
  label,
  name,
  value,
  children,
}: {
  label: string
  name: string
  value: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="border border-border-strong bg-surface px-2.5 py-2 font-sans text-sm text-foreground focus:border-accent focus:outline-none"
      >
        {children}
      </select>
    </label>
  )
}

// Filters render as native selects inside the parent GET form, so the whole
// search remains server-driven and shareable. On mobile they collapse into a
// <details> disclosure to keep the input dominant.
export function SearchFilters({ sectors, years, selected }: SearchFiltersProps) {
  const fields = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Sector" name="sector" value={selected.sector}>
        <option value="all">All sectors</option>
        {sectors.map((s) => (
          <option key={s.sector_slug} value={s.sector_slug}>
            {s.sector}
          </option>
        ))}
      </Field>

      <Field label="Year" name="year" value={selected.year}>
        <option value="all">All years</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </Field>

      <Field label="Content type" name="type" value={selected.contentType}>
        <option value="all">All types</option>
        {CONTENT_TYPES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Field>

      <Field label="Reading time" name="reading" value={selected.readingTime}>
        {READING_TIMES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Field>
    </div>
  )

  return (
    <div className="mt-4">
      {/* Desktop: always visible */}
      <div className="hidden sm:block">{fields}</div>

      {/* Mobile: collapsible disclosure */}
      <details className="group sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between border border-border-strong bg-surface px-3 py-2.5 font-sans text-sm text-foreground">
          <span className="font-medium">Filters</span>
          <span className="font-mono text-xs text-faint-foreground group-open:hidden">show</span>
          <span className="hidden font-mono text-xs text-faint-foreground group-open:inline">
            hide
          </span>
        </summary>
        <div className="mt-4">{fields}</div>
      </details>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          className="border border-accent bg-accent px-4 py-2 font-sans text-sm font-medium text-background transition-colors hover:bg-accent-hover"
        >
          Apply
        </button>
        <a
          href="/search"
          className="font-sans text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
        >
          Reset
        </a>
      </div>
    </div>
  )
}
