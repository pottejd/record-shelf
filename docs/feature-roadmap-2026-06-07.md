# Record Shelf — Feature Roadmap (net-new features)

> **Date:** 2026-06-07 · **Base version:** 0.10.18 (`master`) · **Companion to:** the feature analysis (existing-feature inventory + comparable-app survey, this session)
> **Method:** A 10-agent inventory/research pass catalogued the current feature set and surveyed ~30 comparable apps (Discogs ecosystem tools, beets/Lidarr/Navidrome, ListenBrainz/Last.fm, Spotify Wrapped/Receiptify/AOTY). A second 7-agent pass produced source-grounded implementation blueprints for all 18 recommended features plus a phasing/file-contention analysis. This document reconciles both into a dependency-ordered build plan.

All 18 features are **net-new** (the audit/remediation work is complete). They are scoped against what the Discogs API actually exposes: the collection endpoint returns rich `basic_information` (artists+id, labels+catno, formats, genres, styles, year, cover art, rating, `date_added`) but **not** community have/want counts, country, tracklist, videos, or price-paid — those live only on the per-release detail endpoint (`/releases/{id}`, one rate-limited call each). That cost is the dividing line between "ready now" and "extra-fetch" features.

---

## Strategy

**Foundations first, features last** — the same philosophy as [remediation-plan-2026-05-30.md](./remediation-plan-2026-05-30.md). Four reusable foundations must be extracted before their dependents land, or each feature reinvents the pattern and we get N divergent copies:

1. **`src/lib/utils/canvas.ts`** — generic `drawRoundRect()` + `createShareCanvas({width,height,scale,drawFn})` + `exportCanvasToPNG(canvas, filename)`, extracted from `ShareableCard.svelte`'s `downloadPNG` (the 2×-scale / gradient-bg / `roundRect` pattern). Consumed by every share card (personality, receipt, compat, mosaic, wrapped). **Build before Phase 2.**
2. **`src/lib/utils/yearStats.ts`** — `computeYearSubsetStats(items, year)` that filters by `date_added` year and reuses `computeCollectionStats`, plus new-vs-deepened artist/genre diffing. Consumed by "added this year" and Wrapped. **Build in Phase 1.**
3. **`src/lib/server/enrichment.ts`** — generalizes the `/api/value` rate-limited serialized fetch queue (`rateLimitChain`, `MIN_DELAY_MS=1100`, 429 retry ×2) into `fetchWithRateLimit(url, headers)` + per-release KV helpers `getEnrichedRelease`/`setEnrichedRelease` (key `enrich:release:{id}`, 24h–7d TTL). Consumed by all three Tier-2 features. **Build before Phase 4.**
4. **`src/lib/stores/listeningAccount.ts`** — a writable store mirroring `settings.ts` holding `{ service: 'lastfm'|'listenbrainz'|null, username, apiKey? }`. Consumed by the connect-account flow and all three listening features. **Build in Phase 5.**

### Reconciliation notes (where the per-feature blueprints diverged)

The individual blueprints each invented local helpers; these are reconciled toward the shared foundations above:

- **Canvas boilerplate** — every share-card blueprint said "copy `roundRect` from `ShareableCard`." Reconciled to a single `canvas.ts`; `ShareableCard` is refactored in place to use it (pure, behavior-preserving) at the start of Phase 2.
- **Per-release detail cache** — the obscurity/country blueprints proposed a shared `src/lib/server/releaseCache.ts`; the discography blueprint proposed its own `rateLimitedFetch`. Both fold into `enrichment.ts`. **Key insight retained:** obscurity and country both read `/releases/{id}` and therefore **share one fetch + one KV entry** (`enrich:release:{id}`) — never call it twice for the same release. Discography uses a separate endpoint (`/artists/{id}/releases`) and a separate key (`enrich:discog:{id}`).
- **Listening credentials** — the listen blueprint extended `settings.ts`; the phasing pass preferred a dedicated `listeningAccount.ts`. Reconciled to the dedicated store (cleaner separation). The Last.fm API key still gets a `Secure; SameSite=Strict` cookie so the validate endpoint can read it server-side without putting it in a URL.
- **Wrapped route** — use `/u/[username]/wrapped/[year]` (nested, year-parameterized, OG-previewable) with a `src/params/year.ts` matcher, over the flatter `/wrapped/[username]` the phasing pass sketched.

