# The Shelf Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every page of Record Shelf the approved "Shelf" look and rebuild the profile as five tabs with the collection drawn as record spines on shelves.

**Architecture:** One branch, `shelf-redesign`, from `master` @ bfa75b6. Stage 1 puts a single set of colour and size tokens in `src/app.css`, a shared top bar and footer in the root layout, and converts every component to the tokens; a unit test ("the look guard") fails if any converted file still holds its own colours, corner radii, shadows or fades. Stages 2 to 7 then redraw the profile tab by tab and finish the other pages. Pure logic (tabs and addresses, spines and shelves, chart helpers) lives in small `.ts` modules with unit tests; components stay thin.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Vitest + Testing Library, Playwright, hand-made SVG/CSS charts, Cloudflare Pages via wrangler. One new dev dependency: `@fontsource-variable/bricolage-grotesque`.

**Spec:** `docs/superpowers/specs/2026-11-14-shelf-redesign-design.md`. Read it before any task. The mockup sources it points to are in `.superpowers/sdd/mockups/redesign-directions/project/` (`Main.dc.html` has all five tabs and the phone variant; `ShelfDark.dc.html` the dark Overview). They are the reference for any measurement not given here.

## Global Constraints

- The server on Cloudflare must never call Discogs. No new request from the server to anywhere.
- Do not touch: `src/lib/sync/*`, `src/lib/server/*`, `src/routes/api/*`, `src/hooks.server.ts`, `wrangler.toml`, the `STORE_WRITERS` secret, the CSP in `svelte.config.js`.
- No chart library and no CSS framework. Charts stay hand-made SVG and CSS.
- Both builds must work: `npm run build` (Cloudflare) and the same with `ADAPTER=node`.
- Switching tabs must not restart the loader, re-read the store, or cause any Discogs call.
- Every card on today's profile keeps its information and its click behaviour (spec table "Where every card goes").
- The mockups fix the look, not the feature list: where a mockup shows a control today's component lacks, today's behaviour wins ("Estimate again" is not built).
- Labels are sentence case. Use the mockup's wording where the mockup shows one, today's wording otherwise. Loading-banner and Settings wording do not change.
- Font files are served from the site itself. No request to Google or any third party.
- Meaning is never carried by colour alone. Text is never in a chart colour.
- Square corners everywhere except the logo mark, the refresh button and the growth line's end dot. No drop shadows, no colour fades, no card boxes.
- Colours: exactly the values in the spec's tables ("Colours", "Charts"). Do not invent others.
- Theme: the three states (system, light, dark), the storage key `record-shelf-theme` and `static/theme-init.js` behaviour keep working.
- Lighthouse on `/` stays at 0.9 or better for accessibility and best practices.
- Commits: plain `git commit` on `shelf-redesign` only. Never put an email address in a command. End each commit message with the attribution lines your session gives you. Do not push, merge, or deploy to production without the owner's word each time.
- `STORE_WRITERS` is not changed anywhere. The preview runs without it.
- Every bar, cell and segment has its number in text beside it, or reachable by hover and by keyboard focus.
- The branch `worktree-token-header` is not merged into this work.
- Browser tests reuse a server already listening on port 4173. Make sure nothing is listening there before `npm run test:e2e` or the look screenshots, so they build fresh.

## Permissions

The owner's approval of this plan covers: creating the branch `shelf-redesign`, commits on it, installing the one font package, and preview deploys of that branch. It does not cover: pushing to GitHub, merging to `master`, the production deploy, or anything about `STORE_WRITERS`. Ask each time for those.

## Stage Gate

Run this at the end of every stage. It is referenced as "Run the Stage Gate".

- [ ] `npm run check` → 0 errors.
- [ ] `npm test` → all pass.
- [ ] `npm run test:e2e` → all pass.
- [ ] `$env:ADAPTER='node'; npm run build; Remove-Item Env:ADAPTER` → builds. Then `npm run build` → builds.
- [ ] Look: `$env:LOOK='1'; npx playwright test e2e/look.test.ts; Remove-Item Env:LOOK`, then open every PNG under `test-results/look/` for the pages this stage changed (1280 and 390 wide, light and dark) and compare with the mockup frame for that page. Fix what is off before going on.
- [ ] Preview deploy:
  ```
  npx wrangler pages deploy .svelte-kit/cloudflare `
    --project-name record-shelf `
    --branch shelf-redesign
  ```
  Expected: wrangler prints a preview address (`shelf-redesign.record-shelf.pages.dev`). On the first deploy, fetch `/api/status` from it and record in the ledger whether the store is bound and whether writers are set.
- [ ] Hand over to the owner in plain language: the address, what changed and what to look at, "paste your Discogs token into Settings there once", and "if it says updating on every load, open the live site first". Then stop and wait for their reaction. Apply what they ask before starting the next stage, and record it in `.superpowers/sdd/2026-11-14-discogs-stored-copies/progress.md`.

## Review Focus

Inputs the spec implies but does not spell out. Each has a test in the task named.

1. **Records with thin or odd format data** (no `formats`, `qty` empty or not a number, no `descriptions`): the spine is one unit wide and full height; no `NaN` reaches the page. → Task 8.
2. **Unknown years and ties** (`year` 0, many records in one year): unknown years go last; a shelf's title ignores them ("1957 to 1979"), and a shelf of only unknown years is titled "Year unknown"; order is stable between visits. → Task 8.
3. **Collection size extremes** (0, 1, 10, 5,000 records): one board and "Nothing on the shelf yet." for none; a partly filled, left-aligned shelf for few; capped shelves and "Show the whole shelf" for many. → Tasks 8 and 9.
4. **Addresses people already have or mistype** (`?tab=bogus`, `?genre=Rock` with no `tab` from an old link, `?tab=records&genre=Rock&page=3`): unknown tab shows Overview; a Records filter with no tab opens Records with the filter applied; filters and tab live together. → Task 7.
5. **Long and non-Latin names** (a 30-character username in the page title, a 90-character album title, titles in scripts the font lacks): the title wraps without sideways scrolling at 390px; rows wrap or cut with an ellipsis; the hover label stays inside the page. → Tasks 7 and 9.

---

## File Structure

New files (all paths under the repo root):

| File | Responsibility |
|---|---|
| `src/lib/theme/tokens.ts` | The token values as TypeScript, for the share picture and for tests |
| `src/lib/theme/tokens.test.ts` | `src/app.css` and `tokens.ts` agree; the two dark blocks agree |
| `src/lib/theme/look.test.ts` | The look guard |
| `src/lib/frame/links.ts` (+ test) | Which links the top bar shows on which page |
| `src/lib/frame/frame.svelte.ts` | Context that lets the profile page give the top bar its refresh action and the footer its help action |
| `src/lib/components/frame/TopBar.svelte`, `SiteFooter.svelte`, `BackToTop.svelte` | The shared frame |
| `src/lib/profile/tabs.ts` (+ test) | Tabs, addresses, Records filter addresses |
| `src/lib/components/profile/ProfileTabs.svelte` | The tab row |
| `src/lib/components/profile/TabOverview.svelte`, `TabRecords.svelte`, `TabCharts.svelte`, `TabActivity.svelte`, `TabExtras.svelte` | One per tab; each lays out its sections |
| `src/lib/shelf/spines.ts` (+ test) | What a spine looks like, shelf order, splitting into shelves, when to draw |
| `src/lib/components/shelf/Shelf.svelte` (+ test) | The shelf |
| `src/lib/components/profile/JustAdded.svelte`, `AtAGlance.svelte` | Overview sections |
| `src/lib/components/SplitBar.svelte` | A thin bar split by share, with legend |
| `src/lib/components/FormatBreakdown.svelte` | "By format": split bar over expandable rows |
| `src/lib/utils/genreEvolution.ts` (+ test) | The five-genre rule |
| `src/lib/utils/share.ts` (+ test) | Share address and evenly sampled spines |
| `e2e/fixtures/collection.ts` | A made-up collection in a realistic mix, and route mocks |
| `e2e/look.test.ts` | Opt-in screenshots for looking at pages |
| `e2e/tabs.test.ts` | Tabs, addresses, shelf |

Deleted along the way: `BrandNav.svelte`, `FloatingActions.svelte`, `SectionNav.svelte`, `DonutChart.svelte`, `StatCard.svelte` (+ test), `RecentlyAdded.svelte`, `FormatDrilldown.svelte`, `profile/ProfileHeader.svelte`, `profile/ProfileOverview.svelte`, `profile/ProfileCollection.svelte`, `profile/ProfileCharts.svelte`, `profile/ProfileActivity.svelte`, `profile/ProfileInsights.svelte`, `profile/ProfileShare.svelte`, `profile/OldestNewestHighlights.svelte`, and `LazySection.svelte` if nothing uses it at the end.

---

# Stage 1: Foundation

### Task 0: Branch

- [ ] `git status` → on `master` at bfa75b6, nothing changed except possibly the uncommitted spec and this plan under `docs/superpowers/`.
- [ ] `git switch -c shelf-redesign`
- [ ] If the spec and plan are uncommitted: `git add docs/superpowers`, then `git commit -m "docs: shelf redesign design and plan"` (on the branch, not on `master`).

### Task 1: Tokens, base styles, font, and the look guard

**Files:**
- Modify: `src/app.css` (rewrite), `src/routes/+layout.svelte` (font import only), `package.json`
- Create: `src/lib/theme/tokens.ts`, `src/lib/theme/tokens.test.ts`, `src/lib/theme/look.test.ts`

