import type { DailyEditorialIllustration } from "./daily-editorial"
import { getDailyEdition, getDailyEditorialIllustration, getDailyMetadata } from "./daily"
import type { DailyEdition } from "./daily-types"
import { getDailyPodcast, type DailyPodcast } from "./podcast"

export interface LatestDailyEdition {
  date: string
  /** Lead story of page one: what the edition leads with that day. */
  title: string
  introduction: string
  articleCount: number
  issueCount: number
  illustration?: DailyEditorialIllustration
}

/**
 * The edition's podcast, or nothing at all.
 *
 * Unlike the Daily route, the homepage treats a malformed podcast artifact as simply
 * absent: an edition is still worth presenting without its audio, and the listen actions
 * are hidden rather than the whole page failing.
 */
export function getPublishedDailyPodcast(date: string): DailyPodcast | undefined {
  try {
    return getDailyPodcast(date)
  } catch {
    return undefined
  }
}

function leadArticle(edition: DailyEdition) {
  const front = edition.pages[0]
  const leadKey = front?.slots.find((slot) => slot.role === "lead")?.article_key ?? edition.article_order[0]
  return edition.articles.find((article) => article.article_key === leadKey)
}

/**
 * The most recent edition that actually renders, newest first.
 *
 * The calendar date is never assumed to have an edition, and a date whose artifact is
 * missing, corrupt, checksum-mismatched or empty is skipped rather than allowed to take
 * the homepage down with it — the reader gets the latest edition that works. Returns
 * undefined only when no edition in the whole archive is usable.
 */
export function getLatestPublishedDaily(): LatestDailyEdition | undefined {
  for (const entry of getDailyMetadata().dates) {
    if (entry.unique_article_count === 0) continue
    let edition: DailyEdition | undefined
    try {
      edition = getDailyEdition(entry.date)
    } catch {
      continue
    }
    if (!edition || edition.pages.length === 0) continue
    const lead = leadArticle(edition)
    if (!lead || lead.title.trim().length === 0) continue
    let illustration: DailyEditorialIllustration | undefined
    try {
      illustration = getDailyEditorialIllustration(entry.date)
    } catch {
      illustration = undefined
    }
    return {
      date: entry.date,
      title: lead.title,
      introduction: lead.summary,
      articleCount: edition.articles.length,
      issueCount: edition.issues.filter((issue) => issue.available).length,
      illustration,
    }
  }
  return undefined
}
