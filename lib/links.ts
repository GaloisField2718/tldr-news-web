// Classifies whether a value is safe to render as an external article link:
// it must parse as an absolute URL with an http/https scheme. Relative paths
// (internal routes like "/daily/..."), other schemes (e.g. "javascript:"),
// and malformed strings are all rejected rather than rendered as a link.
export function isExternalArticleUrl(value: string | null | undefined): value is string {
  if (!value) return false
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:"
}