**Interfaces:**
- Produces, CSS custom properties on `:root` (light) with dark values in both `html[data-theme="dark"]` and `@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) }`:
  - `--ground --ink --muted --hairline --track --accent --on-ink`
  - `--spine-1` … `--spine-9` (spec order: ink, cream, tan, grey, red, blue, mustard, green, plum), `--spine-edge` (light `rgba(24,32,28,0.3)`, dark `rgba(0,0,0,0.45)`), `--cover-edge` (light `rgba(24,32,28,0.12)`, dark `rgba(232,235,227,0.16)`)
  - `--chart-1` … `--chart-5`, `--chart-other`, `--shade-1` … `--shade-5`
  - not themed: `--font-sans`, `--rule: 4px`, `--section-gap: 56px`, `--page-max: 1280px`, `--page-pad: clamp(20px, 4.4%, 56px)`, `--control: 52px`, `--touch: 44px`
- Produces, global classes in `src/app.css`: `.page` (max width and side padding), `.section` (4px ink top rule, 16px above its `h2`; `h2` 28px/700/-0.01em), `.rows > *` (1px hairline between rows), `.cols` (flex wrap, gap `56px 64px`) with `.col-wide` (`flex: 3 1 480px`) and `.col-narrow` (`flex: 2 1 320px`), `.btn` + `.btn-primary` + `.btn-secondary`, `.field` (underlined input or select), `.lead`, `.muted`, `.small` (15px muted), `.figure` (34px/800), `.cover` (square, inner edge), `.error-note` (ink text, 4px accent rule on the left), `.visually-hidden`.
- Produces, `src/lib/theme/tokens.ts`: `LIGHT` and `DARK` (objects with keys `ground ink muted hairline track accent onInk`), `SPINES_LIGHT`, `SPINES_DARK` (9 strings each), `CHART_LIGHT`, `CHART_DARK` (5 each), `CHART_OTHER_LIGHT`, `CHART_OTHER_DARK`, `SHADES_LIGHT`, `SHADES_DARK` (5 each). Values copied from the spec.
- Produces, `look.test.ts`: `PENDING`, an array of repo-relative paths still exempt. Later tasks delete entries; a task that deletes or moves a pending file deletes its entry too. Files not in `PENDING`, including every new file, are checked from the moment they exist.

- [ ] **Step 1: Install the font.** `npm install -D @fontsource-variable/bricolage-grotesque@^5.3.0`. Read its README for the weight-axis stylesheet name and the `font-family` string it declares.

- [ ] **Step 2: Write `src/lib/theme/tokens.test.ts` (failing).** It reads `src/app.css` as text and parses `--name: value;` pairs per block.

```ts
it('light tokens in app.css match tokens.ts', () => {
	expect(root['--ground']).toBe(LIGHT.ground);          // and ink, muted, hairline, track, accent, on-ink
	SPINES_LIGHT.forEach((c, i) => expect(root[`--spine-${i + 1}`]).toBe(c));
	CHART_LIGHT.forEach((c, i) => expect(root[`--chart-${i + 1}`]).toBe(c));
	SHADES_LIGHT.forEach((c, i) => expect(root[`--shade-${i + 1}`]).toBe(c));
});
it('dark tokens match tokens.ts in both dark blocks', () => {
	expect(darkAttr).toEqual(darkMedia);                  // the two blocks declare the same pairs
	expect(darkAttr['--ground']).toBe(DARK.ground);       // and the rest, as above with *_DARK
});
it('text colours clear 4.5:1 on their ground', () => {
	for (const t of [LIGHT, DARK]) {
		expect(contrast(t.ink, t.ground)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(t.muted, t.ground)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(t.accent, t.ground)).toBeGreaterThanOrEqual(4.5);
	}
});
it('every shade holds ink or ground text at 4.5:1', () => { /* max(contrast(shade, ink), contrast(shade, ground)) >= 4.5 for all ten */ });
```

- [ ] **Step 3: Write `src/lib/theme/look.test.ts` (failing).** It walks `src/**/*.svelte` plus `src/app.css` (outside the token blocks) and, for every file not in `PENDING`, fails with the file and line on any of:
  - a hex colour (`#` + 3, 4, 6 or 8 hex digits) or `rgb(`, `rgba(`, `hsl(`
  - `linear-gradient(` not preceded by `repeating-`; any `radial-gradient(`
  - `box-shadow:` whose value does not start with `inset` or `none`
  - `border-radius:` other than `0` or `50%`
  - `var(--color-`, `var(--gradient-`, `var(--shadow-`
  - `text-transform: uppercase`

  Start `PENDING` with every `.svelte` file under `src/` (list them explicitly). Add one test that every `PENDING` entry exists on disk, so the list cannot rot.

- [ ] **Step 4: Run both.** `npx vitest run src/lib/theme` → tokens test FAILS (no tokens yet); look guard passes (everything is pending).

- [ ] **Step 5: Rewrite `src/app.css`** with the tokens and classes above and these element rules: `html` uses `--font-sans` (`'<family from the package>', 'Segoe UI', system-ui, sans-serif`), line-height 1.4; `body` ground and ink; `h1` `clamp(44px, 6.9vw, 88px)`/800/-0.03em/0.95, 40px under 700px wide; links ink, underlined, 4px offset, accent on hover; `:focus-visible` 2px ink outline, 3px offset; `::selection` ink on ground reversed. Keep `.skip-link`, `.spinner`, the reduced-motion block. Remove the `fadeIn` animation. Keep a clearly marked **temporary** block that (a) aliases every old name to a new token (`--color-bg: var(--ground)`, `--color-bg-card: var(--ground)`, `--color-bg-secondary` and `-tertiary: var(--track)`, `--color-text: var(--ink)`, `--color-text-secondary` and `-tertiary: var(--muted)`, `--color-border` and `-light: var(--hairline)`, `--color-primary` and `-hover: var(--ink)`, `--color-accent: var(--accent)`, the four `--gradient-*: var(--ink)`, the three `--shadow-*: none`) and (b) restyles `.card` as `.section` (no box, no radius, no background). Task 20 deletes this block.

- [ ] **Step 6: Import the font stylesheet** at the top of `src/routes/+layout.svelte`'s script, next to `'../app.css'`.

- [ ] **Step 7: Run.** `npx vitest run src/lib/theme` → PASS. `npm run check` → 0 errors. `npm run build` → builds, and `.svelte-kit/cloudflare/_app/immutable/assets` contains `.woff2` files.

- [ ] **Step 8: Commit.** `git add -A` then `git commit -m "feat: shelf tokens, base styles, self-hosted font and the look guard"`

### Task 2: A made-up collection and a way to look at pages

**Files:**
- Create: `e2e/fixtures/collection.ts`, `e2e/look.test.ts`

**Interfaces:**
- Produces: `makeCollection(n: number, seed?: number): DiscogsCollectionItem[]`. Deterministic. Mix: 84% single LP (`formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }]`), 8% double LP (`qty: '2'`), 4% 7-inch (`descriptions: ['7"', '45 RPM', 'Single']`), 2% 10-inch (`['10"']`), 2% CD. Years spread 1955 to 2024 with a hump in the 1970s; about 1% with `year: 0`. Eight genres with a skew; `date_added` spread over the last six years; some ratings; three records with 90-character titles and two with non-Latin titles.
- Produces: `withToken(pw: Page): Promise<void>`; `mockStored(pw: Page, username: string, items: DiscogsCollectionItem[]): Promise<{ collectionCalls: () => number; discogsCalls: () => number }>` (answers the sync API the way `e2e/profile.test.ts` does for a complete stored copy, 100 per page, and aborts and counts any call to `api.discogs.com`); `mockStoredWantlist(pw, username, n)`.

- [ ] **Step 1: Write the fixture.** Follow the shapes in `e2e/profile.test.ts` lines 3 to 41 and `src/lib/sync/types.ts`.
- [ ] **Step 2: Write `e2e/look.test.ts`.** `test.skip(!process.env.LOOK, 'opt-in')`. For user `lookuser` with `makeCollection(679)`: for each of `/`, `/settings`, `/compare`, `/u/lookuser`, `/u/lookuser?tab=records`, `?tab=charts`, `?tab=activity`, `?tab=extras`, `/u/lookuser/wantlist`; for widths 1280×900 and 390×844; for `colorScheme` light and dark (`pw.emulateMedia`): wait for the network to settle, then `pw.screenshot({ fullPage: true, path: 'test-results/look/<slug>-<width>-<scheme>.png' })`. No assertions.
- [ ] **Step 3: Run.** `$env:LOOK='1'; npx playwright test e2e/look.test.ts; Remove-Item Env:LOOK` → PNGs appear under `test-results/look/` (the `?tab=` pages look like the plain profile until Task 7). `npm run test:e2e` → the look test is skipped; the rest pass.
- [ ] **Step 4: Commit.** `git commit -m "test: made-up collection fixture and opt-in look screenshots"`

### Task 3: The shared frame

