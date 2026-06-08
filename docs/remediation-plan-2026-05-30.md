# Record Shelf — Remediation Roadmap (v0.8.0 audit)

> **Date:** 2026-05-30 · **Companion to:** [audit-2026-05-30.md](./audit-2026-05-30.md)
> **Method:** Five Opus 4.8 theme agents proposed 38 PR batches grounded in the source; a synthesis agent deduped/reconciled them into 34 canonical PRs across 6 dependency-ordered phases. Confirmed against source: no `src/hooks.server.ts`, no `src/params/`, `adapter-node` absent from `package-lock.json`, two divergent `svelte.config*.js`, profile route is 970 lines, `constants.ts` is 26 lines, value endpoint uses module-scope `priceCache`/`rateLimitChain`, the `items.length >= totalDiscogsItems` cache guard is at `+page.server.ts:41`.

## Strategy

Foundations first, then security + the one high-severity cache fix, then the rest of perf/quality in conflict-safe order, features last (after their dependencies). Three files are the contention hotspots and dictate the whole sequence:

- **`src/routes/u/[username]/+page.svelte`** (970 lines) — touched by ~9 PRs. **Quality decomposition lands before perf and before features.** Extracting pure functions (`badges.ts`, `array.ts`, `chart.ts`, `keyboardNav` action) is mechanical and shrinks the file; perf then edits a slim `<script>` and reuses `array.ts`'s `sampleN` to stabilize highlights; feature sections append to a clean nav/section list.
- **`src/lib/api/discogs.ts`** — touched by the username matcher, error-hygiene, shared-utils extraction, and the error-handling rewrite. Sequence so edits hit **disjoint regions** in order: matcher (URL builders) → shared-utils (line 225 only) → error-handling (fetchDiscogs 47-77 + median).
- **`src/lib/server/cache.ts`** — one PR (`perf-kv-cache-helper`) becomes the **sole owner** of cache.ts + app.d.ts; every other cache consumer only calls its new exports.

**Reconciliation notes (dedupes applied):**
- Widget hardening was proposed twice (`sec-widget-hardening`, `perf-widget-kv`) → **merged into one PR `widget-hardening`**.
- `hooks.server.ts` is wanted by both security headers and deploy env-validation → **`sec-headers-and-csp` creates it with a `handle` skeleton; `deploy-env-validation` extends it.**
- `cache.ts` SWR/generic helpers requested by 4 perf PRs + widget → consolidated into the single foundational `perf-kv-cache-helper`.
- `cleanArtistName` util wanted by quality, features, and CSV PR → single `refactor-shared-utils`, landed before its consumers.
- `array.ts` (`shuffleArray`/`sampleN`) is created by `refactor-profile-decompose`; perf and reduced-motion consume it.

---

## Phase 0 — Foundations

Sole-owners of shared infra/files that unblock the most downstream work. Several are independent and can go in parallel.

| PR id | Title | Scope | Closes | Effort | Risk |
|---|---|---|---|---|---|
| **refactor-constants-centralize** | Centralize magic numbers + delete empty `lib/index.ts` | Additive exports to `src/lib/constants.ts` (SIMILARITY_BUCKETS, BADGE_*_THRESHOLDS, CHART_LIMITS, TOP_LIST_LIMIT); delete `src/lib/index.ts` | "Magic thresholds scattered", "chart slice 8/12", "empty lib/index.ts" | small | low |
| **perf-kv-cache-helper** | KV cache helper: generic `kvGetJSON`/`kvPutJSON`, SWR soft-expiry, widened `Platform.context`, shape guard | Sole owner of `src/lib/server/cache.ts` + `src/app.d.ts`; backward-compatible `readCache` | "KV hard-expires no SWR", "readCache casts unvalidated JSON" | medium | medium |
| **refactor-shared-utils** | Extract `cleanArtistName`/`formatArtists` + sweep 13 call sites | New `src/lib/utils/discogs.ts`; edits discogs.ts **line 225 only**, compare server lines 71/126 (fold `?? []` artists guard), widget line 43, 10 components | "regex copy-pasted ×13", "artists undefined guard" | medium | low |
| **sec-username-matcher** | Username param matcher + `encodeURIComponent` at 4 API call sites | New `src/params/username.ts`; `git mv` route dirs to `[username=username]`/`[user1=username]`/`[user2=username]`; encode in discogs.ts URL builders | "unvalidated/unencoded username", "compare redirect unencoded" | medium | medium |
| **deploy-adapter-node-pin** | Pin `@sveltejs/adapter-node`, reproducible Docker build | `package.json`/`package-lock.json` (add+pin adapter-node), `Dockerfile` (drop ad-hoc `npm i`), `.dockerignore` (add `.env*`, coverage, docs, `static/*.pdf`) | "unpinned adapter-node", ".env baked into build layer" | small | low |
| **sec-headers-and-csp** | CSP (hash mode) + security headers + create `hooks.server.ts` | `svelte.config.js` + `svelte.config.docker.js` (kit.csp), new `static/_headers`, new `src/hooks.server.ts` with `handle` skeleton | "No CSP", "No security response headers" | medium | medium |

