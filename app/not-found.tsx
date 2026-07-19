import Link from "next/link"

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-24 md:px-8">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">404</p>
      <h1 className="mt-3 font-serif text-3xl text-foreground md:text-4xl">
        This page isn&apos;t in the index
      </h1>
      <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
        The issue or page you requested could not be found in the archive.
      </p>
      <div className="mt-6 flex items-center gap-5 font-sans text-sm">
        <Link href="/" className="text-accent underline underline-offset-4 hover:text-accent-hover">
          Return to browse
        </Link>
        <Link
          href="/search"
          className="text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
        >
          Search the archive
        </Link>
      </div>
    </div>
  )
}