**Files:**
- Create: `src/lib/frame/links.ts`, `src/lib/frame/links.test.ts`, `src/lib/frame/frame.svelte.ts`, `src/lib/components/frame/TopBar.svelte`, `src/lib/components/frame/BackToTop.svelte`
- Move and rewrite: `src/lib/components/SiteFooter.svelte` → `src/lib/components/frame/SiteFooter.svelte`
- Modify: `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/+error.svelte`, `src/routes/settings/+page.svelte`, `src/routes/compare/+page.svelte`, `src/routes/compare/[user1=username]/[user2=username]/+page.svelte`, `src/routes/u/[username=username]/+page.svelte`, `src/routes/u/[username=username]/wantlist/+page.svelte`, `src/lib/components/profile/ProfileHeader.svelte`, `e2e/smoke.test.ts`
- Delete: `src/lib/components/BrandNav.svelte`, `src/lib/components/FloatingActions.svelte`

**Interfaces:**
- Produces, `links.ts`:
  ```ts
  export interface BarLink { label: string; href: string; external?: boolean }
  export function barLinks(routeId: string | null, params: Record<string, string>): BarLink[];
  export function hasRefresh(routeId: string | null): boolean; // true only for '/u/[username=username]'
  ```
- Produces, `frame.svelte.ts`:
  ```ts
  export interface Frame { refresh: { busy: boolean; run: (() => void) | null }; help: (() => void) | null }
  export function initFrame(): Frame; // root layout: creates $state and setContext
  export function useFrame(): Frame;  // anywhere below: getContext
  ```
  Context, not a module-level variable: module state is shared between visitors on the server.

- [ ] **Step 1: Write `links.test.ts` (failing).**
```ts
it('profile', () => expect(barLinks('/u/[username=username]', { username: 'bob' })).toEqual([
	{ label: 'Wantlist', href: '/u/bob/wantlist' },
	{ label: 'Discogs', href: 'https://www.discogs.com/user/bob', external: true },
	{ label: 'Settings', href: '/settings' }
]));
it('wantlist', () => expect(barLinks('/u/[username=username]/wantlist', { username: 'bob' })).toEqual([
	{ label: 'Collection', href: '/u/bob' }, { label: 'Settings', href: '/settings' }
]));
it('everywhere else', () => {
	const other = [{ label: 'Compare', href: '/compare' }, { label: 'Settings', href: '/settings' }];
	for (const id of ['/', '/settings', '/compare', '/compare/[user1=username]/[user2=username]', null]) expect(barLinks(id, {})).toEqual(other);
});
it('refresh only on the profile', () => {
	expect(hasRefresh('/u/[username=username]')).toBe(true);
	expect(hasRefresh('/u/[username=username]/wantlist')).toBe(false);
});
it('a username is encoded in hrefs', () => expect(barLinks('/u/[username=username]', { username: 'a b' })[0].href).toBe('/u/a%20b/wantlist'));
```
- [ ] **Step 2: Run** `npx vitest run src/lib/frame` → FAIL. **Implement `links.ts`** → PASS.
- [ ] **Step 3: Build the components.**
  - `TopBar.svelte`: no props; reads `page` from `$app/state` and `useFrame()`. Left: `<a href="/" aria-label="Record Shelf home">` with the ring-and-dot mark (SVG from `Main.dc.html`) and the words "Record Shelf", words hidden under 700px. Right: `barLinks(...)` as 44px-high links (17px/500); when `hasRefresh(...)`, a round 44px button `aria-label="Refresh collection"`, disabled while `frame.refresh.run` is null, its icon turning while `frame.refresh.busy`.
  - `SiteFooter.svelte`: hairline, "© {year} Record Shelf. Not affiliated with Discogs.", a text button `class="theme-toggle"` whose text is `Theme: {$theme}` and which cycles system → light → dark as the layout's `cycleTheme` does today, and, when `frame.help` is set, a text button "Keyboard shortcuts".
  - `BackToTop.svelte`: square 44px secondary button, fixed bottom right, `aria-label="Back to top"`, shown only after scrolling one screen height.
- [ ] **Step 4: Wire the root layout.** `initFrame()`; render `TopBar`, the page, `SiteFooter`, `BackToTop` inside one `.page` wrapper. Remove the floating theme button and its styles. Set `<meta name="theme-color">` to `#ECEEE8`, or `#131815` when the theme is dark.
- [ ] **Step 5: Remove each page's own navigation and footer:** `BrandNav` and `SiteFooter` uses, the home page's Settings and Compare links and footer, the wantlist's "Back to Collection" bar, the Settings page's own back link and footer if it has them, `FloatingActions`. Delete the entries for the deleted and moved files from `PENDING`. In `ProfileHeader.svelte` remove the refresh button and the three links (the avatar, name, location and badges stay until Task 7). In the profile page, set `frame.refresh.run = () => loader.refresh()` and keep `frame.refresh.busy` in step with `s.phase` inside an `$effect` that clears both on teardown; set `frame.help` the same way.
- [ ] **Step 6: Update `e2e/smoke.test.ts`.** `page.locator('a.home-link')` → `page.getByRole('link', { name: 'Record Shelf home' })`. Theme tests: `toggle` stays `.theme-toggle`; replace the three `aria-label` expectations with `await expect(toggle).toHaveText('Theme: system')`, then `'Theme: light'`, `'Theme: dark'`, `'Theme: system'`.
- [ ] **Step 7: Run** `npm run check`, `npm test`, `npm run test:e2e` → all pass.
- [ ] **Step 8: Commit.** `git commit -m "feat: shared top bar and footer on every page"`

### Task 4: Convert the pages to the tokens

**Files:**
- Modify: `src/routes/+page.svelte`, `src/routes/+error.svelte`, `src/routes/+layout.svelte`, `src/routes/settings/+page.svelte`, `src/routes/compare/+page.svelte`, `src/routes/compare/[user1=username]/[user2=username]/+page.svelte`, `src/routes/u/[username=username]/+page.svelte`, `src/routes/u/[username=username]/wantlist/+page.svelte`, `src/lib/theme/look.test.ts`

- [ ] **Step 1:** Delete these eight paths from `PENDING`. `npx vitest run src/lib/theme/look.test.ts` → FAIL, listing every offending line.
- [ ] **Step 2:** Fix every listed line. Mapping: old `--color-*` aliases → the new token they alias; brand and accent fills → `var(--ink)`; pale backgrounds → `var(--track)` or none; borders → `var(--hairline)`; error reds → `.error-note`; fades → a flat token; shadows → removed; radii → `0` (or `50%` for genuinely round things); uppercase labels → sentence case in the markup. Buttons, inputs and selects take `.btn*` and `.field`. Keep each page's layout and content. On Compare, the first person is `var(--chart-1)` and the second `var(--chart-2)`, shown with a swatch legend beside ink text.
- [ ] **Step 3:** `npx vitest run src/lib/theme/look.test.ts` → PASS. `npm run check` → 0 errors. Look at `/`, `/settings`, `/compare`, wantlist screenshots, light and dark, both widths.
- [ ] **Step 4: Commit.** `git commit -m "feat: pages read the shelf tokens"`

### Task 5: Convert the list, cover and overlay components

**Files (remove each from `PENDING`, then fix):** `CollectionBrowser.svelte`, `browser/FilterControls.svelte`, `browser/Pagination.svelte`, `browser/RecordCard.svelte`, `browser/SearchBar.svelte`, `browser/SortToolbar.svelte`, `CollectionDrawer.svelte`, `CoverGrid.svelte`, `DuplicateDetector.svelte`, `FormatUpgrades.svelte`, `KeyboardHelp.svelte`, `LazyImage.svelte`, `LazySection.svelte`, `RecentlyAdded.svelte`, `SkeletonProfile.svelte`, `SkeletonWantlist.svelte`, `StatCard.svelte`, `TopList.svelte`, `profile/LoadingBanner.svelte`, `profile/ProfileHeader.svelte`, `profile/ProfileOverview.svelte`, `profile/ProfileCollection.svelte`, `profile/ProfileInsights.svelte`, `profile/OldestNewestHighlights.svelte` (all under `src/lib/components/`)

- [ ] **Step 1:** Remove them from `PENDING` → guard FAILS.
- [ ] **Step 2:** Fix with the Task 4 mapping. Covers take `.cover`. `TopList` bars are solid `var(--ink)` on `var(--track)` (drop `RANK_PALETTE` use). No structural change yet.
- [ ] **Step 3:** Guard PASSES; `npm test` → pass (`StatCard.test.ts`, `LoadingBanner.test.ts` untouched in meaning). Look at the profile screenshots.
- [ ] **Step 4: Commit.** `git commit -m "feat: list, cover and overlay components read the shelf tokens"`

### Task 6: Chart helpers and the remaining components

**Files:**
- Modify: `src/lib/utils/chart.ts`, `src/lib/utils/chart.test.ts`, `src/lib/constants.ts`, `src/lib/theme/look.test.ts`
- Modify (remove from `PENDING`, then fix): `ArtistLoyalty.svelte`, `BarChart.svelte`, `CollectingActivity.svelte`, `CollectingCalendar.svelte`, `CollectionDNA.svelte`, `CollectionExport.svelte`, `CollectionQuiz.svelte`, `CollectionTimeline.svelte`, `DayPatterns.svelte`, `DonutChart.svelte`, `FormatDrilldown.svelte`, `GenreEvolution.svelte`, `Milestones.svelte`, `NewVsVintage.svelte`, `RandomPicker.svelte`, `RatingsOverview.svelte`, `Recommendations.svelte`, `ShareableCard.svelte`, `TimelineChart.svelte`, `ValueEstimate.svelte`, `YearHeatmap.svelte`, `profile/ProfileActivity.svelte`, `profile/ProfileCharts.svelte`, `profile/ProfileShare.svelte`

