import Link from "next/link"

const NAV = [
  { href: "/daily", label: "Daily" },
  { href: "/", label: "Browse" },
  { href: "/archive", label: "Archive" },
  { href: "/search", label: "Search" },
]

export function SiteHeader() {
  return (
    <header data-site-header className="border-b border-border-strong bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-3 px-4 py-4 sm:flex-nowrap sm:gap-6 sm:px-5 md:px-8">
        <Link href="/" className="group">
          <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
            TLDR Index
          </span>
        </Link>

        <nav aria-label="Primary">
          <ul className="flex flex-wrap items-baseline gap-3 text-xs sm:flex-nowrap sm:gap-5 sm:text-sm md:gap-7">
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