**Parallelizable within Phase 0:** all six touch disjoint files **except** discogs.ts — land `sec-username-matcher` (URL builders) **before** `refactor-shared-utils` (line 225), or accept a one-line merge. `refactor-constants-centralize`, `perf-kv-cache-helper`, `deploy-adapter-node-pin`, `sec-headers-and-csp` are fully independent — run concurrently.

---

## Phase 1 — Profile decomposition (gate for the profile route)

| PR id | Title | Scope | Closes | Effort | Risk |
|---|---|---|---|---|---|
| **refactor-profile-decompose** | Decompose 970-line profile route | Extract `calculateBadges`→`utils/badges.ts`, `shuffleArray`+`sampleN`→`utils/array.ts`, `toChartData`→`utils/chart.ts`, keyboard handler→`actions/keyboardNav.ts`; collapse 7 filter fns to `openDrawer`; guard line 204. **Leaves loader/randomHighlights/CSS regions untouched.** | "970-line monolith", "repeated toChartData", "magic 8/12", "getAlbumKey artists guard" | large | medium |

**dependsOn:** `refactor-constants-centralize`. **Must be serialized** ahead of every other `+page.svelte` editor. Run solo against that file.

---

## Phase 2 — Security hardening + the high-severity cache fix

All independent of each other; parallelizable. Depend only on Phase 0.

| PR id | Title | Scope | Closes | Effort | Risk | dependsOn |
|---|---|---|---|---|---|---|
| **perf-cache-large-collections** | **#1 fix:** cache >100-item collections via `waitUntil` | `+page.server.ts`: remove `items.length >= totalDiscogsItems` guard; background `fetchFullUserCollection`+`writeCache` via `platform?.context?.waitUntil`; no-op when context absent | "Collections >100 never cached" (high) | medium | medium | perf-kv-cache-helper |
| **sec-value-endpoint-hardening** | Gate `/api/value` env-token behind client auth; validate releaseIds; guard JSON body | value `+server.ts` POST handler only | "value amplification", "releaseIds not int-validated", "no parse guard" | small | medium | sec-username-matcher |
| **sec-cookie-and-token-storage** | `Secure` cookie flag, correct privacy copy, validate `?redirect` | `settings.ts` setCookie, `settings/+page.svelte` (copy 99/207-209 + `sanitizeRedirect`) | "cookie no Secure", "inaccurate copy", "unvalidated redirect" | small | low | — |
| **sec-csv-formula-injection** | Neutralize spreadsheet formula injection in CSV | `CollectionExport.svelte` `escapeCsv` (prefix `= + - @ \t \r`) | "CSV formula injection" | trivial | low | refactor-shared-utils* |
| **sec-api-error-hygiene** | Stop forwarding upstream `statusText`/status | `discogs.ts` fetchDiscogs final throw → generic message + normalized 502/500 | "statusText forwarded" | trivial | low | sec-username-matcher |

\* `sec-csv-formula-injection` lightly overlaps `CollectionExport.svelte` with `refactor-shared-utils`; land shared-utils first, then wrap `escapeCsv` around `formatArtists` output.

**discogs.ts note:** `sec-api-error-hygiene` (trivial, one branch) lands first; the Phase-4 `refactor-error-handling-discogs` rebases its 401 branch on top.

---

## Phase 3 — Performance (cache + render)

Depends on `perf-kv-cache-helper` (Phase 0) and, for the profile pipeline, `refactor-profile-decompose` (Phase 1).