**Interfaces:**
- Produces, `chart.ts` (alongside the unchanged `ChartDatum` and `toChartData`):
  ```ts
  export function chartColour(i: number): string;  // 'var(--chart-1)' … 'var(--chart-5)' for 0..4, then 'var(--chart-other)'
  export function foldSeries(data: ChartDatum[], max?: number): ChartDatum[]; // biggest first; keeps `max` (default 5); the rest summed as { label: 'Other', value } when above 0
  export function shadeStep(count: number, max: number): 0 | 1 | 2 | 3 | 4 | 5; // 0 for a count of 0, else ceil(count / max * 5) clamped to 1..5
  ```
- Removes: `CHART_PALETTE`, `RANK_PALETTE`, `colorAt` (chart.ts); `GENRE_COLORS`, `getGenreColor` (constants.ts).

- [ ] **Step 1: Replace the palette tests in `chart.test.ts` (failing).**
```ts
it('chartColour', () => { expect(chartColour(0)).toBe('var(--chart-1)'); expect(chartColour(4)).toBe('var(--chart-5)'); expect(chartColour(5)).toBe('var(--chart-other)'); expect(chartColour(99)).toBe('var(--chart-other)'); });
it('foldSeries keeps five and sums the rest', () => {
	const d = [7, 6, 5, 4, 3, 2, 1].map((v, i) => ({ label: `g${i}`, value: v }));
	expect(foldSeries(d)).toEqual([...d.slice(0, 5), { label: 'Other', value: 3 }]);
	expect(foldSeries(d.slice(0, 3))).toEqual(d.slice(0, 3));
	expect(foldSeries([{ label: 'b', value: 1 }, { label: 'a', value: 9 }])[0].label).toBe('a');
});
it('shadeStep', () => { expect(shadeStep(0, 10)).toBe(0); expect(shadeStep(1, 10)).toBe(1); expect(shadeStep(10, 10)).toBe(5); expect(shadeStep(5, 10)).toBe(3); expect(shadeStep(3, 0)).toBe(1); });
```
- [ ] **Step 2:** Run → FAIL. Implement; delete the old exports → PASS.
- [ ] **Step 3:** Remove the 24 components from `PENDING` → guard FAILS. Fix with the Task 4 mapping, plus: single-series bars and lines are `var(--ink)`; multi-part charts use `chartColour(i)` after `foldSeries`, with a swatch legend; the calendar and year grid use `var(--shade-N)` from `shadeStep`, a zero cell being empty with a hairline edge; bar ends square. `ShareableCard` keeps its old drawing for now but takes its colours from `LIGHT` in `tokens.ts`. No structural change yet.
- [ ] **Step 4:** Guard PASSES and `PENDING` is now empty: from here on every new or changed component is checked as it is written. `npm run check`, `npm test` → pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: charts and remaining components read the shelf tokens"`

### Task 6b: Stage 1 gate

- [ ] Run the Stage Gate. Tell the owner: every page is in the new colours and type; the profile is still the old long page; this is the first time they see home, wantlist, Compare and Settings in the new look.

---

# Stage 2: Profile frame, shelf and Overview

### Task 7: Tabs and their addresses

**Files:**
- Create: `src/lib/profile/tabs.ts`, `src/lib/profile/tabs.test.ts`, `src/lib/components/profile/ProfileTabs.svelte`, `TabOverview.svelte`, `TabRecords.svelte`, `TabCharts.svelte`, `TabActivity.svelte`, `TabExtras.svelte` (same folder), `e2e/tabs.test.ts`
- Modify: `src/routes/u/[username=username]/+page.svelte`, `src/lib/components/CollectionBrowser.svelte`, `src/lib/actions/keyboardNav.ts`, `src/lib/actions/keyboardNav.test.ts`, `src/lib/components/KeyboardHelp.svelte`, `e2e/profile.test.ts`
- Delete: `src/lib/components/SectionNav.svelte`, and `profile/ProfileHeader.svelte`, `ProfileOverview.svelte`, `ProfileCollection.svelte`, `ProfileCharts.svelte`, `ProfileActivity.svelte`, `ProfileInsights.svelte`, `ProfileShare.svelte`

**Interfaces:**
- Produces, `tabs.ts`:
  ```ts
  export const TABS = ['overview', 'records', 'charts', 'activity', 'extras'] as const;
  export type TabId = (typeof TABS)[number];
  export const TAB_LABELS: Record<TabId, string>; // Overview, Records, Charts, Activity, Extras
  export const RECORDS_PARAMS = ['search', 'genre', 'format', 'decade', 'sort', 'order', 'page'] as const;
  export function tabFromUrl(url: URL): TabId;
  export function tabHref(url: URL, tab: TabId): string;   // pathname, plus '?tab=<id>' unless overview; every other parameter dropped
  export function stepTab(tab: TabId, dir: 1 | -1): TabId; // stops at the ends
  export interface RecordsQuery { search: string; genre: string; format: string; decade: string; sort: 'added' | 'artist' | 'title' | 'year'; order: 'asc' | 'desc'; page: number }
  export function recordsHref(url: URL, q: RecordsQuery): string; // pathname + '?tab=records' + the non-default filters, in RECORDS_PARAMS order
  ```
- Produces: each tab's content wrapper is `<div id="{tab}">`, so `#overview`, `#records`, `#charts`, `#activity`, `#extras` exist when that tab is open.
- Produces, `keyboardNav` params: `{ tab: () => TabId; onTab: (tab: TabId) => void; onSearch: () => void; isDrawerOpen; onCloseDrawer; onShowHelp }` replacing `sectionIds`.
- Tab component props (types as the page already has them): `TabOverview { stats, items, badges, randomHighlights, decadeData, onDecade, onArtistClick, openDrawer }`; `TabRecords { items, duplicates, formatUpgrades, onSelect }`; `TabCharts { items, stats, genreData, formatData, styleData, onGenre, onFormat, onStyle, onYear, onLabelClick, openDrawer }`; `TabActivity { items, stats }`; `TabExtras { items, stats, badges, username }`. Task 9 adds `shelfItems` and `total` to `TabOverview`. In this task they hold the existing section components, grouped per the spec's table "Where every card goes", inside `.section` blocks in `.cols` as the spec's per-tab layout says. Later tasks redraw the sections.

