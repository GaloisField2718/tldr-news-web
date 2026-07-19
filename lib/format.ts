// Small formatting helpers shared across the archive UI.

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** "2026-07-17" -> "July 17, 2026" */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${LONG_MONTHS[m - 1]} ${d}, ${y}`
}

/** "2026-07-17" -> "2026.07.17" for monospaced metadata. */
export function formatMonoDate(iso: string): string {
  return iso.replaceAll("-", ".")
}

/** Reading time, tolerant of missing values. */
export function formatReadingTime(minutes: number | null): string | null {
  if (minutes === null) return null
  return `${minutes} min read`
}