| PR id | Title | Scope | Closes | Effort | Risk | dependsOn |
|---|---|---|---|---|---|---|
| **perf-profile-loading-pipeline** | Batch appends, single-pass stats, stable highlights, non-silent 429 | `+page.svelte` (loader $effect 66-96, randomHighlights 251 via `sampleN`), `discogs.ts` computeCollectionStats single-pass | O(n²) appends, no pacing/silent 429, reshuffle, two-pass stats | large | medium | refactor-profile-decompose |
| **perf-value-estimator** | KV-back price cache, 429 retry, stable client sample | value `+server.ts` (cache/fetch-loop), `ValueEstimate.svelte`, `constants.ts` | "per-isolate price cache", "over-fetch/re-sample", "no 429 retry" | medium | medium | perf-kv-cache-helper, sec-value-endpoint-hardening |
| **widget-hardening** *(merged)* | KV-backed widget cache, env username, cache/CORS headers | `api/widget/+server.ts`, `constants.ts` | "widget per-isolate cache", "hardcoded user/unauth" | small | low | perf-kv-cache-helper |
| **perf-collection-cache-headers** | `private` Cache-Control on `/api/collection` + SWR background refresh | `api/collection/[username]/+server.ts` | "no Cache-Control", "SWR consumer side" | small | low | perf-kv-cache-helper |
| **perf-collection-browser-derivation** | Search blob + facets-from-stats in CollectionBrowser | `CollectionBrowser.svelte` (facet-from-stats prop **optional** so no `+page.svelte` edit) | "re-filter/re-derive facets" | medium | low | — |
| **perf-component-render-tweaks** | CoverGrid key, YearHeatmap Map, Calendar precomputed titles, LazyImage IO | `CoverGrid.svelte`, `YearHeatmap.svelte`, `CollectingCalendar.svelte`, `LazyImage.svelte` | 4 component findings | medium | low | refactor-profile-decompose (soft) |

**Critical sequencing — value endpoint:** `value/[username]/+server.ts` is edited by `sec-value-endpoint-hardening` (auth/validation), `perf-value-estimator` (cache/fetch loop), and `refactor-error-handling-endpoints` (per-release $0). Split by region; **land in order security → perf → quality-endpoints.**

---

## Phase 4 — Quality (errors + presentation) & remaining deploy

| PR id | Title | Scope | Closes | Effort | Risk | dependsOn |
|---|---|---|---|---|---|---|
| **refactor-error-handling-discogs** | 401→BAD_TOKEN, JSON guard, statusText mapping, median fix | `discogs.ts` (fetchDiscogs 47-77 + median 257-261), `types/discogs.ts`, both loaders (BAD_TOKEN→/settings) | "401 not mapped", "casts unvalidated JSON", "statusText leak", "median wrong" | medium | medium | refactor-shared-utils, sec-api-error-hygiene |
| **refactor-error-handling-endpoints** | Compare 404→500, test-token typing, per-release $0 failedCount | compare `+page.server.ts:191`, `test-token/+server.ts`, value `+server.ts` | "compare 404 fallthrough", "test-token any", "per-release $0" | medium | low | refactor-error-handling-discogs |
| **refactor-presentation-extraction** | Extract SiteNav/SiteFooter, brand colors→CSS vars | 5 route files + `+error.svelte` + BarChart/DonutChart + `app.css` + `constants.ts` (BRAND_PALETTE); edits `+page.svelte` CSS region 728-933 | "nav/footer duplicated", "brand hex hardcoded ×22" | medium | medium | refactor-profile-decompose |
| **deploy-single-svelte-config** | One env-selected svelte config + CI node-build job | `svelte.config.js` (ADAPTER branch), delete `svelte.config.docker.js`, `Dockerfile`, `ci.yml` build-node job | "two divergent configs" | medium | medium | deploy-adapter-node-pin, sec-headers-and-csp* |
| **deploy-env-validation** | Fail-fast env validation **into existing** `hooks.server.ts` + `.env.example` | extend `src/hooks.server.ts` handle, `.env.example` | "no fail-fast env validation" | small | medium | sec-headers-and-csp |
| **deploy-ci-security-scanning** | npm audit, dependency-review, Dependabot, CodeQL | `ci.yml` (+job), new `dependabot.yml`, `codeql.yml` | "no dependency audit/scanning" | small | low | — |
| **deploy-wrangler-and-coverage-ratchet** | Bump `compatibility_date`, ratchet coverage to ~55% | `wrangler.toml`, `vite.config.ts` | "stale compatibility_date", "weak 40% gate" | small | medium | — |

