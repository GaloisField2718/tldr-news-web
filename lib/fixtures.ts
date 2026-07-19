import type { Article, IssueDocument } from "./types"

// Typed fixture issues implementing the archive data contract.
// These stand in for the normalized archive of 5,900+ historical issues.
// Replacing this module with a static JSON loader requires no UI changes.

// Stress-test fixture: a single dense issue with 40 articles under a long
// sector name. Exercises deep scrolling, section navigation, and mixed
// content types / missing fields at volume.
function makeDenseCyberIssue(): IssueDocument {
  const domains = [
    "thehackernews.com",
    "bleepingcomputer.com",
    "krebsonsecurity.com",
    "darkreading.com",
    null,
  ]
  const makeArticle = (n: number, sectionOffset: number): Article => {
    const i = sectionOffset + n
    return {
      id: `cyber-2026-07-13-${i}`,
      order: n,
      title:
        i % 7 === 0
          ? `A deliberately long advisory title number ${i} that wraps to a second line to verify dense-issue rhythm, hanging alignment, and the relationship between title and summary at volume`
          : `Advisory ${i}: a concise incident writeup worth indexing`,
      summary:
        "A normalized summary line preserved from the source issue for close reading and search.",
      url: i % 5 === 0 ? null : `https://example.com/cyber/${i}`,
      reading_time_minutes: i % 4 === 0 ? null : ((i % 12) + 2),
      source_domain: domains[i % domains.length],
      content_type: i % 9 === 0 ? "tool" : "editorial",
      is_sponsor: false,
    }
  }
  const sponsor: Article = {
    id: "cyber-2026-07-13-sponsor",
    order: 3,
    title: "Continuous exposure management for lean security teams",
    summary: "Sponsored. Asset discovery, prioritized findings, and remediation tracking in one place.",
    url: "https://example.com/cyber-sponsor",
    reading_time_minutes: 2,
    source_domain: "exposuregrid.io",
    content_type: "sponsor",
    is_sponsor: true,
  }

  // 40 total: 10 + sponsor sits inside section one, then 30 more across sections.
  const s1 = [makeArticle(1, 0), makeArticle(2, 0), sponsor, ...Array.from({ length: 7 }, (_, k) => makeArticle(k + 4, 0))]
  const s2 = Array.from({ length: 15 }, (_, k) => makeArticle(k + 1, 10))
  const s3 = Array.from({ length: 15 }, (_, k) => makeArticle(k + 1, 25))

  return {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: "tldr-cybersecurity:2026-07-13",
    sector: "TLDR Cybersecurity",
    sector_slug: "tldr-cybersecurity",
    date: "2026-07-13",
    source_path: "TLDR Cybersecurity/article_13-07-2026.md",
    source_content_hash: "sha256:fixture",
    format_family: "links_block",
    parse_status: "partial",
    parse_warnings: [
      {
        code: "merged_headings",
        message: "High article count; two headings merged during normalization.",
        line: null,
      },
    ],
    title: "TLDR Cybersecurity — July 13, 2026",
    sections: [
      { id: "attacks-breaches", heading: "Attacks & Breaches", order: 1, articles: s1 },
      { id: "vulnerabilities", heading: "Vulnerabilities & Patches", order: 2, articles: s2 },
      { id: "strategies-tactics", heading: "Strategies & Tactics", order: 3, articles: s3 },
    ],
  }
}

