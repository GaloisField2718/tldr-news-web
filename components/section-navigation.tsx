import type { Section } from "@/lib/types"

interface SectionNavigationProps {
  sections: Section[]
}

// A table-of-contents rail. Anchors jump to in-page section headings.
export function SectionNavigation({ sections }: SectionNavigationProps) {
  return (
    <nav aria-label="Sections in this issue" className="text-sm">
      <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-widest text-faint-foreground">
        Contents
      </p>
      <ol className="flex flex-col">
        {sections.map((section, i) => (
          <li key={section.id} className={i > 0 ? "border-t border-border" : ""}>
            <a
              href={`#${section.id}`}
              className="group flex items-baseline justify-between gap-3 py-2 underline-offset-4"
            >
              <span className="flex items-baseline gap-2.5">
                <span className="font-mono text-xs tabular-nums text-faint-foreground">
                  {String(section.order).padStart(2, "0")}
                </span>
                <span className="font-sans text-foreground group-hover:text-accent group-hover:underline">
                  {section.heading}
                </span>
              </span>
              <span className="font-mono text-xs tabular-nums text-faint-foreground">
                {section.articles.length}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