### File-contention hotspots

| File | Touched by | Sequencing rule |
|---|---|---|
| `src/routes/u/[username=username]/+page.svelte` | nearly every feature | **Append-only.** Two edit regions: the `navSections` array and the section-composition block. Each phase appends new `{ id, label }` entries + new `profile/*` component mounts; no existing entry is modified. New sections always live in `src/lib/components/profile/`. |
| `src/lib/components/profile/ProfileShare.svelte` | personality, receipt, mosaic | Phase 2 appends three card `<section>`s. The `ShareableCard`→`canvas.ts` refactor is a same-file, same-API in-place edit landed first. |
| `src/lib/types/discogs.ts` | diversity, all T2, connect-account, cost-basis | **Additive only**, appended at the bottom. No existing interface modified → no merge conflicts. |
| `src/lib/server/cache.ts` | all T2 + T3 | **Not modified.** `enrichment.ts` and the play-count route call `kvGetJSON`/`kvPutJSON` and wrap them with type-prefixed keys. |
| `src/lib/api/discogs.ts` | added-this-year, wrapped | **Not modified.** Year-subset logic lives in `yearStats.ts` and imports `computeCollectionStats`; callers pre-filter items. |
| `src/routes/settings/+page.svelte` | connect-account | Phase 5 only; appends a "Listening Account" card after the existing token cards. |
| `src/routes/api/value/[username=username]/+server.ts` | cost-basis | **Reused as-is**, no modification (cost-basis is client-side + the existing POST). |

### At-a-glance

| Phase | Features | Effort | Net new APIs? |
|---|---|---|---|
| 1 — Pure-stats quick wins | diversity, added-this-year, smart-collections, affinities, wantlist-export | 5×S | none |
| 2 — Canvas foundation + share cards | personality, receipt, compat, mosaic | M×4 (+canvas) | mosaic adds a cover-proxy route |
| 3 — Wrapped + enrichment service | wrapped (+ `enrichment.ts`) | L | none (reads cache) |
| 4 — Tier-2 extra-fetch | discography-gap, obscurity, country | 3×L/M | per-release detail routes |
| 5 — Listening enabler | connect-account | M | listening-validate route |
| 6 — Listening data | never-played, play-weighted, value-play-quadrant | 3×M/L | play-count route |
| 7 — Cost basis | cost-basis | L | none (reuses `/api/value`) |

---

## Phase 1 — Pure-Stats Tier-1 Quick Wins

**Theme:** zero-API features derivable directly from the in-memory `items` / `CollectionStats`.
**Best time:** lowest-risk, highest-confidence, immediate visible value; proves the section pipeline and flushes the `navSections` hotspot early so later phases only append. Build `yearStats.ts` here because both this phase and Phase 3 (Wrapped) need it.
**Exit criteria:** unit tests for every new util green; `svelte-check` clean; all five render on `/u/pottejd` with no SSR/TDZ error.