\* `sec-headers-and-csp` puts CSP in both configs; `deploy-single-svelte-config` collapses them — move CSP into the surviving config. The "readCache shape validation" finding is closed in Phase 0 — drop it from the endpoints PR. `ci.yml`: single-config and security-scanning add disjoint jobs (rebase, mechanical).

---

## Phase 5 — Features (after their dependencies)

| PR id | Title | Effort | Risk | dependsOn |
|---|---|---|---|---|
| **feat-album-grouping-utils** | Album grouping/normalization util (pure fns) | small | low | refactor-shared-utils |
| **feat-a11y-ux-quick-wins** | type=search, section-nav+back-to-top, aria-live, mobile header, drawer scroll-lock | medium | medium | refactor-profile-decompose |
| **feat-reduced-motion** | `prefers-reduced-motion` for scroll + reveal | small | low | perf-profile-loading-pipeline (soft) |
| **feat-most-valuable-records** | Surface per-item prices, ranked top-20 | medium | medium | perf-value-estimator |
| **feat-duplicate-variant-detector** | Duplicate & Variant Detector section | small | low | feat-album-grouping-utils, feat-a11y-ux-quick-wins |
| **feat-format-upgrades** | Format & Pressing Upgrade Nudges | small | low | feat-album-grouping-utils, feat-a11y-ux-quick-wins |
| **feat-keyboard-help-overlay** | `?` help overlay | small | low | feat-a11y-ux-quick-wins |
| **feat-empty-low-data-states** | Empty/low-data states | medium | low | feat-a11y-ux-quick-wins |
| **feat-active-filter-chips** | Active-filter chips | small | low | feat-a11y-ux-quick-wins, perf-collection-browser-derivation |
| **feat-printable-insurance-export** | Printable/valued/Discogs-CSV export | medium | low | sec-csv-formula-injection, refactor-shared-utils, feat-most-valuable-records |
| **feat-token-aware-error-and-onboarding** | 401 error page + onboarding callout | medium | low | refactor-error-handling-discogs |
| **feat-value-history-kv** | KV-backed value snapshots + trend chart | large | medium | perf-kv-cache-helper, sec-username-matcher, feat-most-valuable-records |

**`+page.svelte` serialization in features:** `feat-a11y-ux-quick-wins` owns the navSections array + section-id scaffolding; land it first, then other feature sections only **append**. Drawer scroll-lock must precede any other CollectionDrawer editor.

---

## Per-PR Checklist Template

```
[ ] git checkout master && git pull
[ ] git checkout -b <pr-id>            # branch from master, never commit to master
[ ] Bump version in package.json (repo convention: bump before each commit/deploy)
[ ] Implement scoped changes (stay within this PR's declared files/regions)
[ ] If route dirs were renamed: npx svelte-kit sync   # regenerate $types
[ ] npx svelte-check                   # must be clean
[ ] npx vitest run                     # all unit tests green (add the PR's new tests)
[ ] npm run test:e2e                   # only if the PR touches UI/routes/CSP
[ ] <PR-specific verification>         # KV hit on 2nd load, curl -I for headers, 401→/settings, CSV opens as text, etc.
[ ] git commit  (imperative subject; end body with:)
        Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
[ ] Open PR; declare dependsOn in the description; note any shared-file coordination
```

Deploy-path PRs additionally run: `ADAPTER=node npm run build && node build` (node smoke) and/or a Cloudflare preview deploy (required for the wrangler date bump and the single-config PR).

---

## Dependency Map (PR id → dependsOn)