- [ ] **Step 1: Write `tabs.test.ts` (failing).**
```ts
const u = (q: string) => new URL(`https://x.test/u/bob${q}`);
it('reads the tab', () => {
	expect(tabFromUrl(u(''))).toBe('overview');
	expect(tabFromUrl(u('?tab=charts'))).toBe('charts');
	expect(tabFromUrl(u('?tab=bogus'))).toBe('overview');
	expect(tabFromUrl(u('?tab=RECORDS'))).toBe('overview');
});
it('an old filter link with no tab opens Records', () => {
	expect(tabFromUrl(u('?genre=Rock'))).toBe('records');
	expect(tabFromUrl(u('?search=abc&page=2'))).toBe('records');
	expect(tabFromUrl(u('?tab=charts&genre=Rock'))).toBe('charts');
	expect(tabFromUrl(u('?utm=x'))).toBe('overview');
});
it('builds tab links and drops everything else', () => {
	expect(tabHref(u('?tab=records&genre=Rock'), 'overview')).toBe('/u/bob');
	expect(tabHref(u('?genre=Rock'), 'charts')).toBe('/u/bob?tab=charts');
});
it('steps and stops', () => { expect(stepTab('overview', -1)).toBe('overview'); expect(stepTab('overview', 1)).toBe('records'); expect(stepTab('extras', 1)).toBe('extras'); });
it('builds Records addresses', () => {
	const d = { search: '', genre: '', format: '', decade: '', sort: 'added', order: 'desc', page: 1 } as const;
	expect(recordsHref(u('?tab=records'), d)).toBe('/u/bob?tab=records');
	expect(recordsHref(u(''), { ...d, genre: 'Folk, World, & Country', page: 3 })).toBe('/u/bob?tab=records&genre=Folk%2C+World%2C+%26+Country&page=3');
	expect(recordsHref(u(''), { ...d, sort: 'year', order: 'asc' })).toBe('/u/bob?tab=records&sort=year&order=asc');
});
```
- [ ] **Step 2:** Run → FAIL. Implement `tabs.ts` → PASS.
- [ ] **Step 3: Rewrite `keyboardNav.test.ts` for the new keys (failing), then `keyboardNav.ts`.** `j` calls `onTab(stepTab(tab(), 1))`, `k` the other way; `/` and `s` call `onSearch()`; `?` and `Escape` as today; nothing fires while typing in an input. Update `KeyboardHelp.svelte` rows to "j / k: next / previous tab" and "/ or s: search your records".
- [ ] **Step 4: Build `ProfileTabs.svelte`.** Props `{ active: TabId; url: URL }`. A `<nav aria-label="Profile sections">` of five `<a href={tabHref(url, id)} data-sveltekit-noscroll>`; the active one has `aria-current="page"`, weight 700 and `box-shadow: inset 0 -6px 0 var(--accent)`; the others weight 500 in `var(--muted)`. 52px high, 21px text with a 36px gap; under 700px wide, 16px text spread across the row.
- [ ] **Step 5: Rewrite the profile page.** Order: `<h1>{profile.username}'s shelf</h1>` (with `overflow-wrap: anywhere`), `ProfileTabs`, `LoadingBanner`, then only the open tab's component inside `<div id={tab}>`. `tab = tabFromUrl(page.url)` with `page` from `$app/state`. `<title>` is `{username}'s shelf - Record Shelf`. `onTab` and `onSearch` use `goto(tabHref(...), { noScroll: true })`; `onSearch` then focuses `#records input[type="search"]` after the tab has rendered. The avatar and location are gone; the badges are one muted, comma-separated line at the foot of the six stats in `TabOverview`. The not-found, private and loading branches keep their logic, without `BrandNav`.
- [ ] **Step 6: Make the Records filters live with `tab`.** In `CollectionBrowser.svelte` replace the hand-built query string with `recordsHref(new URL(location.href), {...})` and write it with `replaceState` from `$app/navigation` instead of `window.history.replaceState`. SvelteKit throws if `replaceState` runs before its router has started, so keep the existing "only when the address would change" check and make the first write wait until after mount; the "old filter link" browser test below is the proof.
- [ ] **Step 7: Update `e2e/profile.test.ts`.** The three `toHaveText('someuser')` on `h1` become `toHaveText("someuser's shelf")`. `#overview` stays.
- [ ] **Step 8: Write `e2e/tabs.test.ts`.** Using `withToken`, `mockStored(pw, 'tabuser', makeCollection(150))`:
```ts
test('a tab changes the address and the content, and Back returns', async ({ page: pw }) => {
	const net = await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('#overview')).toBeVisible();
	const before = net.collectionCalls();
	await pw.getByRole('link', { name: 'Charts' }).click();
	await expect(pw).toHaveURL(/\/u\/tabuser\?tab=charts$/);
	await expect(pw.locator('#charts')).toBeVisible();
	await expect(pw.locator('#overview')).toHaveCount(0);
	expect(net.collectionCalls()).toBe(before);        // no reload of data
	expect(net.discogsCalls()).toBe(0);
	await pw.goBack();
	await expect(pw.locator('#overview')).toBeVisible();
});
test('a link opens on its tab; an unknown tab shows Overview', async ({ page: pw }) => { /* goto ?tab=activity → #activity; goto ?tab=bogus → #overview */ });
test('Records filters live next to the tab and survive Back', async ({ page: pw }) => {
	/* goto ?tab=records; (until Task 11 the selects sit behind the "Filters" button: click it first; Task 11 removes that click)
	   choose a genre in the Genre select → URL matches /tab=records&genre=/;
	   click Charts → URL is ?tab=charts; goBack → URL has tab=records&genre= and the select still shows the genre */
});
test('an old filter link opens Records', async ({ page: pw }) => { /* goto /u/tabuser?genre=Rock → #records visible, select shows Rock */ });
test('j and k move between tabs; / opens Records and focuses search', async ({ page: pw }) => { /* press j → #records; k → #overview; '/' → #records and the search input is focused */ });
test('a long username does not make the page scroll sideways at 390px', async ({ page: pw }) => {
	/* viewport 390×844, user 'a'.repeat(30): document.documentElement.scrollWidth <= 390 */
});
```
- [ ] **Step 9: Run** `npm run check`, `npm test`, `npm run test:e2e` → pass. Look at the five tab screenshots.
- [ ] **Step 10: Commit.** `git commit -m "feat: the profile is five tabs, each with its own address"`

### Task 8: Spines and shelves (logic)

**Files:**
- Create: `src/lib/shelf/spines.ts`, `src/lib/shelf/spines.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Spine { key: number; item: DiscogsCollectionItem; year: number; units: 1 | 2 | 4; width: number; height: 1 | 0.9 | 0.56; colour: number }
  export const PER_SHELF = { wide: 230, narrow: 115 } as const;
  export const MAX_SHELVES = { wide: 6, narrow: 8 } as const;
  export const SPINE_WEIGHTS = [5, 6, 4, 3, 2, 2, 2, 1, 1] as const; // ink, cream, tan, grey, red, blue, mustard, green, plum
  export const THICKNESS = { min: 0.8, max: 1.4 } as const;
  export function mix(id: number, salt: number): number;           // unsigned 32-bit, same in and out forever
  export function spineOf(item: DiscogsCollectionItem): Spine;
  export function shelfOrder(items: DiscogsCollectionItem[]): Spine[];
  export function shelfCount(total: number, perShelf: number): number; // at least 1
  export function splitShelves(spines: Spine[], count: number): Spine[][]; // always `count` arrays, in order, about equal total width
  export function shelfTitle(shelf: Spine[]): string;
  export function shelfSource<T>(prev: T[], s: { items: T[]; phase: LoaderPhase; background: boolean }, storedComplete: boolean): T[];
  ```
- Rules (from the spec, "The shelf"):
  - `key` is `instance_id`. `year` is `basic_information.year`, 0 when missing.
  - `units`: add up `parseInt(qty)` over `formats` (a missing or non-numeric `qty` counts 1; no formats counts 1). 1 → 1, 2 → 2, 3 or more → 4.
  - `width`: `units × (0.8 + 0.6 × mix(releaseId, 1) / 2^32)`, where `releaseId` is `basic_information.id`.
  - `height`: look through every format's `descriptions`. If any is `12"` or `LP`, or none names a size → 1. Otherwise `10"` → 0.9, otherwise `7"` → 0.56.
  - `colour`: expand `SPINE_WEIGHTS` to a 26-long list of indexes (five 0s, six 1s, …) and take entry `mix(releaseId, 2) % 26`.
  - Order: year ascending with year 0 last; then first artist name, then title, then `instance_id`, compared with `localeCompare`.
  - `shelfTitle`: lowest to highest non-zero year as `"1957 to 1979"`; `"1990"` when they are equal; `"Year unknown"` when there is none.
  - `shelfSource`: `phase === 'done'` → `s.items`. Else `s.background` → `prev`. Else `phase === 'error'` → `s.items` if it has any, else `prev`. Else `storedComplete` → `prev`. Else → `s.items`.
- `mix` (fixed so colours never change between releases of the site):
  ```ts
  export function mix(id: number, salt: number): number {
  	let h = (Math.imul(id | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  	h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
  	h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
  	return (h ^ (h >>> 16)) >>> 0;
  }
  ```

- [ ] **Step 1: Write `spines.test.ts` (failing).** Build items with a small local `rec({ id, year, formats, artist, title })` helper.
```ts
it('a plain LP is one unit, full height', () => { const s = spineOf(rec({ id: 1, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }] })); expect(s.units).toBe(1); expect(s.height).toBe(1); });
it('discs set the units', () => { expect(spineOf(rec({ id: 1, formats: [{ name: 'Vinyl', qty: '2' }] })).units).toBe(2); expect(spineOf(rec({ id: 1, formats: [{ name: 'Box Set', qty: '1' }, { name: 'Vinyl', qty: '5' }] })).units).toBe(4); });
it('sizes set the height', () => {
	expect(spineOf(rec({ id: 1, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['7"', '45 RPM'] }] })).height).toBe(0.56);
	expect(spineOf(rec({ id: 1, formats: [{ name: 'Shellac', qty: '1', descriptions: ['10"'] }] })).height).toBe(0.9);
	expect(spineOf(rec({ id: 1, formats: [{ name: 'CD', qty: '1', descriptions: ['Album'] }] })).height).toBe(1);
	expect(spineOf(rec({ id: 1, formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', '7"'] }] })).height).toBe(1);
});
it('thin data never breaks a spine', () => {
	for (const formats of [undefined, [], [{ name: 'Vinyl', qty: '' }], [{ name: 'Vinyl', qty: 'x' }], [{ name: 'Vinyl' }]]) {
		const s = spineOf(rec({ id: 9, formats: formats as never }));
		expect(s.units).toBe(1); expect(s.height).toBe(1); expect(Number.isFinite(s.width)).toBe(true);
	}
});
it('width stays in range and a double beats any single', () => {
	for (let id = 1; id <= 2000; id++) {
		const one = spineOf(rec({ id })).width; const two = spineOf(rec({ id, formats: [{ name: 'Vinyl', qty: '2' }] })).width;
		expect(one).toBeGreaterThanOrEqual(0.8); expect(one).toBeLessThanOrEqual(1.4); expect(two).toBeGreaterThanOrEqual(1.6);
	}
});
it('colour is stable and follows the weights', () => {
	expect(spineOf(rec({ id: 4242 })).colour).toBe(spineOf(rec({ id: 4242 })).colour);
	const n = new Array(9).fill(0); for (let id = 1; id <= 26000; id++) n[spineOf(rec({ id })).colour]++;
	SPINE_WEIGHTS.forEach((w, i) => { expect(n[i] / 1000).toBeGreaterThan(w * 0.9); expect(n[i] / 1000).toBeLessThan(w * 1.1); });
});
it('mix is pinned', () => { expect(mix(1, 1)).toBe(mix(1, 1)); expect(mix(1, 1)).not.toBe(mix(1, 2)); expect(mix(12345, 2)).toMatchInlineSnapshot(); });
it('orders by year, unknown last, then artist, title', () => {
	const out = shelfOrder([rec({ id: 1, year: 0 }), rec({ id: 2, year: 1980, artist: 'B' }), rec({ id: 3, year: 1960 }), rec({ id: 4, year: 1980, artist: 'A' })]);
	expect(out.map((s) => s.key)).toEqual([3, 4, 2, 1]);
});
it('counts shelves', () => { expect(shelfCount(679, 230)).toBe(3); expect(shelfCount(679, 115)).toBe(6); expect(shelfCount(0, 230)).toBe(1); expect(shelfCount(10, 230)).toBe(1); expect(shelfCount(5000, 230)).toBe(22); });
it('splits in order, every spine once, about evenly', () => {
	const spines = shelfOrder(Array.from({ length: 679 }, (_, i) => rec({ id: i + 1, year: 1950 + (i % 70) })));
	const rows = splitShelves(spines, 3);
	expect(rows).toHaveLength(3); expect(rows.flat()).toEqual(spines);
	const w = rows.map((r) => r.reduce((a, s) => a + s.width, 0)); expect(Math.max(...w) / Math.min(...w)).toBeLessThan(1.05);
	expect(splitShelves([], 3)).toEqual([[], [], []]);
	expect(splitShelves(spines.slice(0, 2), 3).flat()).toHaveLength(2);
});
it('titles a shelf', () => {
	expect(shelfTitle(shelfOrder([rec({ id: 1, year: 1957 }), rec({ id: 2, year: 1979 }), rec({ id: 3, year: 0 })]))).toBe('1957 to 1979');
	expect(shelfTitle(shelfOrder([rec({ id: 1, year: 1990 }), rec({ id: 2, year: 1990 })]))).toBe('1990');
	expect(shelfTitle(shelfOrder([rec({ id: 1, year: 0 })]))).toBe('Year unknown');
	expect(shelfTitle([])).toBe('Year unknown');
});
it('decides what the shelf draws', () => {
	const prev = [1], next = [1, 2];
	expect(shelfSource(prev, { items: next, phase: 'done', background: false }, true)).toBe(next);
	expect(shelfSource(prev, { items: next, phase: 'loading', background: false }, true)).toBe(prev);   // stored copy: hold
	expect(shelfSource(prev, { items: next, phase: 'loading', background: false }, false)).toBe(next);  // from Discogs: fill in
	expect(shelfSource(prev, { items: next, phase: 'refreshing', background: true }, false)).toBe(prev); // background: leave alone
	expect(shelfSource([], { items: next, phase: 'error', background: false }, true)).toBe(next);
	expect(shelfSource(prev, { items: [], phase: 'error', background: false }, true)).toBe(prev);
});
```
- [ ] **Step 2:** `npx vitest run src/lib/shelf` → FAIL. Implement → PASS (accept the inline snapshot once, then never change it).
- [ ] **Step 3: Commit.** `git commit -m "feat: spine and shelf rules"`