### 1.1 `t1-diversity` — Collection Diversity Score · S · medium
A single 0–100 composite from Shannon entropy over the existing breakdowns.
- **Create:** `src/lib/utils/diversity.ts` (+ `.test.ts`).
- **Types:** `DiversityScore { total; genreEntropy; styleEntropy; decadeEntropy; labelEntropy; artistBreadth }` (all 0–100) → append to `types/discogs.ts`.
- **Functions:** `shannonEntropy(breakdown)` (`-Σ p·log2 p`, 0 for empty/single bucket); `normEntropy(breakdown, maxBuckets)` (÷`log2(maxBuckets)`, clamp [0,100]); `computeDiversityScore(stats)` weighting genre 30 / style 25 / decade 20 / label 15 / `uniqueArtistRatio` 10.
- **Data:** `stats.genreBreakdown`, `styleBreakdown`, `decadeBreakdown`, label counts, `uniqueArtistRatio`. No fetches.
- **Wiring:** pure util consumed inline by `t1-personality` and `t1-affinities`; not its own section.
- **Risk:** collections with more genre buckets than `maxBuckets` push entropy past the ceiling — clamp and document.

### 1.2 `t1-added-this-year` — Added-This-Year Breakdown · S · medium
Partition `items` by `date_added` year; for the current year classify each artist/genre/decade as **new** (absent from all prior years) vs **deepened**.
- **Create:** `src/lib/utils/yearStats.ts` (**shared foundation** — `partitionByYear`, `computeYearSubsetStats(items, year)`, `deriveNewVsDeepened`) + `.test.ts`; `src/lib/components/YearInReview.svelte`; `src/lib/components/profile/ProfileYearInReview.svelte` (thin wrapper, renders nothing when 0 items in year).
- **Types:** `YearDiff { year; added[]; newArtists[]; deepenedArtists[]; newGenres[]; newDecades[]; byMonth[] }`.
- **Wiring:** mount in `+page.svelte` between `ProfileActivity` and `ProfileInsights`; nav `{ id: 'year-in-review', label: 'This Year' }`.
- **Risk:** parse `date_added` via `new Date(...).getFullYear()` (ISO has TZ offset) — never string-slice. Recomputes on each progressive-load flush; O(n), fine ≤5k items.

### 1.3 `t1-smart-collections` — Smart Auto-Collections · S · medium
One-tap preset chips that drive the **existing** URL-persisted `CollectionBrowser` filters.
- **Create:** `src/lib/utils/collectionPredicates.ts` (`matchesRating`, `isAddedThisMonth`, `isSingleFormat`, `isUnrated`, `SMART_PRESETS`) + `.test.ts`; `src/lib/components/SmartCollections.svelte` (chip strip with live counts; `goto(url, { replaceState: true })`).
- **Modify:** `CollectionBrowser.svelte` — add `selectedRating` + `selectedFormatDetail` `$state`, wire into the URL-sync `$effect`, `clearFilters()`, the `filteredItems` `$derived`, and the active-filter chip strip. Mount `<SmartCollections {items}/>` above `<CollectionBrowser>` in `ProfileCollection.svelte`.
- **Presets:** Jazz 1960s `{genre:'Jazz',decade:'1960'}`; Added this month; 5-star vinyl `{rating:'5',format:'Vinyl'}`; Singles only `{format_detail:'Single'}`; Unrated `{rating:'0'}`.
- **Risk:** decade param is the string `'1960'` (matches existing `parseInt(selectedDecade)`); `'Single'` comes from `DiscogsFormat.descriptions`.

### 1.4 `t1-affinities` — Taste-Fingerprint Panel · S · low
Recompose existing dominant-genre/decade + top labels/styles + diversity into one scannable chip panel.
- **Create:** `src/lib/utils/affinities.ts` (`buildAffinityChips(stats, diversity)`) + `.test.ts`; `src/lib/components/AffinitiesPanel.svelte`.
- **Modify:** `ProfileOverview.svelte` adds a "Taste Fingerprint" card alongside `CollectionDNA`; `+page.svelte` passes the same `diversity` `$derived` used by `t1-personality`.
- **Risk:** `slice` top-labels/styles to ≤3 (guards small collections); keep the prose summary ≤120 chars for mobile.

