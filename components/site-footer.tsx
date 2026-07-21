import { getArchiveCatalogue } from "@/lib/archive"

export function SiteFooter() {
  const manifest = getArchiveCatalogue()
  return (
    <footer data-site-footer className="mt-16 border-t border-border-strong bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-baseline md:justify-between md:px-8">
        <p className="font-serif text-base text-foreground">
          TLDR Index
          <span className="ml-2 font-sans text-xs text-faint-foreground">
            An unofficial editorial archive
          </span>
        </p>
        <p className="font-mono text-xs text-faint-foreground">
          {manifest.total_issues} issues indexed · schema v{manifest.schema_version}
        </p>
      </div>
    </footer>
  )
}
