import type { ReactNode } from "react"
import { isExternalArticleUrl } from "@/lib/links"

interface ExternalArticleLinkProps {
  url: string | null | undefined
  children: ReactNode
  className?: string
  fallback?: ReactNode
}

// Single shared rendering path for links to external articles. Opens in a new
// tab with target="_blank" rel="noopener noreferrer" so the current Daily
// edition, journal page, and podcast playback are preserved. Falls back to
// plain content (or `fallback`) instead of an unsafe clickable link when the
// URL is missing or not a valid absolute http(s) URL.
export function ExternalArticleLink({ url, children, className, fallback }: ExternalArticleLinkProps) {
  if (!isExternalArticleUrl(url)) return <>{fallback ?? children}</>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}
