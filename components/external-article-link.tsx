import type { ReactNode } from "react"
import { isExternalArticleUrl } from "@/lib/links"

interface ExternalArticleLinkProps {
  url: string | null | undefined
  children: ReactNode
  className?: string
  fallback?: ReactNode
  /**
   * Whether to open in a new tab (target="_blank" rel="noopener noreferrer").
   * Defaults to true. Pass false for a link reached from a page that was
   * already opened in its own tab specifically to preserve an earlier view
   * (e.g. the Daily reader page, opened in a new tab from the journal) --
   * further navigation from there stays in that same tab instead of
   * spawning additional ones.
   */
  newTab?: boolean
}

// Single shared rendering path for links to external articles. By default
// opens in a new tab with target="_blank" rel="noopener noreferrer" so the
// current Daily edition, journal page, and podcast playback are preserved.
// Falls back to plain content (or `fallback`) instead of an unsafe clickable
// link when the URL is missing or not a valid absolute http(s) URL.
export function ExternalArticleLink({ url, children, className, fallback, newTab = true }: ExternalArticleLinkProps) {
  if (!isExternalArticleUrl(url)) return <>{fallback ?? children}</>
  return (
    <a href={url} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined} className={className}>
      {children}
    </a>
  )
}
