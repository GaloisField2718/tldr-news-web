# TLDR archive data integration

## Ownership and source of truth

`GaloisField2718/tldr_news` owns newsletter ingestion, parsing, normalization, and the generated data contract. Its `generated/` directory is the sole source of truth.

`tldr-news-web` owns presentation, catalogue generation, search, and deterministic Daily newspaper composition. It does not modify source data or parser behavior. The full source dataset and generated search or Daily files are not committed to this repository.

## Synchronization flow

`npm run data:sync` runs `scripts/sync-tldr-data.mjs`:

1. Fetch the requested public Git ref with a shallow, blob-filtered sparse Git checkout.
2. Resolve `FETCH_HEAD` to one immutable 40-character commit SHA.
3. Check out only `generated/` at that exact SHA.
4. Strictly validate the manifest and every issue document.
5. Store the source files under `.cache/tldr-data/<sha>/generated/`.
6. Generate `.generated/archive-metadata.json`, `archive-catalogue.json`, deterministic gzip search segments under `.generated/search/`, and one compressed Daily edition per date under `.generated/daily/`; copy the optional validated-at-runtime `generated/editorial/` tree into `.generated/editorial/` from that same checkout.

No issue file is subsequently read from a moving branch URL. Synchronization uses public, read-only Git access and requires no token. Temporary `.sync-*` directories are removed before and after synchronization. Both `.cache/` and `.generated/` are gitignored.

Validation checks the supported schema, generator version presence, JSON validity, raw issue contract, unique issue/source/derived paths, exact manifest-to-file correspondence, safe paths, valid sector slugs and dates, issue count, stale files, and unwanted GoDaddy output.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `TLDR_DATA_REPO` | `GaloisField2718/tldr_news` | Public GitHub owner/repository |
| `TLDR_DATA_REF` | `main` | Branch, tag, or immutable commit requested for synchronization |
| `TLDR_DATA_LOCAL_PATH` | unset | Local `tldr_news` checkout or its `generated/` directory; disables network access |
| `TLDR_DATA_LOCAL_SHA` | unset | Explicit 40-character source SHA for a local dataset not inside a Git checkout |

The local override receives identical validation and is copied into the same cache layout. It is intended for development and temporary test datasets, not as a production fallback.

## Selected issue-loading architecture

**Selected: build-local issue files.** Issue routes resolve a compact catalogue entry and read its validated JSON from `.generated/issues/`, copied atomically from `.cache/tldr-data/<sha>/generated/issues/` during artifact generation. Catalogue and issue content therefore always use the same source SHA. Next output-file tracing includes these files only in the dynamic issue route; issue pages are not all statically generated.

At source commit `d25dee6db9b888c42871853623aca4d511551825`, generated source files occupy 77,897,303 bytes (about 85 MiB on disk across 5,930 files including the manifest). The measured issue-route trace is 75.76 MiB, below Vercel's 250 MiB uncompressed function limit; the search-route trace is 21.52 MiB.

**Rejected: immutable remote issue fetching.** It would reduce deployment size, but every issue request would depend on GitHub availability, latency, unauthenticated rate limits, and runtime caching. The measured build-local corpus does not justify those risks.

## Selected search architecture

**Selected: server-side search over deterministic gzip files segmented by year.** Search documents include only article display/search fields and issue routing metadata. Segments are generated in display order by descending issue date and stable sector/article identifiers. The server decompresses only the selected year when `year` is present; all four segments are scanned for an all-years query. It counts all exact matches while retaining only the requested 50-item page window. No search corpus or raw issue corpus is included in a client bundle, and the browser's first-load search-data payload is zero bytes.

Measurements at the source commit above:

- Articles: 93,081 total; 92,649 with a non-empty title or summary
- Uncompressed search JSON: 72,258,534 bytes
- Gzip search artifacts: 18,523,369 bytes
- Largest segment: 2025, 6,783,616 bytes gzip
- Catalogue: 2,248,171 bytes
- Browser first-load search payload: 0 bytes of search artifacts

**Rejected: segmented client search.** Even segmented, the largest compressed year is about 6.8 MB, and all-years search would transfer about 18.5 MB and block the browser with over 72 MB of decoded JSON.

**Rejected: an additional static search engine.** The measured 93,081-document corpus is straightforward to scan server-side and does not justify another dependency or index format in this bounded integration.

## Daily newspaper architecture

Daily generation groups validated issues by date, applies conservative exact-URL deduplication scoped by presentation class (sponsored, resource, editorial), assigns stable SHA-256 reader keys, and composes fixed-capacity newspaper pages. `.generated/daily-metadata.json` and `.generated/daily/YYYY-MM-DD.json.gz` share the archive/search source SHA. The metadata records counts, sizes, page counts, and compressed-file checksums. Optional editorial JSON is copied, never generated, by the frontend build; runtime validation either atomically overlays its compact plan or returns the untouched deterministic edition. Image binaries remain in R2 and are requested directly from the exact configured Worker hostname. Daily route functions read only these server-side artifacts, not every raw issue file. See [`DAILY_NEWSPAPER.md`](./DAILY_NEWSPAPER.md) for composition and reader contracts.

The V1 newspaper is deterministic and does not express human or AI editorial judgment. Prominence follows stable fallback rules rather than assessed importance. Original articles remain on publisher websites; TLDR Index displays stored TLDR newsletter summaries and explicit outward links.

## Local development

```sh
npm ci
npm run data:sync
npm run dev
```

To use a local source checkout without network access:

```sh
TLDR_DATA_LOCAL_PATH=/path/to/tldr_news/generated npm run data:sync
npm run dev
```

`npm run data:check` revalidates the cached source, checks generated counts and source-SHA consistency, verifies search-segment and Daily-edition checksums, and validates exact Daily page assignment.

The application intentionally fails with a clear `npm run data:sync` instruction if real generated data is absent. There is no fixture fallback in production.

## Vercel and CI behavior

`prebuild` runs `data:sync`, so `npm run build` and a Vercel build use the same synchronization and generation path. The resolved SHA and exact counts are printed in build logs. CI uses public read-only source access and has only `contents: read` permission; it has no cross-repository token or write operation.

The current deployed source SHA can be inspected in:

- the `data:sync`/Vercel build log;
- `.generated/archive-metadata.json` in build output;
- `getSourceMetadata()` in server-side debugging code;
- `npm run data:check` output for a local build.

To update manually, run with the desired ref (or SHA) and rebuild:

```sh
TLDR_DATA_REF=main npm run data:sync
npm run data:check
npm run build
```

Each synchronization resolves the requested ref again. A new SHA creates a new immutable cache directory and atomically replaces frontend artifacts; stale temporary state is cleaned automatically.

## Failure modes

Synchronization fails before artifact replacement when the ref cannot be resolved, public Git retrieval is incomplete, the manifest is absent/malformed, the schema is unsupported, any issue is missing or malformed, paths escape `generated/`, counts differ, or raw contracts disagree. Runtime loading also verifies catalogue/issue identity and catalogue/search/Daily source SHA consistency.

Failed source issues with no useful sections remain valid archive records and render a restrained preservation message. Source-data anomalies are not repaired by this application.

## Deferred work

- Automatic Vercel redeployment initiated by changes in `tldr_news` (Deploy Hook and any cross-repository workflow) will be implemented separately.
- Re-measure deployment and search behavior if the source corpus grows enough to approach Vercel bundle, memory, or request-latency limits.
- Parser/data-quality improvements remain exclusively in the source repository and are outside this presentation PR.