export const issues: IssueDocument[] = [
  makeDenseCyberIssue(),
  {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: "tldr-ai:2026-07-17",
    sector: "TLDR AI",
    sector_slug: "tldr-ai",
    date: "2026-07-17",
    source_path: "TLDR AI/article_17-07-2026.md",
    source_content_hash: "sha256:fixture",
    format_family: "links_block",
    parse_status: "complete",
    parse_warnings: [],
    title: "TLDR AI — July 17, 2026",
    sections: [
      {
        id: "headlines-launches",
        heading: "Headlines & Launches",
        order: 1,
        articles: [
          {
            id: "ai-2026-07-17-1",
            order: 1,
            title: "Frontier labs converge on smaller, specialized reasoning models",
            summary:
              "After a year of scaling race headlines, several research groups published near-identical findings: task-specific distillation now outperforms general models on structured reasoning benchmarks at a fraction of the inference cost.",
            url: "https://example.com/specialized-reasoning",
            reading_time_minutes: 8,
            source_domain: "arstechnica.com",
            content_type: "editorial",
            is_sponsor: false,
          },
          {
            id: "ai-2026-07-17-2",
            order: 2,
            title: "Open weights release ships with a permissive commercial license",
            summary:
              "The release includes full training recipes and evaluation harnesses, a notable departure from the guarded releases of the past two cycles.",
            url: "https://example.com/open-weights",
            reading_time_minutes: 5,
            source_domain: "github.com",
            content_type: "github_repo",
            is_sponsor: false,
          },
          {
            id: "ai-2026-07-17-sponsor",
            order: 3,
            title: "Ship evaluation pipelines without the infrastructure toil",
            summary:
              "Sponsored. A managed platform for continuous model evaluation, with drift detection and per-prompt regression tracking built in.",
            url: "https://example.com/sponsor-evals",
            reading_time_minutes: 2,
            source_domain: "evalworks.io",
            content_type: "sponsor",
            is_sponsor: true,
          },
        ],
      },
      {
        id: "research-papers",
        heading: "Research & Papers",
        order: 2,
        articles: [
          {
            id: "ai-2026-07-17-3",
            order: 1,
            title: "A survey of retrieval-augmented reasoning under strict latency budgets",
            summary:
              "The authors compare eleven retrieval strategies and find that cache-aware routing narrows the gap between small and large models more than any single architectural change.",
            url: "https://example.com/rag-survey",
            reading_time_minutes: 14,
            source_domain: "arxiv.org",
            content_type: "editorial",
            is_sponsor: false,
          },
          {
            id: "ai-2026-07-17-4",
            order: 2,
            title: "Notes on reproducibility",
            summary:
              "A short commentary on why reported gains often fail to replicate across hardware. Reading time was not derivable from the source.",
            url: "https://example.com/reproducibility",
            reading_time_minutes: null,
            source_domain: "example.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
      {
        id: "quick-links",
        heading: "Quick Links",
        order: 3,
        articles: [
          {
            id: "ai-2026-07-17-5",
            order: 1,
            title: "A tiny library for streaming structured output",
            summary: "Zero dependencies, well documented, and pleasant to read.",
            url: "https://example.com/streaming-lib",
            reading_time_minutes: 1,
            source_domain: "github.com",
            content_type: "github_repo",
            is_sponsor: false,
          },
        ],
      },
    ],
  },
  {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: "tldr-ai:2026-07-16",
    sector: "TLDR AI",
    sector_slug: "tldr-ai",
    date: "2026-07-16",
    source_path: "TLDR AI/article_16-07-2026.md",
    source_content_hash: "sha256:fixture",
    format_family: "links_block",
    parse_status: "partial",
    parse_warnings: [
      {
        code: "unclassified_heading",
        message: "Section 2 heading could not be classified; preserved verbatim.",
        line: 24,
      },
    ],
    title: "TLDR AI — July 16, 2026",
    sections: [
      {
        id: "headlines-launches",
        heading: "Headlines & Launches",
        order: 1,
        articles: [
          {
            id: "ai-2026-07-16-1",
            order: 1,
            title:
              "A very long, deliberately unwieldy article title that stretches across multiple lines to exercise editorial wrapping and hanging indentation in the reading layout",
            summary:
              "The summary is intentionally verbose to test long-form scanning: it continues past the point of a single line so that line-height, measure, and the relationship between title and summary can be judged honestly.",
            url: "https://example.com/long-title",
            reading_time_minutes: 11,
            source_domain: "theverge.com",
            content_type: "editorial",
            is_sponsor: false,
          },
          {
            id: "ai-2026-07-16-2",
            order: 2,
            title: "Short one",
            summary: "A terse entry.",
            url: null,
            reading_time_minutes: 3,
            source_domain: null,
            content_type: "tool",
            is_sponsor: false,
          },
        ],
      },
      {
        id: "unclassified",
        heading: "Miscellany",
        order: 2,
        articles: [
          {
            id: "ai-2026-07-16-3",
            order: 1,
            title: "An item recovered from a partially parsed section",
            summary:
              "This entry survived parsing but its section heading could not be confidently classified. It is preserved to demonstrate partial parse handling.",
            url: "https://example.com/recovered",
            reading_time_minutes: null,
            source_domain: "example.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
    ],
  },
  {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: "tldr-web:2026-07-17",
    sector: "TLDR Web Dev",
    sector_slug: "tldr-web-dev",
    date: "2026-07-17",
    source_path: "TLDR Web Dev/article_17-07-2026.md",
    source_content_hash: "sha256:fixture",
    format_family: "unknown",
    parse_status: "complete",
    parse_warnings: [],
    title: "TLDR Web Dev — July 17, 2026",
    sections: [
      {
        id: "articles-tutorials",
        heading: "Articles & Tutorials",
        order: 1,
        articles: [
          {
            id: "web-2026-07-17-1",
            order: 1,
            title: "Rethinking hydration: the case for streaming from the edge",
            summary:
              "A measured look at where server-driven rendering has landed, and the tradeoffs teams are actually making in production.",
            url: "https://example.com/hydration",
            reading_time_minutes: 9,
            source_domain: "smashingmagazine.com",
            content_type: "editorial",
            is_sponsor: false,
          },
          {
            id: "web-2026-07-17-2",
            order: 2,
            title: "CSS nesting is finally boring, and that is a good thing",
            summary: "Cross-browser support is complete; here is a pragmatic migration checklist.",
            url: "https://example.com/css-nesting",
            reading_time_minutes: 6,
            source_domain: "css-tricks.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
      {
        id: "opinion",
        heading: "Opinion & Analysis",
        order: 2,
        articles: [
          {
            id: "web-2026-07-17-3",
            order: 1,
            title: "The framework churn is slowing, and teams are relieved",
            summary:
              "An argument that the industry has entered a consolidation phase, with fewer new frameworks and more investment in stability.",
            url: "https://example.com/framework-churn",
            reading_time_minutes: 7,
            source_domain: "example.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
    ],
  },
  {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: "tldr-web:2026-06-30",
    sector: "TLDR Web Dev",
    sector_slug: "tldr-web-dev",
    date: "2026-06-30",
    source_path: "TLDR Web Dev/article_30-06-2026.md",
    source_content_hash: "sha256:fixture",
    format_family: "links_block",
    parse_status: "complete",
    parse_warnings: [],
    title: "TLDR Web Dev — June 30, 2026",
    sections: [
      {
        id: "articles-tutorials",
        heading: "Articles & Tutorials",
        order: 1,
        articles: [
          {
            id: "web-2026-06-30-1",
            order: 1,
            title: "A field guide to view transitions across routes",
            summary: "Concrete patterns, with attention to accessibility and reduced-motion preferences.",
            url: "https://example.com/view-transitions",
            reading_time_minutes: 10,
            source_domain: "web.dev",
            content_type: "editorial",
            is_sponsor: false,
          },
          {
            id: "web-2026-06-30-sponsor",
            order: 2,
            title: "Observability that speaks in your framework's vocabulary",
            summary: "Sponsored. Traces, logs, and RUM with first-class support for modern meta-frameworks.",
            url: "https://example.com/sponsor-observability",
            reading_time_minutes: 2,
            source_domain: "tracewise.dev",
            content_type: "sponsor",
            is_sponsor: true,
          },
        ],
      },
    ],
  },
  {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: "tldr-founders:2026-07-15",
    sector: "TLDR Founders",
    sector_slug: "tldr-founders",
    date: "2026-07-15",
    source_path: "TLDR Founders/article_15-07-2026.md",
    source_content_hash: "sha256:fixture",
    format_family: "inline_url",
    parse_status: "complete",
    parse_warnings: [],
    title: "TLDR Founders — July 15, 2026",
    sections: [
      {
        id: "big-ideas",
        heading: "Big Ideas",
        order: 1,
        articles: [
          {
            id: "founders-2026-07-15-1",
            order: 1,
            title: "What a decade of seed data says about durable companies",
            summary:
              "The through-line is unglamorous: consistent retention beats episodic growth, and the best founders treat distribution as a first-class discipline.",
            url: "https://example.com/seed-data",
            reading_time_minutes: 12,
            source_domain: "example.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
      {
        id: "hiring",
        heading: "Hiring",
        order: 2,
        articles: [
          {
            id: "founders-2026-07-15-2",
            order: 1,
            title: "Founding engineer, early-stage developer tools",
            summary: "Remote-friendly, generous equity, product-minded team.",
            url: "https://example.com/job",
            reading_time_minutes: null,
            source_domain: "example.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
    ],
  },
  {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: "tldr-founders:2025-12-18",
    sector: "TLDR Founders",
    sector_slug: "tldr-founders",
    date: "2025-12-18",
    source_path: "TLDR Founders/article_18-12-2025.md",
    source_content_hash: "sha256:fixture",
    format_family: "inline_url",
    parse_status: "complete",
    parse_warnings: [],
    title: "TLDR Founders — December 18, 2025",
    sections: [
      {
        id: "big-ideas",
        heading: "Big Ideas",
        order: 1,
        articles: [
          {
            id: "founders-2025-12-18-1",
            order: 1,
            title: "The year end review nobody asks for but everybody needs",
            summary: "A framework for honest retrospectives that do not devolve into blame.",
            url: "https://example.com/year-end",
            reading_time_minutes: 6,
            source_domain: "example.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
    ],
  },
  {
    schema_version: "1.0.0",
    generator_version: "0.1.3",
    issue_id: "tldr-infosec:2026-07-14",
    sector: "TLDR InfoSec",
    sector_slug: "tldr-infosec",
    date: "2026-07-14",
    source_path: "TLDR InfoSec/article_14-07-2026.md",
    source_content_hash: "sha256:fixture",
    format_family: "links_block",
    parse_status: "complete",
    parse_warnings: [],
    title: "TLDR InfoSec — July 14, 2026",
    sections: [
      {
        id: "attacks-breaches",
        heading: "Attacks & Breaches",
        order: 1,
        articles: [
          {
            id: "infosec-2026-07-14-1",
            order: 1,
            title: "Supply-chain compromise traced to a single unpinned dependency",
            summary:
              "A postmortem with an unusually candid timeline, and a reminder that lockfiles are a security control, not a convenience.",
            url: "https://example.com/supply-chain",
            reading_time_minutes: 9,
            source_domain: "bleepingcomputer.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
      {
        id: "strategies-tactics",
        heading: "Strategies & Tactics",
        order: 2,
        articles: [
          {
            id: "infosec-2026-07-14-2",
            order: 1,
            title: "A pragmatic guide to rotating secrets without downtime",
            summary: "Includes a decision tree for teams without a dedicated platform group.",
            url: "https://example.com/rotating-secrets",
            reading_time_minutes: 8,
            source_domain: "example.com",
            content_type: "editorial",
            is_sponsor: false,
          },
        ],
      },
    ],
  },
]
