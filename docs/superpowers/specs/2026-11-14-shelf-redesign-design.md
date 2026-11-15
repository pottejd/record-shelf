# The Shelf: a full visual redesign of Record Shelf

> **Date:** 2026-11-14 · **Base:** `master` @ bfa75b6 (v0.11.1) · **Status:** approved by the owner on 2026-11-14 ("approved")
>
> This is project 2 of 3. It replaces the planned "profile facelift". Project 1
> (stored copies) is live. Project 3 (the sweep of remaining fixes) is separate
> and is not part of this.

## In short

Record Shelf gets a new look on every page, and the profile page is rebuilt
around five tabs with the collection drawn as record spines on shelves.

- **Look:** stone-coloured ground, near-black green ink, one red accent, one
  typeface, no card boxes. Light and dark.
- **Profile:** top bar, "<username>'s shelf", a tab row (Overview, Records,
  Charts, Activity, Extras), then that tab's content. The shelves sit on the
  Overview tab only.
- **Nothing is lost:** every card on today's profile has a home on one of the
  tabs. Two pairs of charts are merged and three are redrawn in a plainer form.
- **How it is built:** in stages on a private preview address, with the owner
  looking at each stage. The live site changes once, at the end.
- **What does not change:** how collections are fetched and stored. The server
  still never calls Discogs.

