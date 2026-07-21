# The Daily Index newspaper

## Purpose

The Daily Index combines every available TLDR thematic newsletter for one date into one continuous, paginated digital newspaper. It is a deterministic reading surface alongside—not a replacement for—the archive, search, and individual issue pages.

This first version does **not** express human or AI editorial judgment. Visual prominence follows stable composition rules and must not be interpreted as assessed importance.

## Generated data flow

`npm run data:sync` resolves `GaloisField2718/tldr_news` to an immutable commit, validates its `generated/` corpus, and creates frontend-owned artifacts under the gitignored `.generated/` directory:

```text
.generated/daily-metadata.json
.generated/daily/YYYY-MM-DD.json.gz
```

One compressed edition is generated per date. `daily-metadata.json` records counts, compressed and uncompressed sizes, SHA-256 checksums, and the source commit. `npm run data:check` decompresses and validates every edition, checks checksums and source-SHA consistency, and proves that page assignments exactly equal unique article keys.

`tldr_news` remains the sole source of truth for ingestion and normalized newsletter data. Daily artifacts contain only fields needed for newspaper composition and the reader; source paths, source hashes, parse warnings, and raw issue documents are excluded.

## Exact-URL deduplication

Only non-null HTTP(S) URLs are eligible. Canonicalization lowercases the hostname, removes fragments and the known `utm_*`, `mc_cid`, and `mc_eid` tracking parameters, and sorts all remaining parameters. It does not remove arbitrary parameters or compare titles.

Repeated listings of one source article (identical issue and article ID appearing in more than one section) are merged into a single Daily article first; if any listing is sponsored, the merged article is sponsored, so a paid placement can never lose its label to a duplicate editorial listing. Duplicate groups are then scoped by presentation class (sponsored, resource, editorial) in addition to the canonical URL. Occurrences of the same URL that differ in class are never merged: a paid placement can never be presented as editorial coverage, editorial coverage can never be absorbed into the Sponsored page, and a repository, course, or tool can never swallow an editorial story. Within a group, every occurrence therefore shares the presentation class of its primary article.

Null, invalid, and non-HTTP URLs remain distinct. A duplicate group retains all source occurrences. Its primary occurrence is selected by canonical sector order, section order, article order, issue ID, and article ID.

## Stable article keys

Reader keys are lowercase SHA-256 hex digests of `issue_id + "\0" + article.id`. Generation verifies URL safety and checks the complete generated corpus for collisions. Keys do not depend on array position or randomness.

## Deterministic composition

Canonical sectors are TLDR, AI, Dev, Web Dev, InfoSec, Cybersecurity, Crypto, Product, Design, Founders, and Marketing. Unknown future sectors follow in stable slug order.

The front-page lead is the first eligible (non-empty trimmed title and summary) non-sponsored editorial article from TLDR, then the first eligible editorial article in canonical order. All nine normal front-page positions prefer that same completeness rule: one lead, four secondary stories, and four briefs. Secondary selection takes at most one story from each sector before normal filling. Incomplete entries continue to interior pages whenever eligible editorial content exists; they are used on the front page only as a deterministic last fallback for a date with no eligible editorial entry. A non-sponsored resource is the fallback when no editorial article exists. Eligibility is a stable content-completeness rule, not editorial judgment. No sponsor can be a lead or normal front-page story.

Assigned front-page articles leave the pool. Remaining editorial articles continue by sector through `section-lead` and `three-column` pages with a maximum of 15 entries. Continuation chunks are balanced deterministically (for example, 16 entries become 8 + 8 rather than 15 + 1) while preserving order. Tools, repositories, and courses use `resources` pages. Sponsors use final, explicitly labelled `sponsored` pages. Continuation pages ensure long-tail entries are retained. Text length does not determine page assignment.

Failed empty issues remain in edition source metadata as unavailable. Partial issues contribute their available entries. Every unique article is assigned to exactly one page.

## Routes and reader

- `/daily` redirects to the latest readable edition. It renders an "unavailable" state only when a valid corpus contains no readable edition; corrupt or inconsistent generated data fails loudly instead of rendering that state.
- `/daily/[date]?page=N` renders exactly one newspaper page. Page 1 has the canonical URL without a query.
- `/daily/[date]/article/[articleKey]` renders one full stored TLDR summary.

The reader returns to the article's generated newspaper page, provides deterministic previous/next article links, identifies duplicate newsletter occurrences, links to the archived issue, and links outward when an original URL exists. Original articles remain on publishers' websites. TLDR Index displays stored newsletter summaries—it does not scrape or reproduce full articles.

## Output-file tracing

Daily route traces include `daily-metadata.json` and compressed daily editions. Daily routes do not need raw `.generated/issues/` documents. Daily and search artifacts remain server-only and are never placed under `public/` or imported by client components.

## Responsive strategy

Desktop uses a paper-like surface, masthead, rules, and a 12-column semantic HTML grid. At narrow widths, the selected page reflows into one readable column rather than shrinking a desktop canvas. Links remain normal progressive-enhancement links; JavaScript, swipe gestures, PDF rendering, images, canvas, and modal interception are not required.

## Local development

```bash
npm ci
npm run data:sync
npm run dev
```

A local source checkout remains supported:

```bash
TLDR_DATA_LOCAL_PATH=/path/to/tldr_news/generated npm run data:sync
```

No secret or external service is required. Unit tests use temporary generated datasets and do not download the source repository.

## Verification

```bash
npm run data:check
npm run typecheck
npm run lint
npm test
npm run build
```

## Current limitations and deferred work

The deterministic newspaper is the safe foundation and fallback for a future optional editor. Deferred work includes:

- LLM editorial ranking and composition;
- semantic clustering;
- human editorial overrides;
- source or Open Graph images;
- reader modal and intercepted routes;
- French editions and translation;
- podcast generation;
- RSS and email distribution.

Images, modal reading, podcasts, personalization, and model-generated prose are intentionally absent from this version. The routes deliberately retain the current `force-dynamic` strategy; a different cache/revalidation policy is follow-up work. Canonical behavior for numbered interior-page query URLs is also unchanged and should be evaluated separately rather than expanded in this correction.