```
# Phase 0 (Foundations)
refactor-constants-centralize        -> (none)
perf-kv-cache-helper                 -> (none)
refactor-shared-utils                -> (none)   [edit discogs.ts AFTER username-matcher]
sec-username-matcher                 -> (none)
deploy-adapter-node-pin              -> (none)
sec-headers-and-csp                  -> (none)
# Phase 1
refactor-profile-decompose           -> refactor-constants-centralize
# Phase 2
perf-cache-large-collections         -> perf-kv-cache-helper
sec-value-endpoint-hardening         -> sec-username-matcher
sec-cookie-and-token-storage         -> (none)
sec-csv-formula-injection            -> refactor-shared-utils
sec-api-error-hygiene                -> sec-username-matcher
# Phase 3
perf-profile-loading-pipeline        -> refactor-profile-decompose
perf-value-estimator                 -> perf-kv-cache-helper, sec-value-endpoint-hardening
widget-hardening                     -> perf-kv-cache-helper
perf-collection-cache-headers        -> perf-kv-cache-helper
perf-collection-browser-derivation   -> (none)
perf-component-render-tweaks         -> refactor-profile-decompose (soft)
# Phase 4
refactor-error-handling-discogs      -> refactor-shared-utils, sec-api-error-hygiene
refactor-error-handling-endpoints    -> refactor-error-handling-discogs
refactor-presentation-extraction     -> refactor-profile-decompose
deploy-single-svelte-config          -> deploy-adapter-node-pin, sec-headers-and-csp
deploy-env-validation                -> sec-headers-and-csp
deploy-ci-security-scanning          -> (none)
deploy-wrangler-and-coverage-ratchet -> (none)
# Phase 5
feat-album-grouping-utils            -> refactor-shared-utils
feat-a11y-ux-quick-wins              -> refactor-profile-decompose
feat-reduced-motion                  -> perf-profile-loading-pipeline (soft)
feat-most-valuable-records           -> perf-value-estimator
feat-duplicate-variant-detector      -> feat-album-grouping-utils, feat-a11y-ux-quick-wins
feat-format-upgrades                 -> feat-album-grouping-utils, feat-a11y-ux-quick-wins
feat-keyboard-help-overlay           -> feat-a11y-ux-quick-wins
feat-empty-low-data-states           -> feat-a11y-ux-quick-wins
feat-active-filter-chips             -> feat-a11y-ux-quick-wins, perf-collection-browser-derivation
feat-printable-insurance-export      -> sec-csv-formula-injection, refactor-shared-utils, feat-most-valuable-records
feat-token-aware-error-and-onboarding-> refactor-error-handling-discogs
feat-value-history-kv                -> perf-kv-cache-helper, sec-username-matcher, feat-most-valuable-records
```

## Parallelization callout

- **Fully independent tracks (any time, concurrent):** `deploy-ci-security-scanning`, `deploy-wrangler-and-coverage-ratchet`, `perf-collection-browser-derivation`, `sec-cookie-and-token-storage`, plus the LazyImage/YearHeatmap/Calendar component tweaks.
- **Shared-file serialization (one at a time):**
  - `src/routes/u/[username]/+page.svelte`: `refactor-profile-decompose` → `perf-profile-loading-pipeline` → `refactor-presentation-extraction` → `feat-a11y-ux-quick-wins` → (other feature sections append).
  - `src/lib/api/discogs.ts`: `sec-username-matcher` → `refactor-shared-utils` → `sec-api-error-hygiene` → `refactor-error-handling-discogs`.
  - `src/routes/api/value/[username]/+server.ts`: `sec-value-endpoint-hardening` → `perf-value-estimator` → `refactor-error-handling-endpoints`.
  - `src/lib/server/cache.ts` + `src/app.d.ts`: only `perf-kv-cache-helper` edits these.
  - `Dockerfile`: `deploy-adapter-node-pin` → `deploy-single-svelte-config`. `ci.yml`: disjoint jobs (rebase).
  - `hooks.server.ts`: `sec-headers-and-csp` creates → `deploy-env-validation` extends.

---

## Suggested first three PRs to start now

1. **perf-cache-large-collections** — the single **high-severity** finding and highest-payoff fix. Depends on **perf-kv-cache-helper**, so start that helper immediately (Foundation #1) and this lands right behind it. Touches `+page.server.ts` (loader, not `+page.svelte`), so no collision with profile decomposition.
2. **sec-username-matcher** — foundational and the biggest churn source: it `git mv`s four route directories and regenerates `$types`, so it must land before any PR edits files inside those dirs. Landing it first removes a class of merge conflicts for the entire roadmap; closes a medium security finding plus the compare-redirect nit.
3. **refactor-constants-centralize** — tiny, low-risk, zero-conflict (additive + one deletion), and the prerequisite for `refactor-profile-decompose` (the gate that unblocks the whole `+page.svelte` track).

Together these three are mutually independent (different files), kick off the two longest dependency chains (cache helper → cache fix; constants → decompose → perf/features), and clear the highest-churn route-rename hazard before any parallel work begins.