### Task 9: The shelf on Overview

**Files:**
- Create: `src/lib/components/shelf/Shelf.svelte`, `src/lib/components/shelf/Shelf.test.ts`
- Modify: `src/lib/components/profile/TabOverview.svelte`, `src/routes/u/[username=username]/+page.svelte`, `src/lib/components/SkeletonProfile.svelte`, `e2e/tabs.test.ts`

**Interfaces:**
- Consumes: everything Task 8 produces.
- Produces: `Shelf.svelte` props `{ items: DiscogsCollectionItem[]; total: number; onOpen: (title: string, items: DiscogsCollectionItem[]) => void }`. `items` is what to draw now (may be empty); `total` is the full count and sets the number of boards.

- [ ] **Step 1: Write `Shelf.test.ts` (failing)** with Testing Library:
```ts
it('lays out boards from the total before any record arrives', () => { /* items [], total 679 → 3 buttons inside .shelf-wide, 6 inside .shelf-narrow, no spines */ });
it('names each shelf', () => { /* 679 items: first wide button has accessible name matching /^Shelf 1 of 3: \d+ records, \d{4} to \d{4}\. Open the list\.$/ */ });
it('opens the side list with that shelf, oldest first', async () => { /* click wide shelf 2 → onOpen called once with (shelfTitle(row), row items in shelf order) */ });
it('caps a huge collection until asked', async () => { /* total 5000 with 5000 items → 6 wide shelves and a button "Show the whole shelf"; click → 22 */ });
it('one board and a line for an empty collection', () => { /* total 0 → one board in each variant and the text "Nothing on the shelf yet." */ });
it('a small collection does not stretch', () => { /* 10 items → each spine has an inline max-width */ });
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Build `Shelf.svelte`.**
  - Render two variants of the same shelf, `.shelf-wide` (`PER_SHELF.wide`, `MAX_SHELVES.wide`) and `.shelf-narrow` (the narrow constants); CSS shows `.shelf-narrow` under 700px wide and `.shelf-wide` otherwise (`display: none` on the other). The server can then render the right boards without knowing the screen.
  - Each shelf is a `<button type="button">` the full content width: spines stand on a board (`border-bottom`). Wide: 104px tall, 8px board, 18px between. Narrow: 44px, 5px, 10px. Spines are `aria-hidden` `<span data-spine={index}>`s: `flex: {width} 1 0; max-width: calc({width} * 12px); height: {height × 100}%; background: var(--spine-{colour + 1}); box-shadow: inset -1px 0 0 var(--spine-edge)`, aligned to the board, left-aligned in the row.
  - `aria-label`: `Shelf {i} of {n}: {count} records, {shelfTitle}. Open the list.` Click, tap or Enter calls `onOpen(shelfTitle(row), row.map((s) => s.item))`.
  - One hover label for the whole shelf (not a `title` attribute per spine): on `pointermove` over a spine show `{title}, {first artist} ({year})` (no year part when it is 0) above the pointer, kept inside the page's side padding, one line with an ellipsis; hide on `pointerleave`. Not shown for touch.
  - Under the last shelf: "Oldest" left and "Newest" right, `.small`.
  - More shelves than the cap: draw the cap and a secondary button "Show the whole shelf".
  - `total === 0`: one empty board and "Nothing on the shelf yet."
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Put it on Overview.** In the page keep `let shelfItems = $state.raw<DiscogsCollectionItem[]>([])` and update it in an `$effect` with `shelfSource(shelfItems, s, data.stored?.complete === true)` (read `shelfItems` with `untrack`). `TabOverview` starts with `<p class="lead">{total} records, one spine each. The oldest pressing sits on the left.</p>` (`total` is `s.totalItems`, formatted with `toLocaleString`), then `<Shelf items={shelfItems} total={s.totalItems} onOpen={openDrawer} />`. `SkeletonProfile` becomes: title placeholder, the tab row, three empty boards.
- [ ] **Step 6: Add to `e2e/tabs.test.ts`.**
```ts
test('the shelf has one spine per record and opens the side list', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(679));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('.shelf-wide [data-spine]')).toHaveCount(679);
	await expect(pw.getByText('679 records, one spine each.')).toBeVisible();
	await pw.getByRole('button', { name: /^Shelf 1 of 3/ }).click();
	await expect(pw.getByRole('dialog')).toBeVisible();   // use whatever role the drawer has today
});
test('the shelf is on Overview only', async ({ page: pw }) => { /* goto ?tab=records → .shelf-wide has count 0 */ });
test('on a phone the shelf has six rows and no sideways scroll', async ({ page: pw }) => { /* 390×844: 6 visible shelf buttons; scrollWidth <= 390 */ });
test('hovering a spine names the record inside the page', async ({ page: pw }) => { /* hover the last spine of shelf 1 → label visible, its right edge <= viewport width */ });
```
- [ ] **Step 7:** `npm run check`, `npm test`, `npm run test:e2e` → pass. Look at Overview at both widths, light and dark, against frames "A: The Shelf", "Overview on a phone" and "Overview in dark mode".
- [ ] **Step 8: Commit.** `git commit -m "feat: the collection as spines on shelves"`

### Task 10: Overview sections as drawn

**Files:**
- Create: `src/lib/components/profile/JustAdded.svelte`, `src/lib/components/profile/AtAGlance.svelte`
- Modify: `src/lib/components/profile/TabOverview.svelte`, `src/lib/components/TopList.svelte`, `src/lib/components/BarChart.svelte`
- Delete: `src/lib/components/RecentlyAdded.svelte`, `src/lib/components/StatCard.svelte`, `src/lib/components/StatCard.test.ts`

**Interfaces:**
- `JustAdded` props `{ items: DiscogsCollectionItem[]; total: number; allHref: string }`: the three newest as rows (64px cover, title 21px/600, artist 17px muted; a long title wraps), then a link "See all {total} records" to `allHref` (the page passes `tabHref(page.url, 'records')`).
- `AtAGlance` props `{ stats: CollectionStats; badges: Badge[] }`: rows of label left and value right, 60px high: Records (value as `.figure`), Artists, Labels, Average year, Year span (`"{n} years"`), Top genre; `—` where a value is missing, as today; then the badges as one `.small` line, comma-separated.
- `TopList` gains `bars?: 'solid' | 'spines'` (default `'solid'`). `'spines'` draws the bar as `repeating-linear-gradient(90deg, var(--ink) 0 3px, transparent 3px 5px)`. Rows: rank, name, bar, count; 52px high.
- `BarChart` loses `colorful`; vertical mode is ink columns with the label under each (labels shortened to `"50s"` under 700px when they look like decades).

- [ ] **Step 1:** Add component tests: `AtAGlance.test.ts` (the six labels in order; `Records` shows the total; badges render as "Explorer, 90s kid"; a missing average year shows `—`) and `JustAdded.test.ts` (three rows from twelve items; the link text and href). Run → FAIL.
- [ ] **Step 2:** Build them and lay out `TabOverview` per the spec: lead, shelf, then `.cols` with left `JustAdded` + "By decade", right `AtAGlance` + "Top artists" (ten rows, `bars="spines"`, click opens the side list as today), then "Highlights" (`CoverGrid` of `randomHighlights`) full width. Run → PASS.
- [ ] **Step 3:** `npm run check`, `npm test`, `npm run test:e2e` → pass. Look at Overview against frame A.
- [ ] **Step 4: Commit.** `git commit -m "feat: Overview sections in the shelf look"`

### Task 10b: Stage 2 gate, with shelf tuning

- [ ] Run the Stage Gate. Ask the owner to judge their real shelf in particular: number of shelves, how even the spines look, the colours, hover and click.
- [ ] Apply their notes by changing the constants in `src/lib/shelf/spines.ts` (`PER_SHELF`, `THICKNESS`, `SPINE_WEIGHTS`, the heights) and the tests that pin them; redeploy the preview; repeat until they are happy. If they want colour by genre, stop and bring it back as a change to the spec.

---

# Stage 3: Records

### Task 11: The Records tab as drawn

**Files:**
- Modify: `src/lib/components/profile/TabRecords.svelte`, `CollectionBrowser.svelte`, `browser/SearchBar.svelte`, `browser/FilterControls.svelte`, `browser/SortToolbar.svelte`, `browser/RecordCard.svelte`, `browser/Pagination.svelte`, `DuplicateDetector.svelte`, `FormatUpgrades.svelte`, `e2e/tabs.test.ts`

- [ ] **Step 1: Add to `e2e/tabs.test.ts` (failing).**
```ts
test('Records: filters are always visible and Show more steps by 24', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records');
	await expect(pw.getByRole('heading', { name: 'All records' })).toBeVisible();
	await expect(pw.getByPlaceholder('Search by title, artist, label or catalog number')).toBeVisible();
	for (const name of ['Genre', 'Format', 'Decade']) await expect(pw.getByRole('combobox', { name })).toBeVisible();
	await expect(pw.getByRole('button', { name: 'Filters' })).toHaveCount(0);
	await expect(pw.getByText('24 of 150 shown')).toBeVisible();
	await pw.getByRole('button', { name: 'Show more' }).click();
	await expect(pw.getByText('48 of 150 shown')).toBeVisible();
});
test('Records on a phone: two columns, long titles do not push the page sideways', async ({ page: pw }) => {
	/* 390×844, makeCollection(150) (it has 90-character and non-Latin titles): scrollWidth <= 390 */
});
```
- [ ] **Step 2:** Build per the spec and the "Records tab" frame: heading "All records" with "{n} records" beside it; search as a `.field`; the three selects always shown, labelled Genre, Format, Decade, with first options "All genres", "All formats", "All decades"; "Sort by" then Date added, Artist, Title, Year as text buttons, the active one weight 700 with an arrow for direction and `aria-pressed`; grid `repeat(6, 1fr)` falling to 2 columns under 700px; under the grid a secondary "Show more" button and "{shown} of {n} shown" (when filtered, n is the filtered count); no button when all are shown; an empty result says "No records match." Then sections "Duplicates and variants" and "Vinyl upgrade picks", content and clicks unchanged.
- [ ] **Step 3:** `npm run check`, `npm test`, `npm run test:e2e` → pass. Look at Records at both widths against the two Records frames.
- [ ] **Step 4: Commit.** `git commit -m "feat: Records tab in the shelf look"`
- [ ] **Step 5:** Run the Stage Gate.

---

# Stage 4: Charts

### Task 12: Split bar and "By format"

**Files:**
- Create: `src/lib/components/SplitBar.svelte`, `src/lib/components/SplitBar.test.ts`, `src/lib/components/FormatBreakdown.svelte`
- Delete: `src/lib/components/DonutChart.svelte`, `src/lib/components/FormatDrilldown.svelte`

**Interfaces:**
- `SplitBar` props `{ parts: ChartDatum[]; height?: number; legend?: boolean; label: string }`. Expects parts already folded with `foldSeries`. Draws one bar of segments sized by share, coloured `chartColour(i)` (a part labelled `Other` always takes `var(--chart-other)`), 2px ground-coloured gaps, square ends; `role="img"` with `aria-label` `{label}: {name} {percent}%, …`; with `legend` (default true), a list of swatch + name + percent in ink text.
- `FormatBreakdown` props `{ items: DiscogsCollectionItem[]; formatData: ChartDatum[]; onFilter: (title: string, items: DiscogsCollectionItem[]) => void }`. A `SplitBar` (14px) over one row per format (name, count, percent) that expands to its sub-formats exactly as `FormatDrilldown` does today, each row opening the side list as today.

- [ ] **Step 1: `SplitBar.test.ts` (failing):** three parts 50/30/20 render three segments with flex shares 50, 30, 20; the accessible name is `By format: Vinyl 50%, CD 30%, Cassette 20%`; a part labelled Other uses `var(--chart-other)`; the legend lists all three; zero-value parts are dropped; no parts renders nothing.
- [ ] **Step 2:** Build `SplitBar` → PASS. Build `FormatBreakdown` by moving `FormatDrilldown`'s logic under the bar.
- [ ] **Step 3: Commit.** `git commit -m "feat: split bar and the merged By format section"`

### Task 13: The Charts tab as drawn

**Files:**
- Modify: `src/lib/components/profile/TabCharts.svelte`, `BarChart.svelte`, `RatingsOverview.svelte`, `ArtistLoyalty.svelte`, `YearHeatmap.svelte`, `CollectionDNA.svelte`, `TopList.svelte`, `e2e/tabs.test.ts`
- Delete: `src/lib/components/profile/OldestNewestHighlights.svelte`

- [ ] **Step 1: Add to `e2e/tabs.test.ts` (failing):** on `?tab=charts` the headings By genre, Top styles, Ratings, Artist loyalty, By format, Top labels, Release years, Collection DNA are present in that reading order per column; there is no `svg circle` donut; "Oldest release" and "Newest release" appear under Release years; clicking the first By genre row opens the side list.
- [ ] **Step 2:** Build per the spec's "Charts" table and the "Charts tab" frame. Left column: By genre (`BarChart` horizontal, 8 rows: name, ink bar on track, count), Top styles (12), Ratings (two fact rows "Average rating" and "Rated" = "{rated} of {n}", five bars labelled "5 stars" to "1 star", then "Top rated" covers), Artist loyalty (row per artist: name, a strip of their covers, the Loyal / Devoted / Superfan word in ink). Right column: By format (`FormatBreakdown`), Top labels (ten rows), Release years (`YearHeatmap` in shades with a "Fewer … More" key of the five shades; year numbers inside cells in whichever of ink or ground reads better on that shade; then "Oldest release" and "Newest release" rows with what `OldestNewestHighlights` shows today), Collection DNA (four rows Diversity, Vintage, Vinyl, Focus: name, percent, ink bar on track; the genre ring removed). Every click that opens the side list today still does.
- [ ] **Step 3:** `npm run check`, `npm test`, `npm run test:e2e` → pass. Look at Charts, light and dark.
- [ ] **Step 4: Commit.** `git commit -m "feat: Charts tab in the shelf look"`
- [ ] **Step 5:** Run the Stage Gate.

---

# Stage 5: Activity

### Task 14: The five-genre rule

**Files:**
- Create: `src/lib/utils/genreEvolution.ts`, `src/lib/utils/genreEvolution.test.ts`
- Modify: `src/lib/components/GenreEvolution.svelte`

**Interfaces:**
- Produces:
  ```ts
  export interface EvolutionYear { year: number; total: number; parts: ChartDatum[] } // parts in `genres` order, then 'Other' when above 0
  export function genreEvolution(items: DiscogsCollectionItem[]): { genres: string[]; years: EvolutionYear[] };
  ```
  Years are the last five calendar years that have additions (by `date_added`), oldest first. `genres` is the five most common genres over those years together, most common first (ties by name). A record counts once for each of its genres, as today. In each year, `parts` has one entry per entry of `genres` (value 0 allowed) and `Other` for every other genre's count.

- [ ] **Step 1: Tests (failing):** six genres over two years → `genres` has the top five by combined count and both years list the same five in the same order; the sixth genre's counts land in `Other`; a year with none of the five has zero parts and its whole count in `Other`; more than five years → only the last five; no items → `{ genres: [], years: [] }`.
- [ ] **Step 2:** Implement → PASS. `GenreEvolution.svelte` renders one row per year (year, a `SplitBar` without its own legend, the year's total) and a single legend for `genres` plus Other.
- [ ] **Step 3: Commit.** `git commit -m "feat: genre evolution keeps one colour per genre"`

### Task 15: The Activity tab as drawn

**Files:**
- Modify: `src/lib/components/profile/TabActivity.svelte`, `CollectingCalendar.svelte`, `TimelineChart.svelte`, `NewVsVintage.svelte`, `CollectingActivity.svelte`, `DayPatterns.svelte`, `Milestones.svelte`, `CollectionTimeline.svelte`, `e2e/tabs.test.ts`

- [ ] **Step 1: Add to `e2e/tabs.test.ts` (failing):** on `?tab=activity` the headings Collecting calendar, Collection growth, New vs vintage, Genre evolution, Collecting activity, Day patterns, Milestones, Collection timeline are present; at 390px wide the page does not scroll sideways (the calendar scrolls inside its own box); Milestones shows "Next:" and "to go".
- [ ] **Step 2:** Build per the spec's "Charts" table and the "Activity tab" frame. Calendar: day cells in shades with the "Fewer … More" key, inside an `overflow-x: auto` box. Growth: one 2px ink line over a 10% ink area, an accent dot and the last value at the end. New vs vintage: two fact rows, then four ink bars with their descriptions. Collecting activity: three fact rows (Average per month, Peak month, Month streak) and yearly ink bars. Day patterns: seven ink columns Sun to Sat. Milestones: "Next: {name}, at {n} records", ink bar on track, "{have} of {n}", "{left} to go", then the milestones reached. Collection timeline: month columns of covers, scrolling sideways inside its own box. Layout: calendar full width; `.cols` with left Growth, New vs vintage, Genre evolution and right Collecting activity, Day patterns, Milestones; timeline full width.
- [ ] **Step 3:** `npm run check`, `npm test`, `npm run test:e2e` → pass. Look at Activity, light and dark, both widths.
- [ ] **Step 4: Commit.** `git commit -m "feat: Activity tab in the shelf look"`
- [ ] **Step 5:** Run the Stage Gate.

---

# Stage 6: Extras

### Task 16: The Extras tab as drawn, and "1970ss"

**Files:**
- Modify: `src/lib/components/profile/TabExtras.svelte`, `RandomPicker.svelte`, `CollectionQuiz.svelte`, `ValueEstimate.svelte`, `Recommendations.svelte`, `CollectionExport.svelte`
- Create: `src/lib/components/Recommendations.test.ts`

- [ ] **Step 1: `Recommendations.test.ts` (failing):** rendered with stats where `dominantDecade` is `'1970s'` and `dominantGenre` is `'Rock'`, the page has the text "1970s Rock" and "Sweet spot: Rock from the 1970s", and nothing containing "1970ss"; the link's query is `Rock%201970s`.
- [ ] **Step 2:** Fix `Recommendations.svelte` lines 43 to 45 (the decade already ends in "s") → PASS.
- [ ] **Step 3:** Build per the "Extras tab" frame, one column of sections: What should I listen to? (the pick as a large cover with title and artist, "Pick another record" primary, "View on Discogs" link), Collection quiz, Share (Task 17), Collection value (today's behaviour and button; no "Estimate again"), Explore more (a grid of link rows), Export ("Export CSV", "Export JSON", "Print an insurance list" as secondary buttons). `ValueEstimate.test.ts` keeps passing. The printed insurance list stays black on white.
- [ ] **Step 4:** `npm run check`, `npm test`, `npm run test:e2e` → pass. Look at Extras.
- [ ] **Step 5: Commit.** `git commit -m "feat: Extras tab in the shelf look; fix the doubled s in Explore more"`

### Task 17: The share picture

**Files:**
- Create: `src/lib/utils/share.ts`, `src/lib/utils/share.test.ts`
- Modify: `src/lib/components/ShareableCard.svelte`, `src/lib/components/profile/TabExtras.svelte`

**Interfaces:**
- Produces:
  ```ts
  export function shareAddress(host: string, username: string): string; // `${host}/u/${username}`
  export function sampleEvenly<T>(list: T[], n: number): T[];           // n items spread evenly, in order; the whole list when it is shorter
  ```
- `ShareableCard` gains a prop `items: DiscogsCollectionItem[]`.

- [ ] **Step 1: Tests (failing):** `shareAddress('record-shelf.pages.dev', 'bob')` is `'record-shelf.pages.dev/u/bob'`; `sampleEvenly([0..99], 4)` is `[0, 33, 66, 99]`; of a 3-long list with n 64 returns the list; n 0 returns `[]`; order is kept.
- [ ] **Step 2:** Implement → PASS.
- [ ] **Step 3: Redraw the card** (preview markup and the 400×500 canvas alike), always in the light colours from `tokens.ts`: ground fill; "{username}'s shelf" in ink at weight 800; one shelf of `sampleEvenly(shelfOrder(items), 64)` spines on an ink board, using `SPINES_LIGHT[spine.colour]`, each spine's `width` and `height`; a few fact lines as today's card has; `shareAddress(location.host, username)` at the foot in muted text. Before drawing the canvas, `await document.fonts.load('800 40px <font family>')`. "Copy text" uses `shareAddress` too. No occurrence of `recordshelf.app` remains in `src/`.
- [ ] **Step 4:** `npm run check`, `npm test` → pass; `grep -r "recordshelf.app" src` → nothing. Look at Extras; press "Download PNG" in a real browser once and open the file.
- [ ] **Step 5: Commit.** `git commit -m "feat: share picture in the shelf look, with the site's real address"`
- [ ] **Step 6:** Run the Stage Gate.

---

# Stage 7: The rest

### Task 18: The other pages, finished

**Files:**
- Modify: `src/routes/+page.svelte`, `src/routes/+error.svelte`, `src/routes/settings/+page.svelte`, `src/routes/compare/+page.svelte`, `src/routes/compare/[user1=username]/[user2=username]/+page.svelte`, `src/routes/u/[username=username]/wantlist/+page.svelte`, `src/lib/components/SkeletonWantlist.svelte`

- [ ] **Step 1:** Per the spec's "The other pages" table. Home: `h1` "Record Shelf", the username search as a `.field` with a primary "Explore" button, the feature list as `.section`s; `getByLabel('Discogs username')` and the `Explore` button still match. Wantlist: `h1` "{username}'s wantlist" (no avatar), grid like the Records grid. Compare: sections instead of cards; `h1` still contains "Head-to-Head". Settings: sections, `.field`s, `.btn`s, wording unchanged; `h1` still contains "Settings". Error page: the message as the title and a link home.
- [ ] **Step 2:** `npm run check`, `npm test`, `npm run test:e2e` → pass (including `e2e/security.test.ts`). Look at each page, both widths, light and dark.
- [ ] **Step 3: Commit.** `git commit -m "feat: home, wantlist, Compare, Settings and error page in the shelf look"`

### Task 19: States and overlays

**Files:**
- Modify: `src/lib/components/profile/LoadingBanner.svelte`, `CollectionDrawer.svelte`, `KeyboardHelp.svelte`, `SkeletonProfile.svelte`, `src/routes/u/[username=username]/+page.svelte`

- [ ] **Step 1:** Status line: one line of muted text under the tab row with a thin ink progress line on a track beneath it when there is a count; the error state is an `.error-note` with its "Retry" secondary button. Every string stays exactly as it is, so `LoadingBanner.test.ts` and the "Discogs is busy" e2e test pass unchanged. Not-found and private: the message in a `.section`, keeping `role="alert"` and the exact texts. Drawer: ground panel, 2px ink edge on its open side, square, an `h2` title and a close button; behaviour, focus handling and Esc unchanged. Keyboard help: same content, new look.
- [ ] **Step 2:** `npm run check`, `npm test`, `npm run test:e2e` → pass. Look at: a loading profile (throttle the mock), the error state, the open drawer, the help overlay.
- [ ] **Step 3: Commit.** `git commit -m "feat: status line, side list and help in the shelf look"`

### Task 20: Icons, offline page, and the end of the old names

**Files:**
- Modify: `static/favicon.svg`, `src/lib/assets/favicon.svg`, `static/manifest.json`, `static/offline.html`, `src/app.html`, `src/app.css`, `src/lib/theme/look.test.ts`
- Delete: `src/lib/components/LazySection.svelte` if unused; any component nothing imports

- [ ] **Step 1:** Favicons: the ring-and-dot mark, ink `#18201C` on ground `#ECEEE8`; inside the SVG a `prefers-color-scheme: dark` rule swaps to `#E8EBE3` on `#131815`. `manifest.json`: `background_color` and `theme_color` `#ECEEE8`. `offline.html` and the `<noscript>` block: ground, ink, `'Segoe UI', system-ui, sans-serif`, square, no fades (these two files may hold literal colours; they cannot read the tokens).
- [ ] **Step 2:** In `look.test.ts` delete the `PENDING` constant and its existence test (it has been empty since Task 6) and add: no file under `src/` contains `class="card"` or `.card`. Run → FAILS where anything is left. Replace the remaining `.card` uses with `.section`, then delete the temporary alias block and the `.card` rule from `app.css` → PASS.
- [ ] **Step 3:** Find components nothing imports (`grep -rL` each component name across `src/`) and delete them. `npm run check` → 0 errors.
- [ ] **Step 4:** `npm test`, `npm run test:e2e` → pass.
- [ ] **Step 5: Commit.** `git commit -m "chore: icons and offline page in the shelf look; remove the old style names"`
- [ ] **Step 6:** Run the Stage Gate. Ask the owner whether this is ready to go live.

### Task 21: Going live (each step needs the owner's word)

- [ ] Set `"version": "0.12.0"` in `package.json` and run `npm install --package-lock-only`; commit `chore: bump to 0.12.0`.
- [ ] Ask the owner: push the branch and merge to `master`? Do it only on a yes.
- [ ] Ask the owner: deploy to production? On a yes: `npm run build`, then
  ```
  npx wrangler pages deploy .svelte-kit/cloudflare `
    --project-name record-shelf `
    --branch master
  ```
- [ ] Check the live site: `/` loads, `version.json` says 0.12.0, the owner's profile opens on Overview with the shelf. Report what was seen.
- [ ] Update the memory `live-site-and-deploy` and the ledger with the new version and date.