### 1.5 `t1-wantlist-export` — Wantlist Export · S · low
Generalize `CollectionExport` to accept a normalized row type; wire into the wantlist page; include the already-fetched-but-unused `notes` field.
- **Create:** `src/lib/utils/exportAdapters.ts` (`ExportRow` type; `normalizeCollectionItem`, `normalizeWantlistItem` with `notes: item.notes ?? ''`) + `.test.ts`.
- **Modify:** `CollectionExport.svelte` prop type → `ExportRow[]`, add a Notes CSV column / JSON key / conditional print column, add optional `suffix` prop (`'collection'`→`'wantlist'`); wantlist `+page.svelte` adds `$derived exportRows = wantlist.map(normalizeWantlistItem)` and mounts `<CollectionExport items={exportRows} username={profile.username} suffix="wantlist"/>`.
- **Note:** grep-confirm `CollectionExport`'s current call site before changing the prop type (blueprint suspects it may currently be unused in the profile components).

---

## Phase 2 — Canvas Foundation + Tier-1 Share Cards

**Theme:** extract the canvas helper once, then build all share/export cards on it.
**Best time:** the helper must exist before any card or we get four divergent canvas impls; `t1-personality` needs Phase 1's diversity score. Grouping the four cards minimizes reopening `ProfileShare.svelte`.
**Exit criteria:** `canvas.ts` unit-tested; all four cards render in jsdom and call `exportCanvasToPNG` without throwing; no SSR access to `document`/canvas (all in `onclick`/`$effect` browser-guarded).

### 2.0 Foundation — `src/lib/utils/canvas.ts`
`drawRoundRect(ctx,x,y,w,h,r)`, `createShareCanvas({width,height,scale,drawFn})`, `exportCanvasToPNG(canvas,filename)`. Refactor `ShareableCard.svelte` to import these (pure refactor, verify with `svelte-check`).

### 2.1 `t1-personality` — Collecting Personality Archetype Card · M · high
4 binary axes → 4-letter code + fun name + downloadable card.
- **Create:** `src/lib/utils/personality.ts` (`computePersonality(stats, diversity)`, `ARCHETYPE_NAMES` 16-entry table, axis helpers) + `.test.ts`; `src/lib/components/PersonalityCard.svelte`.
- **Axes:** Completist↔Sampler (`uniqueArtistRatio`); Vintage↔New (`medianYear` mapped to [1920,2025]); Specialist↔Omnivore (`genreEntropy` from diversity); Purist↔Mixer (`normEntropy(formatBreakdown,8)`).
- **Wiring:** mount first in `ProfileShare.svelte`; nav `{ id:'personality', label:'Personality' }`.
- **Risk:** guard `medianYear===0` (empty collection → default axis 50); fall back to a generic name if a code is missing from the table; cross-platform canvas font differences are acceptable.

### 2.2 `t1-receipt` — Receipt-Style Share Card · M · high
Thermal-receipt layout (monospace, dashed dividers, `TOTAL: N records`) with an all-time / this-year toggle (`date_added`).
- **Create:** `src/lib/utils/receipt.ts` (`buildReceiptLines(stats, items, mode)`) + `.test.ts`; `src/lib/components/ReceiptCard.svelte` (tall narrow canvas ~320×600@2×).
- **Data:** `stats.topArtists`, `genreBreakdown`, `topLabels`, `totalItems`, `items[].date_added`.
- **Risk:** compute canvas height from line count before drawing (avoid clipping); Courier→`monospace` fallback.

