import { SearchIcon } from "@/components/icons"

interface SearchFieldProps {
  /** Where the standalone GET form submits. Defaults to the search page. */
  action?: string
  /** Set false when the field is already inside a form. */
  standalone?: boolean
  defaultValue?: string
  size?: "lg" | "md"
  autoFocus?: boolean
  label?: string
}

function SearchInput({
  defaultValue = "",
  size = "md",
  autoFocus = false,
  label = "Search the archive",
}: Omit<SearchFieldProps, "action" | "standalone">) {
  const isLarge = size === "lg"
  return (
    <>
      <label htmlFor="q" className="sr-only">
        {label}
      </label>
      <div
        className={`flex items-center border border-border-strong bg-surface ${
          isLarge ? "px-4" : "px-3"
        }`}
      >
        <SearchIcon
          className={`shrink-0 text-faint-foreground ${isLarge ? "h-5 w-5" : "h-4 w-4"}`}
          aria-hidden="true"
        />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder="Search titles and summaries…"
          autoComplete="off"
          className={`w-full bg-transparent font-sans text-foreground placeholder:text-faint-foreground focus:outline-none ${
            isLarge ? "py-3.5 pl-3 text-lg" : "py-2.5 pl-2.5 text-base"
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 border-l border-border bg-transparent font-sans font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
            isLarge ? "ml-3 pl-4 text-[13px]" : "ml-2 pl-3 text-xs"
          }`}
        >
          Search
        </button>
      </div>
    </>
  )
}

// Standalone by default for homepage use; embedded mode contributes only the
// controls so a parent form can submit the query and every active filter.
export function SearchField({
  action = "/search",
  standalone = true,
  ...inputProps
}: SearchFieldProps) {
  const input = <SearchInput {...inputProps} />
  return standalone ? (
    <form action={action} role="search" className="w-full">
      {input}
    </form>
  ) : (
    input
  )
}
