import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getIssue } from "@/lib/archive"
import { IssueHeader } from "@/components/issue-header"
import { SectionNavigation } from "@/components/section-navigation"
import { ArticleEntry } from "@/components/article-entry"

interface PageProps {
  params: Promise<{ sector: string; date: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sector, date } = await params
  const issue = getIssue(sector, date)
  if (!issue) return { title: "Issue not found" }
  return {
    title: issue.title,
    description: `${issue.sector} newsletter for ${issue.date}, with ${issue.sections.length} sections.`,
  }
}

export default async function IssuePage({ params }: PageProps) {
  const { sector, date } = await params
  const issue = getIssue(sector, date)
  if (!issue) notFound()

  const sortedSections = [...issue.sections].sort((a, b) => a.order - b.order)

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <IssueHeader issue={issue} />

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 pt-8 lg:grid-cols-[13rem_1fr]">
        {/* Table of contents rail */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <SectionNavigation sections={sortedSections} />
        </div>

        {/* Articles grouped by section */}
        <div className="flex flex-col gap-12">
          {sortedSections.map((section) => {
            const sortedArticles = [...section.articles].sort((a, b) => a.order - b.order)
            return (
              <section key={section.id} id={section.id} aria-labelledby={`h-${section.id}`}>
                <h2
                  id={`h-${section.id}`}
                  className="flex items-baseline gap-3 border-b border-border-strong pb-2 font-sans text-sm font-semibold uppercase tracking-widest text-foreground"
                >
                  <span className="font-mono text-xs tabular-nums text-accent">
                    {String(section.order).padStart(2, "0")}
                  </span>
                  {section.heading}
                </h2>

                <div className="divide-y divide-border">
                  {sortedArticles.map((article) => (
                    <ArticleEntry key={article.id} article={article} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