The calls made without the owner's explicit word are listed under
[Calls for the owner to check](#calls-for-the-owner-to-check).

## Intent

Record Shelf is the owner's own collection site. They open it to show people.
The current look is an indigo-gradient card dashboard: 32 cards on one long
page, which reads as a generic stats page rather than a record collection.

The owner first asked for the page to stop dumping every section at once. Tabs
solved that, but when they saw tabs in the current look they said:

> "thats just a revamp of the current design, I do like the tabs but I think I
> want a full re-design honestly"

Three directions were drawn. The owner picked the first:

> "i like the shelf, it looks simplistic and classy."

So the point of this work is a site that looks like it belongs to someone who
owns records: quiet, plain, and built around one memorable picture, the
collection as a shelf of spines. Everything else stays out of its way.

## What the owner has decided

In their words, in order:

| Decision | Their words |
|---|---|
| Tabs stay | "I do like the tabs" |
| A whole new look, not a rearrangement | "I think I want a full re-design honestly" |
| The direction is "A: The Shelf" | "i like the shelf, it looks simplistic and classy." |
| Shelves on the Overview tab only | "lets only show the bookshelf style when on the overview tab" |
| Tab row directly under the title on every tab | "go for it" (to that offer) |
| The mockups of all five tabs and the phone frames | "the pages all look good" |
| Go ahead and write this up, with the recommended build approach | "go forth and write" |

Not decided by the owner: everything under
[Calls for the owner to check](#calls-for-the-owner-to-check). The dark frame
was published after "the pages all look good" and has not been commented on.

## Mockups

Private canvas: https://claude.ai/artifact/LgB8LhqsEAwDrF1hEgucVY

| Frame | Shows |
|---|---|
| "A: The Shelf" | Overview tab, desktop, light |
| "The Shelf: Records tab", "Charts tab", "Activity tab", "Extras tab" | the other four tabs, desktop, light |
| "The Shelf: Overview on a phone", "Records on a phone" | 390 wide |
| "The Shelf: Overview in dark mode" | dark, desktop |

The sources are on the owner's machine under
`.superpowers/sdd/mockups/redesign-directions/project/` (git-ignored).
`Main.dc.html` holds all five tabs and the phone variant; `ShelfDark.dc.html`
is the dark Overview. They are HTML with inline styles and are the reference
for any measurement this document does not give.

What is real in them: the username, the 679, the three latest records, the
milestone names and numbers, and the wording on buttons and labels. Everything
else is a placeholder: cover squares, bar lengths, chart shapes, spine colours,
widths and heights. The mockups were never rendered by the author, only
published; the owner's "look good" is the only visual check so far.

## Goals

1. Every page is in the Shelf look, light and dark. No page is left in the old
   look at the moment the new one goes live.
2. The profile is five tabs. Only the open tab is drawn, so the page is a
   fraction of today's length.
3. The Overview tab opens with the collection as spines on shelves, drawn from
   the visitor's real records.
4. Every card on today's profile keeps its information and what it does when
   clicked.
5. The look lives in one place: a small set of named colours and sizes that
   every component reads. A later change of colour is one edit.
6. The address remembers the tab, so a link or the back button lands where the
   visitor was.
7. The owner sees each stage on a preview address with their real collection
   before anything reaches the live site.

## Non-goals

- Visitors without a token (still redirected to Settings, as today).
- The fix list: the eight items found earlier, the optional housekeeping, and
  the Collection Timeline count that stops at 12.
- The unmerged branch `worktree-token-header`.
- Any change to how data is fetched, paced or stored: `src/lib/sync/*`,
  `src/lib/server/*`, `src/routes/api/*`, `hooks.server.ts`, the
  `STORE_WRITERS` rule and `wrangler.toml` are not touched.
- New cards or new features. The only new thing a visitor can do is hover or
  click the shelf.
- Rearranging the home page, the wantlist, Compare or Settings. They get the
  new look and the shared top bar and footer, nothing more.
- Wording fixes on Settings and the loading banner (they are on the fix list).

## Anti-goals

These would make the work a failure even if it ships:

- The old layout in new colours. The owner already rejected that.
- A live site that is half old and half new at any moment.
- The server calling Discogs, or any new request from the server to anywhere.
- A card's information or click behaviour quietly dropped.
- A visitor's browser contacting a third party because of the new look (for
  example, fonts loaded from Google).
- Meaning carried by colour alone.
- A real collection's shelf that looks nothing like the one the owner approved.

## Constraints

From the owner's standing instructions:

- The server on Cloudflare must never call Discogs.
- The `STORE_WRITERS` rule is not loosened without the owner's word.
- Ask before every production deploy. Production is
  `npm run build`, then
  `npx wrangler pages deploy .svelte-kit/cloudflare --project-name record-shelf --branch master`.
- Commit or push only when asked. Plain `git commit` works; never put the email
  address in a command.
- Commands the owner has to copy stay under about 60 characters per line.
- Plain language with the owner. Keep the process light.
- The owner decides look and feel by reacting to something they can see.

From the code as it is today:

- SvelteKit 2 with Svelte 5, no CSS framework and no chart library. Charts are
  hand-made SVG and CSS. Keep it that way; no chart library is added.
- Two build targets must keep working: Cloudflare Pages (default) and the Node
  adapter for Docker (`ADAPTER=node`).
- CI runs type check, unit tests, both builds, browser tests, and Lighthouse on
  the home page with accessibility and best-practices each at 0.9 or better.
- The profile page gets its records in the browser through
  `createLoader` (`src/lib/sync/loader.svelte.ts`); the server only hands over
  the stored copy. Switching tabs must not restart the loader, re-read the
  store, or cause any Discogs call.
- The content security policy (`svelte.config.js`) stays as it is.
- A light/dark switch exists today: `static/theme-init.js`,
  `src/lib/stores/theme.ts`, `html[data-theme="dark"]` plus
  `prefers-color-scheme` in `src/app.css`. Its three states (system, light,
  dark) and its saved setting keep working.
- The service worker precaches build output and `static/` files
  (`src/service-worker.ts`), named by app version.

## Approaches considered

How to get from today's code to the new look. The survey of the code found 52
components, 54 `.svelte` files with their own `<style>`, roughly 200
hard-coded colours, 37 gradients and 135 hard-coded corner radii, and a global
`.card` class used about 60 times.

**1. Rework the existing pages in place, in stages, on a preview address
(chosen).** One branch. Each stage restyles or rebuilds part of the site where
it already lives. Each stage is deployed to a preview address for the owner to
look at with their real collection. The live site changes once, when the
branch is merged and deployed.
*Trade-off:* the branch lives for a while and the live site gets no visible
change until the end. In return nothing is built twice and the owner never
sees a half-done site.

**2. Build a new profile beside the old one and switch at the end.** The old
page stays untouched as a fallback.
*Trade-off:* about 50 components would exist twice during the work, and the
other pages still have to be reworked in place, so it is approach 1 plus
duplication. A preview address already gives the safety this is meant to buy.

**3. Ship the new colours and type to the live site first; tabs and shelf
later.** Quickest visible change.
*Trade-off:* the live site would sit for a while as the old long page in new
colours, which is the "revamp" the owner rejected.

The owner was shown all three with approach 1 recommended and "I'll go with
option 1 unless you say otherwise", and answered "go forth and write".

## The look

### Colours

| Role | Light | Dark |
|---|---|---|
| Ground (page background) | `#ECEEE8` | `#131815` |
| Ink (text, rules, shelf boards, bars) | `#18201C` | `#E8EBE3` |
| Muted text | `#4A534D` | `#A6B0A7` |
| Hairline (row dividers) | `#C2C8BE` | `#2F3933` |
| Track (bar backgrounds, placeholders) | `#D5DAD1` | `#3A463F` |
| Accent | `#C8321F` | `#E2513A` |
| Text on an ink-filled button | `#ECEEE8` | `#131815` |

Measured contrast against the ground: ink 14.2:1, muted 6.8:1, accent 4.6:1
(light); 14.9:1, 8.0:1, 4.7:1 (dark).

The accent is used for exactly four things: the marker under the open tab,
links on hover, the end dot of the growth line, and the rule beside an error
message. It is never a fill for a button or a background.

Spine colours (the shelf only):

| | Light | Dark |
|---|---|---|
| Set | `#18201C` `#F6F3EA` `#C8B899` `#8C8F8A` `#C8321F` `#2E5A88` `#D7A53A` `#5F7F5C` `#3B2A3F` | `#2B352F` `#F1EEE4` `#C8B899` `#8C8F8A` `#D9452F` `#4F86C2` `#D7A53A` `#7FA37B` `#8A6A93` |
| Edge on each spine | 1px on the right, `rgba(24,32,28,0.3)` | 1px on the right, `rgba(0,0,0,0.45)` |

The edge matters: the palest spine is almost the colour of the ground and the
darkest dark-mode spine is almost the colour of the dark ground.

Chart colours are in [Charts](#charts).

### Type

One family, Bricolage Grotesque (SIL Open Font License), weights 400 to 800,
with `'Segoe UI', system-ui, sans-serif` behind it. The font files are served
by the site itself. Text in scripts the font does not cover falls back to the
system font.

| Use | Size | Weight | Notes |
|---|---|---|---|
| Page title (`h1`) | `clamp(44px, 6.9vw, 88px)`; 40px on a phone | 800 | letter-spacing -0.03em, line-height 0.95 |
| Section heading (`h2`) | 28px | 700 | letter-spacing -0.01em |
| Tab | 21px; 16px on a phone | 500, open tab 700 | |
| Lead line | 20px; 18px on a phone | 400 | muted |
| Body and row text | 17 to 18px | 400 to 600 | line-height 1.4 |
| Small labels | 15px | 400 | muted |
| Big figure | 34px | 800 | letter-spacing -0.02em |

Headings and labels are in sentence case ("Just added", not "Recently
Added"). No all-caps labels.

### Shape

- No cards. A section is open on the ground under a 4px ink rule, 16px above
  its heading. Sections are 56px apart. Rows inside a section are divided by a
  1px hairline.
- Square corners everywhere. The only round things are things that are round:
  the logo mark, the refresh button, the dot on the growth line.
- No shadows and no colour fades.
- Page width up to 1280px with side padding `clamp(20px, 4.4%, 56px)`.
- Buttons: 52px high, square. Primary is ink-filled; secondary has a 2px ink
  border. Never smaller than 44px to touch.
- Text inputs and selects: no box, a 2px ink line underneath, placeholder in
  muted text.
- Links: ink, underlined with a 4px offset, accent on hover.
- Keyboard focus: a 2px ink outline, 3px away from the element.
- Record covers: square, with a 1px inner edge `rgba(24,32,28,0.12)` so pale
  sleeves do not melt into the ground.
- Motion: none on page load and none on tab switch. The refresh button turns
  while loading. `prefers-reduced-motion` stays respected. The old card
  fade-in goes.

## The shared frame

Today each page brings its own navigation and footer, and three pages have
none. The top bar and footer move into the root layout so every page has them.

**Top bar.** Left: the logo mark (a ring with a centre dot) and "Record Shelf",
linking home. On a phone the words are hidden and the mark alone remains.
Right, depending on the page:

| Page | Right side of the bar |
|---|---|
| Profile | Wantlist, Discogs (that user's Discogs page), Settings, refresh button |
| Wantlist | Collection (back to the profile, replacing today's "Back to Collection" link), Settings. No refresh button and no Discogs link: the wantlist has neither today. |
| Home, Compare, Settings, error page | Compare, Settings |

**Footer.** A hairline, then "© <year> Record Shelf. Not affiliated with
Discogs." and two plain text controls: the light/dark switch, written out as
"Theme: system", "Theme: light" or "Theme: dark" and cycling as today; and, on
the profile, "Keyboard shortcuts".

The floating theme button and the floating "?" button go (their jobs move to
the footer). The floating back-to-top button stays, square, bottom right, and
only appears after scrolling down a screen.

## The profile

### Order and tabs

On every tab: top bar, the title "<username>'s shelf", the tab row, a status
line when something is loading or wrong, then the tab's content.

The tab row is a `<nav>` of five links: Overview, Records, Charts, Activity,
Extras. The open tab is weight 700 with a 6px accent line under it and
`aria-current`; the others are weight 500 in muted text. On a phone the five
fit on one row at 16px.

The address carries the tab:

| Address | Tab |
|---|---|
| `/u/<name>` | Overview |
| `/u/<name>?tab=records` | Records |
| `/u/<name>?tab=charts` | Charts |
| `/u/<name>?tab=activity` | Activity |
| `/u/<name>?tab=extras` | Extras |

- An unknown `tab` value shows Overview.
- Choosing a tab adds a step to the browser history, so Back returns to the
  previous tab.
- The Records filters keep their address parameters as today (`search`,
  `genre`, `format`, `decade`, `sort`, `order`, `page`) next to
  `tab=records`, and still replace rather than add history steps. Leaving
  Records drops them from the address.
- Only the open tab's components are mounted.
- The browser tab title becomes "<username>'s shelf - Record Shelf".

The wantlist stays its own page at `/u/<name>/wantlist`. It loads different
data, so it is not a sixth tab.

### Where every card goes

| Today | New home | Change |
|---|---|---|
| Header: username | Title "<username>'s shelf" | |
| Header: avatar, location | Dropped | |
| Header: badge pills | Overview, one muted line at the foot of "At a glance" | Plain text, comma-separated |
| Header: refresh, Wantlist, Discogs, Settings | Top bar | |
| Section jump bar | The tab row | |
| Six stat cards | Overview, "At a glance" | Rows: Records, Artists, Labels, Average year, Year span, Top genre |
| Recently Added | Overview, "Just added" | The three newest as rows, then "See all <n> records" to the Records tab |
| Top Artists | Overview, "Top artists" | Ten rows |
| By Decade | Overview, "By decade" | Ink columns |
| Collection Highlights | Overview, last section, "Highlights" | Twelve random covers, as today |
| Full Collection | Records, "All records" | Filters always visible (no "Filters" button) |
| Duplicates & Variants | Records, "Duplicates and variants" | |
| Vinyl Upgrade Picks | Records, "Vinyl upgrade picks" | |
| By Genre (donut) | Charts, "By genre" | Eight ranked bars |
| Top Styles | Charts, "Top styles" | Twelve ranked bars |
| Ratings | Charts, "Ratings" | |
| Artist Loyalty | Charts, "Artist loyalty" | |
| By Format (donut) and Format Drill-Down | Charts, "By format" | One section: a split bar over rows that expand |
| Top Labels | Charts, "Top labels" | Ten rows |
| Release Years, and the Oldest/Newest release pair | Charts, "Release years" | The year grid, with "Oldest release" and "Newest release" under it |
| Collection DNA | Charts, "Collection DNA" | Four trait rows; its genre ring goes ("By genre" shows the same thing) |
| Collecting Calendar | Activity, "Collecting calendar" | |
| Collection Growth | Activity, "Collection growth" | |
| New vs Vintage | Activity, "New vs vintage" | |
| Genre Evolution | Activity, "Genre evolution" | |
| Collecting Activity | Activity, "Collecting activity" | |
| Day Patterns | Activity, "Day patterns" | |
| Milestones | Activity, "Milestones" | |
| Collection Timeline | Activity, "Collection timeline" | |
| What Should I Listen To? | Extras, "What should I listen to?" | |
| Collection Quiz | Extras, "Collection quiz" | |
| Share Stats | Extras, "Share" | New picture, see below |
| Collection Value | Extras, "Collection value" | |
| Explore More | Extras, "Explore more" | |
| Export Collection | Extras, "Export" | |

Layout of each tab at desktop width (two columns where noted; one column on a
phone, in the order listed):

- **Overview:** lead line, shelves, then two columns. Left (wider): Just
  added, By decade. Right: At a glance, Top artists. Then Highlights across
  the full width.
- **Records:** All records (search field, three selects, "Sort by" with Date
  added, Artist, Title, Year; a cover grid of six columns, two on a phone;
  "Show more" in steps of 24 with "<shown> of <n> shown"), then Duplicates and
  variants, then Vinyl upgrade picks.
- **Charts:** two columns. Left: By genre, Top styles, Ratings, Artist
  loyalty. Right: By format, Top labels, Release years, Collection DNA.
- **Activity:** Collecting calendar across the top (scrolls sideways inside
  its own box when it does not fit), then two columns. Left: Collection
  growth, New vs vintage, Genre evolution. Right: Collecting activity, Day
  patterns, Milestones. Then Collection timeline across the full width.
- **Extras:** What should I listen to?, Collection quiz, Share, Collection
  value, Explore more, Export.

Everything that opens the side list today still does: a decade, genre, format,
style, artist, label or year, a duplicate group, an upgrade pick, a format
drill-down row.

**The mockups fix the look, not the feature list.** Where a mockup shows a
control that today's component does not have, today's behaviour wins. The
known case: the Extras frame shows "Estimate again" beside a value result;
today the button exists only before a result, and it stays that way. Labels
are in sentence case, using the mockup's wording where the mockup shows one
and today's wording otherwise.

### The shelf

The shelf is the one bold thing on the site. It appears on the Overview tab
only, under the lead line:

> <n> records, one spine each. The first one added sits on the left.

(With one record: "1 record, one spine each. …". With none there is no lead
line.)

**What a spine means**

| Property | Comes from | Rule |
|---|---|---|
| Position | Date added | The first record added at the left of the top shelf, the latest at the right of the bottom shelf. Added at the same instant: by artist, then title, then the copy's id, so the order is the same on every visit. Records whose date added is missing or unreadable go at the very end. (Release year until 0.12.0; the owner chose date added after go-live.) |
| Height | Record size | A 7-inch is 56% of the shelf height, a 10-inch 90%. Everything else is full height: LPs, 12-inch singles, CDs, tapes, box sets. |
| Width | Number of discs | One disc is one unit wide, two discs two units, three or more four units. On top of that each record's thickness varies a little, from 0.8 to 1.4 times its width, fixed per record from its id. A two-disc record is always wider than any single. |
| Colour | Nothing | Decoration. Picked from the spine set by a fixed rule from the record's id, so a record keeps its colour between visits. Weights as in the mockup: ink 5, cream 6, tan 4, grey 3, red 2, blue 2, mustard 2, green 1, plum 1. |

Size comes from the format descriptions Discogs already sends (`7"`, `10"`);
disc count from the format quantity. All of it is in the records the browser
already has. No new data is fetched.

Colour by genre was considered and rejected for now: a collection that is
mostly one genre would come out as a wall of one colour, the opposite of the
approved picture, and it would need a legend under the hero. Colour is decided
in one function so this can be revisited after the owner sees their real shelf.

**The picture wins over the data.** The mockup's spines are made up: 38% of
them are wide and 16% short. A real collection is mostly single LPs, so a
shelf drawn strictly from the data would be flatter and more even than the one
the owner approved. Where the two pull apart, the approved picture decides:
the number of shelves is set by a count that reproduces the mockup (below),
and the small variation in thickness is there so a run of single LPs does not
come out as even stripes. The honest signals stay readable: a double album is
visibly wider, a 7-inch visibly shorter.

Nobody but the owner can see their real mix of formats before the stage 2
preview. Until then the shelf is built and checked against made-up records in
a realistic mix (mostly single LPs, some doubles, a few 7-inch and 10-inch).
Stage 2 includes a tuning pass after the owner has looked at their real shelf.

**Rows**

- Each shelf is the full content width: spines standing on an ink board.
  Desktop: 104px tall, 8px board, 18px between shelves. Phone: 44px tall, 5px
  board, 10px between shelves.
- The number of shelves comes from the number of records, to match the
  approved picture: about 230 records to a shelf on a wide screen and about
  115 on a phone, rounded up. For 679 records that is three shelves on a
  desktop and six on a phone, as drawn. Between those widths the count per
  shelf scales with the width (roughly one record per 5px of shelf on a
  desktop, one per 3px on a phone).
- Records are split across those shelves in order, about the same total width
  on each, and the spines stretch to fill the shelf.
- A spine is never wider than about 12px per unit. A small collection is a
  partly filled shelf, left-aligned, with one board.
- At most six shelves on a wide screen and eight on a phone. A larger
  collection shows those and a "Show the whole shelf" button for the rest.
- "First added" and "Latest" sit under the last shelf, left and right, in
  small muted text. While the shelf is capped only "First added" shows.
- An empty collection shows one empty board and "Nothing on the shelf yet."

**Using it**

- Hovering a spine shows a small label naming that record: title, artist,
  year.
- Clicking or tapping a shelf opens the side list with that shelf's records,
  in shelf order (first added first), titled with the months the shelf covers
  ("Mar 2021 to Jan 2023"). A shelf inside one month is titled "Mar 2021";
  unknown dates are left out of the range, and a shelf of only unknown dates
  is "Date unknown". Months are three-letter English names and four-digit
  years, read in the browser's local time, as the Collection timeline's month
  columns are.
- Each shelf is one keyboard stop, announced as, for example, "Shelf 1 of 3:
  227 records, Mar 2021 to Jan 2023. Open the list." Enter opens the same
  side list. The spines themselves are not keyboard stops.

**While loading.** Records never arrive all at once. The server hands over
the first 100 of a stored copy; the browser then fetches the rest from the
site's store in batches, which takes about a second for 679 records. A list
coming from Discogs takes about a second per 100. Records arrive newest-added
first, which is not shelf order, so drawing each batch as it lands would
re-lay the whole shelf several times on every visit. Instead:

- The total number of records is known from the first reply. The shelves and
  their height are laid out from it straight away, as empty boards, so nothing
  below the shelf moves later.
- When the server handed over a complete stored copy, the spines are drawn
  once, when the list is whole.
- When the list is coming from Discogs (no stored copy yet), spines are drawn
  as batches arrive, and the shelf re-lays itself with each batch. That load
  takes several seconds anyway and happens only the first time a list is
  seen. The boards and their height still do not change.
- A refresh in the background leaves the drawn shelf alone until the new list
  is whole.
- The server-rendered page has the title, the tab row and the empty boards.

## Charts

Forms. Each was chosen for the job the numbers do:

| Chart | Form |
|---|---|
| By decade | Ink columns, one per decade, label under each |
| By genre, Top styles, Top labels | Ranked rows: name, ink bar on a track, count |
| Top artists | Ranked rows; the bar is drawn as a little row of spines (3px ink strokes, 2px gaps) |
| By format | One thin bar split by share, in chart colours with a legend; under it a row per format that expands to its sub-formats |
| Ratings | Average and "<rated> of <n> rated", then five ink bars from 5 stars to 1 star, then the top rated covers |
| Release years | A row per decade of ten year cells, shaded by count, with a "Fewer … More" key |
| Collection DNA | Four rows (Diversity, Vintage, Vinyl, Focus): name, percent, ink bar on a track |
| Artist loyalty | A row per artist with a strip of their covers and the Loyal / Devoted / Superfan word |
| Collecting calendar | A year of day cells, shaded by count, same key as Release years |
| Collection growth | One 2px ink line over a 10% ink area, accent dot and value at the end |
| New vs vintage | Two fact rows, then four ink bars (New releases, Recent, Classic, Vintage) with their descriptions |
| Genre evolution | A row per year for the last five years, each a bar split by genre in chart colours with a legend |
| Collecting activity | Three fact rows (Average per month, Peak month, Month streak), then yearly ink bars |
| Day patterns | Seven ink columns, Sun to Sat |
| Milestones | "Next: <name>, at <n> records", an ink bar on a track, "<have> of <n>", "<left> to go", then the milestones reached |

Colour rules:

- One series is ink. Most charts are one series.
- Charts with several named parts (By format, Genre evolution, the two people
  on Compare) use the chart colours below, always in this order, with a
  legend. A sixth and later part is folded into "Other".
- Genre evolution picks the five most common genres across the five years
  shown; each keeps its colour in every row. (Today it picks the top four per
  year, which can mean more than five genres in all.)
- Shaded grids (Release years, the calendar) use the five-step shade ramp. A
  zero is an empty cell with a hairline edge.
- Text is never in a chart colour. A swatch next to ink text carries identity.
- Every bar, cell and segment has its number in text beside it or on hover and
  keyboard focus.
- Bars keep square ends, to match the spines.

| | Light (on `#ECEEE8`) | Dark (on `#131815`) |
|---|---|---|
| Chart colours, in order | `#2B66A8` `#A8770A` `#7A4E9C` `#23855A` `#C8321F` | `#5490CC` `#B98A26` `#9F7FC8` `#42A277` `#E2513A` |
| "Other" | `#7C837D` | `#7C867F` |
| Shade ramp, fewest to most | `#DDE1D8` `#AEB7AC` `#869288` `#4A574E` `#18201C` | `#404E46` `#5C6B61` `#93A097` `#BCC5BC` `#E8EBE3` |

Both colour sets and both ramps were run through the dataviz palette checker
against their ground and pass every check (lightness band, colourfulness,
separation for colour-blind and normal vision, contrast). Text inside a shaded
cell (the year numbers in Release years) takes whichever of the ink or ground
colour reads better. Every step of both ramps reaches at least 4.5:1 that way;
the tightest is the second dark step at 4.7:1.

The old palettes retire: `CHART_PALETTE` and `RANK_PALETTE` in
`src/lib/utils/chart.ts`, `GENRE_COLORS` in `src/lib/constants.ts`, and the
greens hard-coded in `CollectingCalendar.svelte`.

## States

- **Status line.** Today's loading banner becomes one line of muted text under
  the tab row with a thin ink progress line beneath it when there is a count
  to show. Same states and wording as today (loading, refreshing, waiting,
  cooling down, error with its "Retry" button).
- **Errors.** Ink text with a 4px accent rule on the left and, where a retry
  makes sense, a secondary button. Never colour alone.
- **No such user, private collection.** The top bar, then the message as
  plain text under a 4px ink rule.
- **Side list (drawer).** Same behaviour. Ground-coloured panel, 2px ink edge,
  square, a section heading and a close button. Esc still closes it.
- **Keyboard help.** Same overlay, new look, opened from the footer or `?`.

## Keyboard

| Key | Today | New |
|---|---|---|
| `j` / `k` | Next / previous section | Next / previous tab |
| `/` or `s` | Focus the collection search | Open the Records tab and focus its search |
| `?` | Show the help | Same |
| `Esc` | Close the side list | Same |

## Phone

As in the two phone frames: logo mark without the words, the title at 40px,
five tabs on one row, shorter shelves, one column of sections, a two-column
cover grid, decade labels shortened to "50s". Nothing scrolls sideways except
the calendar inside its own box. Layouts between 390px and 1280px wide are the
builder's to work out; two columns collapse to one when the narrower column
would drop below about 320px.

## The other pages

Each keeps its layout and content. Each gets the shared top bar and footer,
the colours, the type, open sections instead of cards, and the new buttons,
inputs and links.

| Page | Notes |
|---|---|
| Home (`/`) | Title "Record Shelf", the username search as an underlined field with a primary button, the feature list as open sections. No shelves here. Its own Settings and Compare links move to the top bar. |
| Wantlist | Title "<username>'s wantlist". The grid matches the Records grid. |
| Compare (both pages) | Where two people are compared in a chart, the first is chart colour 1 and the second chart colour 2, with a legend. |
| Settings | The form in the new look. Wording unchanged. |
| Error page | Top bar, the message as a title, a link home. |

Things with a look of their own, all brought into line:

- **Share picture** (`ShareableCard.svelte`, a drawn PNG). Redrawn as in the
  Extras frame: ground colour, "<username>'s shelf", one row of real spines
  sampled evenly across the collection, a few facts, and the page's address at
  the foot. The font must have finished loading before the picture is drawn.
- **Favicon and app icon** (`static/favicon.svg`, `src/lib/assets/favicon.svg`,
  `static/manifest.json`, the `theme-color` meta): the ring-and-dot mark in
  ink on the ground colour; `theme-color` is `#ECEEE8` light and `#131815`
  dark.
- **Offline page and the no-JavaScript message** (`static/offline.html`,
  `src/app.html`): ground, ink, the fallback font stack (they cannot count on
  the web font).
- **Printed insurance list** (`CollectionExport.svelte`): stays black on
  white; drop any old colours.

Two wording errors are fixed in passing, because the components are being
rewritten anyway and both are plainly wrong:

- The share picture and its text print `recordshelf.app/u/<name>`. The site is
  not at that address. They print the address the page is actually on.
- Explore more prints "1970ss Rock" (`Recommendations.svelte` adds an "s" to a
  decade that already has one).

## Build order and preview

One branch, `shelf-redesign`, from `master` @ bfa75b6. Seven stages. Each ends
with the checks passing and a preview deploy for the owner to look at.

| Stage | What the owner sees on the preview |
|---|---|
| 1. Foundation | Every page in the new colours and type, light and dark, with the shared top bar and footer and no card boxes. The profile is still the old long page. |
| 2. Profile frame and Overview | The title, the tab row, the address per tab, the real shelf, and the Overview sections. The other tabs hold their old sections for now. |
| 3. Records | The Records tab as drawn. |
| 4. Charts | The Charts tab as drawn, in the new chart colours. |
| 5. Activity | The Activity tab as drawn. |
| 6. Extras | The Extras tab and the new share picture. |
| 7. The rest | Home, wantlist, Compare, Settings and error page finished; favicon, offline page, print list; the side list, status line and keyboard help. |

Stage 1 exists so that the half-way states the owner sees are "new look, old
arrangement", never broken pages. It is seen only on the preview.

**Preview.** A deploy from a branch other than `master` becomes a preview at
its own address and leaves the live site alone:

```
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare `
  --project-name record-shelf `
  --branch shelf-redesign
```

The command prints the address (expected:
`shelf-redesign.record-shelf.pages.dev`). It is a different address from the
live site, so the owner pastes their Discogs token into Settings there once.

To check on the first preview, by opening `/api/status` there: that the store
is bound (the preview should read the same stored copies as the live site),
and whether `STORE_WRITERS` is set for previews. Cloudflare keeps secrets
separately for the live site and for previews, so it is probably not set.

**Open, the owner's to answer: may the preview write to the store?** The data
is safe either way: this work does not change what is stored or how. The
difference is what the owner sees while reviewing.

- *Without* `STORE_WRITERS` on the preview, the preview can read stored copies
  but not refresh them. Once the stored copy is more than six hours old, every
  full load of the profile on the preview fetches the whole collection from
  Discogs again in the owner's browser (about eight calls for 679 records),
  shows "updating" while it does, and stores nothing, so the next load does
  the same. Opening the live site first refreshes the copy and stops this for
  six hours.
- *With* the same value on the preview as on the live site, the preview
  behaves like the live site. The same tokens may write as today and nobody
  else.

Recommended: the same value on the preview. It is a one-off setting in
Cloudflare, done before the stage 1 preview. Until the owner says yes, nothing
about `STORE_WRITERS` is changed anywhere, and the preview runs without it.

**Outcome (2026-11-14):** the owner approved the design without answering
this. So the default stands: `STORE_WRITERS` is not touched, and the preview
runs without it. When a preview is handed over, the hand-over note says to
open the live site first if the preview shows "updating" on every load. The
owner can still say yes at any time.

**Going live.** When the owner is happy with stage 7: merge to `master`, bump
the version to 0.12.0, and, after asking, run the production deploy.

**The other branch.** `worktree-token-header` (pushed, unmerged, version
0.11.2) changes how the token travels. This work assumes it is not merged
while the redesign is in progress. If the owner wants it, it goes in before
stage 1 or after going live.

## Tests

- All existing checks pass at the end of every stage: `npm run check`,
  `npm test`, `npm run test:e2e`, and both builds.
- Tests that point at things this work renames or moves are updated with the
  change that breaks them. Known ones: `locator('#overview')` (three places in
  `e2e/profile.test.ts`), a few `h1` texts, `.theme-toggle` (twice) and
  `a.home-link` in `e2e/smoke.test.ts`, and `#collection` in
  `keyboardNav.test.ts`.
- New logic gets unit tests: what a record's spine looks like (height, width,
  colour, order), how records split into shelves, reading the tab from the
  address, and the five-genre rule for Genre evolution.
- New browser tests: choosing a tab changes the address and the content; Back
  returns to the previous tab; a link with `?tab=charts` opens on Charts; the
  Records filters survive next to `tab=records`; the theme switch in the
  footer works.
- Before each preview goes to the owner, the builder looks at the changed
  pages in a real browser at 1280 and 390 wide, in light and dark.
- Lighthouse on the home page stays at 0.9 or better for accessibility and
  best practices.

## Calls for the owner to check

One question was the owner's alone: whether the preview may write to the
store. It is set out under
[Build order and preview](#build-order-and-preview). It was not answered, so
`STORE_WRITERS` is left exactly as it is.

The owner approved this document with these calls listed, without commenting
on them one by one. Most important first.

1. **Dark mode stays**, looking like the dark frame. The site has a
   light/dark switch today, so dropping it would take something away.
2. **What a spine means.** Order is release year (changed after go-live to
   date added, at the owner's word; see [The shelf](#the-shelf)); height is record size;
   width is number of discs; colour is decoration only. The alternative,
   colour by genre, is described under [The shelf](#the-shelf).
3. **The picture wins over the data.** The mockup's spine sizes are made up
   and a real collection is more even. The number of shelves is set to match
   the mockup (three on a desktop for 679 records), and each spine's thickness
   varies a little so the shelf does not come out as even stripes. The owner
   judges their real shelf on the stage 2 preview, and that stage includes
   tuning.
4. **Using the shelf.** Hover names a record; clicking a shelf opens the side
   list of that shelf's records. For about a second after the page opens the
   shelves are empty boards, then all the spines appear together.
5. **The whole site changes together.** Home, wantlist, Compare and Settings
   get the look in the same release and keep their layout. They have not been
   drawn; the owner first sees them on the stage 1 preview.
6. **The header loses the avatar and location.** The badges ("Explorer",
   "90s kid" and so on) become one line of plain text on Overview.
7. **Settings joins the top bar. The light/dark switch and keyboard help move
   to the footer.** The two floating buttons for them go.
8. **Card moves and chart changes**, as in the table under
   [Where every card goes](#where-every-card-goes): the two donuts become
   bars, By format and Format drill-down merge, Collection DNA loses its genre
   ring, the Records filters are always visible, Collection Highlights sits at
   the foot of Overview.
9. **Keyboard:** `j` and `k` move between tabs instead of sections.
10. **Two wording errors fixed in passing** (the share address and "1970ss").
   The rest of the fix list stays out.
11. **The font is served by the site itself**, not loaded from Google, so no
    visitor's browser contacts a third party for it.
12. **Permissions this plan asks for.** Approving the build plan would mean:
    commits on the `shelf-redesign` branch as the work goes, and preview
    deploys of that branch without asking each time. Still asked for every
    time: pushing to GitHub, merging to `master`, and the production deploy.
13. **Version 0.12.0** at going live.

## Left to the builder

- Names of the colour and size tokens, class names, and how files are split.
  The requirement is that components read tokens and hold no colours, corner
  radii or shadows of their own. Drawn pictures (the share PNG) read the same
  values.
- How the tab is wired in SvelteKit, within the rules above (history step per
  tab, no data reload, filters keep working).
- Which components are merged, split or deleted. `DonutChart`, `SectionNav`,
  `StatCard`, `BrandNav`, `SiteFooter`, `FloatingActions` and `LazySection`
  are likely to go or change shape.
- How the shelf is drawn (elements, SVG or canvas) and how the hover label
  finds its record, as long as a 5,000-record collection stays smooth.
- Whether the side list opened from a shelf can start at the record that was
  under the pointer.
- How the font is packaged (files under `static/` or a font package that the
  build bundles), which subsets, and preloading. Requirements: same origin,
  weights 400 to 800, text visible while the font loads.
- Every measurement not given here: take it from the mockup sources.
- Layouts between phone and desktop width.
- Hover behaviour on charts beyond "the number is reachable".
- How tests are organised.
