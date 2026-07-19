import type { ArchiveCatalogueEntry } from "@/lib/types"
import { IssueListRow } from "@/components/issue-list-row"

interface IssueListProps {
  issues: ArchiveCatalogueEntry[]
  showSector?: boolean
}

// A ruled editorial list of issues. Rows are separated by hairlines only.
export function IssueList({ issues, showSector = true }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <p className="py-8 font-sans text-sm text-muted-foreground">No issues to show.</p>
    )
  }
  return (
    <div className="divide-y divide-border border-t border-border">
      {issues.map((issue) => (
        <IssueListRow key={issue.issue_id} issue={issue} showSector={showSector} />
      ))}
    </div>
  )
}