### 2.3 `t1-compat` — Compatibility Score + Tiered Share Card · M · high
Layer a named-tier headline + share card + invite link onto the **existing** `/compare` results.
- **Create:** `src/lib/utils/compat.ts` (`getCompatibilityTier(score)` 6-tier table) + `.test.ts`; `src/lib/components/CompatCard.svelte` (480×300@2×, `copyInviteLink()` → `/compare/{u1}/{u2}`).
- **Modify:** `compare/[user1]/[user2]/+page.svelte` — replace `getSimilarityLabel` with `$derived(getCompatibilityTier(comparison.similarityScore))`, render `tier.label` in the vs-badge, mount `<CompatCard>` in `.actions`. `constants.ts` — extend `SIMILARITY_THRESHOLDS` into `COMPAT_TIERS` (keep a back-compat alias; it's imported at `+page.svelte:6`).
- **Data:** all already in the loader (`comparison.similarityScore` etc., `+page.server.ts:171-178`). No fetches.
- **Risk:** `navigator.clipboard`/canvas unavailable in jsdom → `try/catch` + `alert` fallback and stub in tests; `window.location.origin` is client-only (invite link built in `onclick`, not `$derived`).

### 2.4 `t1-mosaic` — Cover-Art Mosaic / Poster Export · L · medium
Composite `cover_image` URLs onto a hi-res canvas. **CORS:** Discogs CDN images taint the canvas, so a proxy is required.
- **Create:** `src/routes/api/covers/+server.ts` (GET `?url=`; **validate hostname via `URL` parsing** — allow only `i*.discogs.com`/CDN hosts to prevent SSRF; pipe body with `Cache-Control: public, max-age=3600`); `src/lib/utils/mosaic.ts` (`buildMosaicGrid`, `loadCoverImage` with 5s timeout, `drawMosaicCanvas` filling blanks) + `.test.ts`; `src/lib/components/MosaicExport.svelte` (grid-size selector, user-triggered Generate, progress counter).
- **Wiring:** last card in `ProfileShare.svelte`.
- **Risk:** set `img.crossOrigin` **before** `src`; cap tile size ~120px logical; don't auto-generate on mount (avoids 64 fetches on load); no KV (binary > KV value limit — rely on browser cache).

---

## Phase 3 — Vinyl Wrapped + Per-Release Enrichment Service

**Theme:** the year-in-review route + the shared enrichment service all Tier-2 features need.
**Best time:** Wrapped depends on Phase 1's `yearStats.ts` and reuses Phase 2's cards; extracting `enrichment.ts` now gives Phase 4 a stable, tested base.
**Exit criteria:** `enrichment.ts` unit-tested (fake-timer 429 path; KV mock); wrapped loader `server.test.ts` covers cache-hit / empty-year / cache-miss / token-redirect; `svelte-check` clean.

### 3.0 Foundation — `src/lib/server/enrichment.ts`
`fetchWithRateLimit(url, headers)` (serialized `rateLimitChain`, `MIN_DELAY_MS=1100`, 429 retry ×2 — lifted from `/api/value`); `getEnrichedRelease<T>(platform, type, id)` / `setEnrichedRelease<T>(platform, type, id, value, ttl)` over `kvGetJSON`/`kvPutJSON` with key `enrich:{type}:{id}`; add `ENRICHMENT_CACHE_TTL_SECONDS` to `constants.ts`. (`/api/value` keeps its own chain; migration optional.)

### 3.1 `t1-wrapped` — Vinyl Wrapped Year-in-Review · L · high
Stable, shareable, login-free `/u/[username]/wrapped/[year]` card-story.
- **Create:** `src/params/year.ts` (matcher: 4-digit, 1990…currentYear+1); `…/wrapped/[year=year]/+page.server.ts` (read `readCache`; filter to year by `date_added`; recompute via `computeYearSubsetStats`; derive busiest month / most-valuable addition / oldest pressing / new-vs-deepened / genre+format mix; **read-only KV**, fetch+write only on cold miss); `+page.svelte` (swipe/keyboard card rail + OG/Twitter meta); `server.test.ts`; `src/lib/components/wrapped/WrappedCard.svelte` + `WrappedValueCard.svelte` (POSTs `/api/value` client-side for the value card only); `src/lib/utils/wrapped.ts` (`deriveBusiestMonth`, `deriveOldestAddedThisYear`, `buildWrappedCardDescriptors`) + `.test.ts`.
- **Types:** `WrappedStats`, `WrappedCardDescriptor` → `types/discogs.ts`; `WRAPPED_SAMPLE_SIZE=10`, `WRAPPED_MIN_YEAR=1990` → `constants.ts`.
- **Wiring:** "Wrapped" link in `ProfileHeader.svelte`; standalone page (no SectionNav).
- **Risk (SSR/TDZ):** declare derived values before use (the ArtistLoyalty class of bug); `WrappedCard` PNG renders **text/shapes only** — no `drawImage` of CDN covers (CORS taint). Empty-year → `stats: null` + graceful screen. If collection only page-1-cached, show "stats may be incomplete" banner. OG image = `profile.avatar_url` (a `/api/og/...` edge image is a future enhancement).

---

## Phase 4 — Tier-2 Extra-Fetch Features

**Theme:** per-release enrichment via the Phase 3 service — discography gap, obscurity, country.
**Best time:** all three depend on `enrichment.ts`; obscurity + country share the `/releases/{id}` fetch, so one shared route architecture beats three. L/M effort; one focused sprint.
**Exit criteria:** the enrichment route(s) have `server.test.ts` (auth, cap, KV hit/miss, 429 retry, partial failure) using `vi.useFakeTimers` + `vi.advanceTimersByTimeAsync` like the value tests; util unit tests with synthetic data; token resolved cookie→header→`env.DISCOGS_TOKEN`.

> **Shared fetch:** obscurity and country both read `/releases/{id}` → cache the **full** release detail once under `enrich:release:{id}` (7-day TTL — community stats move slowly) and serve both. Implement as one `POST /api/enrichment/[username]` accepting `{ releaseIds, types }`, or two thin routes that both call `getEnrichedRelease('release', id)` first. Sample + extrapolate exactly like `/api/value` (cap `MAX_RELEASE_IDS=20`; surface a "based on sample" disclaimer).

### 4.1 `t2-discography-gap` — Discography Gap Detection · L · high
For top-N loyal artists, fetch `/artists/{id}/releases` (paginated, `role==='Main'`) and diff against owned release/master IDs → per-artist completeness % + missing list.
- **Create:** `src/routes/api/discography/[username=username]/+server.ts` (`{ artistIds, ownedReleaseIds, ownedMasterIds }`; `fetchWithRateLimit`; cache `enrich:discog:{id}`, 7-day TTL); `server.test.ts`; `src/lib/components/DiscographyGap.svelte` (client `$effect` fetch; per-artist accordion + progress bar).
- **Functions:** add `calculateLoyalArtistIds(items, topN)` to `utils/discogs.ts` (track by `artists[].id`, skip `id===0`; `ArtistLoyalty.svelte` itself unchanged); `computeGap(releases, ownedReleaseIds, ownedMasterIds)`.
- **Types:** `DiscogsArtistRelease`, `ArtistGap`, `DiscographyGapResult`.
- **Constants:** `DISCOGRAPHY_MAX_ARTISTS=5`, per-artist **page cap = 5** (≈500 releases) to keep cold worst-case under the 30s Pages-Function CPU limit.
- **Risk:** large catalogs (Miles Davis ~1000) — page cap bounds it; `role==='Main'` prevents compilation credits inflating gaps; client `$effect` only (no SSR).

### 4.2 `t2-obscurity` — Obscurity / Crate-Digger Score · M · high
Sample 20 releases; consume `community.have`/`community.want`; rarity ratio `want/(have+1)`; log-transform → 0–100 + tier (Mainstream→Ghost Pressing) + top-5 rarest.
- **Create:** `…/api/obscurity/[username]/+server.ts` (uses `getEnrichedRelease('release', id)`); `server.test.ts`; `src/lib/components/ProfileObscurity.svelte` (samples via `utils/array.sampleN`, client fetch, score gauge + rarest list).
- **Types:** `DiscogsCommunity`, `DiscogsReleaseDetail`, `ReleaseRarityEntry`, `ObscurityResult`.
- **Risk:** `release.community?.have ?? 0` (null on unreleased); `have+1` denominator avoids /0; ~4% sample is directional → disclaimer.

### 4.3 `t2-country` — Country / Geographic Distribution · M · medium
Sample up to 50 releases (reusing obscurity's cached entries — only the non-overlapping IDs hit network); aggregate `country` into a ranked breakdown + drawer filter.
- **Create:** `…/api/country/[username]/+server.ts`; `server.test.ts`; `src/lib/components/ProfileCountry.svelte` (sorted bars, click→`CollectionDrawer` filtered by sampled `releasesByCountry` IDs).
- **Types:** `CountryEntry`, `CountryResult` (incl. `releasesByCountry`).
- **Risk:** `country` is **not** on `basic_information` → drawer filter is sample-only ("from sample" label); treat `'Europe'` as one entry; enforce a ~35-fetch fallback cap when nothing is pre-cached.

---

## Phase 5 — Tier-3 Account-Connect Enabler

**Theme:** Last.fm / ListenBrainz connection — gates all of Phase 6.
**Best time:** independent but infra-heavy (new store + settings card + external API); isolating it keeps the `settings.ts`/settings-page hotspots collision-free and gives Phase 6 a tested base.
**Exit criteria:** store unit tests (connect/disconnect/`hasListeningAccount`); validate-endpoint `server.test.ts` (both services, success + error); settings card renders (jsdom); `svelte-check` clean.

### 5.1 `t3-connect-account` — Connect a Listening Account · M · high
- **Create (foundation):** `src/lib/stores/listeningAccount.ts` (`connectLastFm`, `connectListenBrainz`, `disconnect`, `hasListeningAccount`; localStorage `record-shelf-listening`; Last.fm key also in a `Secure; SameSite=Strict` cookie); `src/lib/api/listening.ts` (typed Last.fm + ListenBrainz wrappers, `ListeningAPIError`); `src/routes/api/test-listening/+server.ts` (validate: Last.fm `user.getinfo`, ListenBrainz `/1/user/{u}`) + `server.test.ts`.
- **Modify:** `settings/+page.svelte` adds a "Listening Account" card (service select, username, conditional API-key field, Test/Save/Disconnect — mirrors the token card); `constants.ts` adds `LASTFM_API_BASE`, `LISTENBRAINZ_API_BASE`.
- **Risk:** ListenBrainz needs only a username (fully public); Last.fm key is the user's own read key; `loadSettings()`'s `!browser` guard prevents TDZ.

---

## Phase 6 — Tier-3 Listening-Data Features

**Theme:** cross-reference play counts with owned records.
**Best time:** all depend on Phase 5; they share one play-count fetch utility extracted first; the quadrant additionally depends on never-played's data.
**Exit criteria:** `playCount`/`playMatch` unit tests (both services + zero-play case); all three components render gracefully with **no** account connected (prompt, no throw); `svelte-check` clean.

### 6.0 Foundation — play-count fetch + match
`src/routes/api/plays/[username=username]/+server.ts` (KV `plays:{service}:{user}`, 6h TTL; Last.fm `user.gettopalbums&limit=500` or ListenBrainz `/1/stats/user/{u}/releases?count=1000`; gated by Discogs token). `src/lib/utils/playMatch.ts` — `normalizeTitle` (strip remaster/deluxe/article suffixes), `normalizeArtist` (`cleanArtistName` then normalize), `matchPlays(items, plays)` (MBID map first, then `artist:title` fallback) → `EnrichedItem[]`. Types `PlayRecord`, `EnrichedItem`.

### 6.1 `t3-never-played` — Owned but Never/Rarely Played · L · high
`NeverPlayed.svelte` filters `EnrichedItem[]` by a play-count threshold slider → unplayed cover grid. Fetch triggered from `+page.svelte` `$effect` after progressive load completes; conditional nav `{ id:'listening', label:'Listening' }`.
- **Risk:** fuzzy match misses compilations/splits (exclude `artists[0].name==='Various'`); MBID coverage ~60–70%; Last.fm top-500 cap → albums ranked 501+ read as 0 plays (documented); absence from Last.fm top list correctly means 0 plays.

### 6.2 `t3-play-weighted` — Play-Weighted Favorites + Badges · M · medium
`PlayWeightedFavorites.svelte` (top played, sorted) + `PlayBadge.svelte`; `CoverGrid.svelte` gains optional `playCounts: Map<id,number>` to overlay badges. Reuses `EnrichedItem[]` — no new fetch. `formatPlayCount(n)` (`'1.2k'` for ≥1000).

### 6.3 `t3-value-play-quadrant` — Value × Play Quadrant · M · medium
`ProfileListening.svelte` + `ValuePlayQuadrant.svelte` (**SVG** scatter, not canvas — SSR-safe): X=plays, Y=value, quadrants Treasures / Underplayed / Workhorses / Shelf-fillers at the medians. Lift per-item prices out of `ValueEstimate.svelte` via a new `onPricesResolved?(Map<id,number>)` callback (no second `/api/value` call). `classifyQuadrant`, `computeMedian` are pure/unit-tested.
- **Risk:** value sample ≤20 → ≤20 points (documented); wrap SVG in `{#if browser}`; placeholder until "Estimate Value" is clicked.

---

## Phase 7 — Tier-4 Cost Basis vs Value (ROI)

**Theme:** purchase-price tracking overlaid on the existing value estimator.
**Best time:** most data-constrained (Discogs can't supply price-paid → manual entry); reuses `/api/value` as-is; no dependencies → lands last without blocking anything.
**Exit criteria:** `costBasis`/`roi` unit tests (set/get/clear with mock localStorage; profit/loss/zero-cost edges); empty-store renders a prompt; `svelte-check` clean.

### 7.1 `t4-cost-basis` — Cost Basis / ROI · L · medium
- **Create:** `src/lib/stores/costBasis.ts` (localStorage `record-shelf-cost-basis`; key by **`instance_id`** — stable per ownership instance; store `{ price, currency }`); `src/lib/utils/roi.ts` (`computeROI`, `computePortfolioROI`, `getCostBasisSummary`) + `.test.ts`; `src/lib/components/CostBasis.svelte` (portfolio summary, inline-editable price cells, paginated table, CSV export incl. a **backup JSON** download); `src/lib/components/profile/ProfileCostBasis.svelte` (prompt + "X of Y priced").
- **Wiring:** mount after `ProfileShare`; nav `{ id:'cost-basis', label:'Cost Basis' }` (always available); reuse the `onPricesResolved` callback from 6.3 (or add it here if Phase 6 isn't built).
- **Risk:** currency mismatch (store currency alongside price; disclaimer that market values use Discogs' currency); only the ≤20 sampled items have a market value ("No market data" otherwise); localStorage is per-device (offer JSON export/backup); bulk import from Discogs `custom_fields`/`notes` is impractical (1 call/item) → manual entry is the intended path.

---

## Suggested delivery slices

- **Slice A — "Collection Insights & Wrapped" release (Phases 1–3):** all zero-API stats + every share card + the Wrapped page. Pure client/cache work, no new rate-limit surface, highest visible value. The natural first shippable bundle.
- **Slice B — "Deep Discogs" (Phase 4):** the extra-fetch differentiators (discography gap is the marquee), all behind the one enrichment service.
- **Slice C — "Listening" (Phases 5–6):** the external-integration track, end to end.
- **Slice D — "Investment" (Phase 7):** cost-basis/ROI for serious collectors.

Each slice is independently shippable and bumps a minor version. Bump `package.json` before each deploy (`npm run build` → `npx wrangler pages deploy .svelte-kit/cloudflare`), per the standing deploy convention.
