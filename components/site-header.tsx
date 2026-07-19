import Link from "next/link"

const NAV = [
  { href: "/", label: "Browse" },
  { href: "/archive", label: "Archive" },
  { href: "/search", label: "Search" },
]

export function SiteHeader() {
  return (
    <header className="border-b border-border-strong bg-background">
      <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-6 px-5 py-4 md:px-8">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
            TLDR Index
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-faint-foreground sm:inline">
            Archive
          </span>
        </Link>

        <nav aria-label="Primary">
          <ul className="flex items-baseline gap-5 text-sm md:gap-7">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
