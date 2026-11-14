# Stored copies: keeping Record Shelf inside the Discogs rate limit

> **Date:** 2026-11-13 · **Base:** `master` @ cd5f4a8 (v0.10.18) · **Status:** awaiting owner approval
>
> This is project 1 of 3. Project 2 is the profile facelift (stop dumping every
> section at once). Project 3 is the sweep of remaining fixes. Each gets its own
> design; this one is first because it decides how pages get their data.

## Intent

Record Shelf is the owner's own collection site. They open it to show people,
and people they show it to sometimes look up their own Discogs username. It runs
on Cloudflare Pages (`*.pages.dev`).

Today it keeps running into Discogs' rate limit, and the owner cannot show
people a site that breaks whenever the limit is hit.

Access is by Discogs token, entered once in Settings. The owner wants to keep
that: it is what stops a crawler that finds the site from spending Discogs
calls. Friends are not walked through creating a token of their own; the owner
gives them the owner's token to paste.

The fix is to stop treating Discogs as something to call on every view. A
collection is fetched from Discogs once, saved in Cloudflare's key-value store,
and served from that stored copy to everyone who has a token. Discogs is only
called to build a copy the first time and to refresh it when it is more than
six hours old, always slowly and always through one code path.

## Why it breaks today

`P` is the number of 100-record pages in a collection.

| Path | Discogs calls today | Notes |
|---|---|---|
| Profile view (`/u/[username]`) | about `2P + 2` | Server fetches profile + page 1. Browser then pulls pages 2..P back-to-back with no pacing (`+page.svelte:63-115`). On Cloudflare a background job fetches profile + all P pages again (`+page.server.ts:53-62`). |
| Wantlist view | `1 + Pw` every view | Whole wantlist fetched server-side, blocking, never cached. |
| Compare | `(1 + P1) + (1 + P2)` | Both collections fetched in full, in parallel, blocking. |
| Value estimate | up to 20 per click | The 20 sampled releases are random per page load, so the price cache rarely hits. |
| Widget (`/api/widget`) | 2 per poll | 5-minute cache. |

Contributing causes, all confirmed in the code:

- **The cache is very likely off.** All caching goes through a KV binding named
  `COLLECTION_CACHE`. `wrangler.toml` has never declared it (commented out in the
  first commit, removed in 7997c3e). For Pages, a wrangler file with
  `pages_build_output_dir` is the source of truth for project configuration.
  When the binding is missing, `getCacheStore()` returns `null` and every cache
  read and write silently does nothing. *Not yet confirmed against the live
  Cloudflare project; wrangler was not logged in on the dev machine.*
- **The token gate has a hole.** Every route resolves the token as
  `cookies.get('discogs_token') || env.DISCOGS_TOKEN`. If `DISCOGS_TOKEN` is set
  on the server (the widget needs it), a visitor with no token is not sent to
  Settings; their request runs on the server token. `/` redirects to
  `/u/pottejd` and `robots.txt` allows everything, so a crawler hitting the
  root triggers a full load. *The owner believes `DISCOGS_TOKEN` was never set
  on the live project. If so this hole is latent: tokenless traffic is already
  redirected to Settings, the widget has never worked there, and the overload
  comes from token holders' own page views.*
- **The background full fetch cannot finish for large collections.** Cloudflare
  stops `waitUntil` work 30 seconds after the response; at 1.1 s per page that
  is about 27 pages.
- **Nothing shares a budget.** Collection, wantlist, compare, value and widget
  each pace themselves separately, per isolate. A 429 is retried up to three
  times inside the same request, which adds calls while already over the limit.
- **A 429 ends in an error page** (`error(429, ...)` in every loader).

## Goals

1. Viewing a collection that has a fresh stored copy makes **zero** Discogs
   calls.
2. No Discogs call is ever made for a visitor who has not entered a token.
   Crawlers and anonymous traffic cost nothing.
3. Being rate-limited by Discogs never produces an error page. The page shows
   what it has and resumes on its own.
4. A stored collection stays viewable no matter what state the Discogs budget
   is in.
5. Displayed data follows Discogs' six-hour freshness term as closely as
   "refresh on visit" allows (see Constraints).
6. A missing store binding is visible, not silent.
7. No Discogs token is kept on the server, anywhere: not in the store, not in
   logs, not in the project's settings.

## Non-goals

- The profile facelift, tabs, or any layout change (project 2).
- Rendering from a small stored summary before the records arrive. Project 2
  will define what the summary holds; see "Left for project 2" below.
- A scheduled background refresher (a separate Worker with a cron trigger).
  Ruled out by the owner: it would need a token kept on the server.
- A strict cross-isolate rate limiter (would need a Durable Object).
- Slimming the stored record payloads.
- Durable storage for the Docker/adapter-node build.
- Changing how the token is stored in the browser (it stays in localStorage and
  a script-readable cookie; hardening is project 3).
- Other audit findings not listed here (project 3).

## Anti-goals

These would make the work a failure even if it technically runs:

- A request with no visitor token causes a Discogs call.
- A Discogs token is written to the store, to a log, or read from server
  configuration.
- A visitor sees a rate-limit error page.
- A page render (`load` function) calls Discogs.
- A private collection ends up in the shared store.
- The store is off or failing and nothing says so.
- Collection or wantlist data supplied by a browser is written into the shared
  store and then shown to other visitors. (Value history is a stated exception;
  see below.)
- A public endpoint lets one request trigger an unbounded number of Discogs
  calls.

## Constraints

Checked against Cloudflare's documentation on 2026-11-13:

| Limit | Free plan | Paid plan |
|---|---|---|
| CPU time per request | 10 ms | 30 s default |
| Subrequests (outbound `fetch`) per request | 50 | 10,000 |
| Calls to Cloudflare services (KV) per request | 1,000 | 1,000+ |
| Requests per day | 100,000 | n/a |
| `waitUntil` after the response | 30 s | 30 s |
| KV reads per day | 100,000 | unlimited |
| KV writes per day | 1,000 | unlimited |
| KV value size | 25 MiB | 25 MiB |
| KV writes per second to one key | 1 | 1 |

The owner's plan is unknown, so the design must fit the free plan: every request
does a small, bounded amount of work.

Other constraints:

- **KV is eventually consistent.** A write can take up to about a minute to be
  visible elsewhere, and a lookup that found nothing may be remembered briefly.
  No request may depend on reading back what an earlier request just wrote.
- **Discogs allows 60 authenticated requests per minute** (25 unauthenticated).
  The response headers `X-Discogs-Ratelimit`, `X-Discogs-Ratelimit-Used` and
  `X-Discogs-Ratelimit-Remaining` report the budget. *From memory of Discogs'
  documentation, which would not load on 2026-11-13; confirm the header names
  against a live response.* Discogs is believed to count per source address, and
  Cloudflare shares outbound addresses between customers, so a 429 can arrive
  even when this app's own usage is low. The design must tolerate a 429 at any
  time.
- **Discogs' API Terms of Use limit how old displayed data may be.** "You may
  not display in any format or to any audience the Content if it is more than
  six (6) hours older than the information on Our online properties or
  applications." A companion clause (seen quoted secondhand) says content may
  not be cached or stored longer than is necessary to provide a service to the
  application's users. Source:
  https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use
  (found via search on 2026-11-13; the page itself blocks automated reads).
- Both build targets must keep building: Cloudflare (default) and adapter-node
  (`ADAPTER=node`, exercised by CI's `build-node` job).
- CI must stay green: `npm run check`, `vitest run --coverage` (30% thresholds),
  both builds, Playwright e2e.

## Approaches

**A. Stored copies, filled in through the browser — chosen by the owner.**
Each page fetched from Discogs is saved as it passes through. The browser drives
the first load one page at a time; later visitors read the stored copy. A copy
more than six hours old is re-synced in the background on the next visit. Every
request stays small, so it fits the free-plan limits and never needs long
background work. Cost: the first view of a never-seen username is still slow
(about a second per 100 records).

**B. A scheduled background job.** A separate Worker refreshes the owner's
collection on a timer. Always warm without a visitor, but it is a second thing
to deploy, looking up a new username would still need approach A's on-demand
path, and it needs a token stored on the server, which the owner has ruled out.

**C. Patch what is there.** Bind the cache, pace the browser loader, drop the
duplicate background fetch, block crawlers. Least work, but it keeps a full
re-fetch whenever the cache expires (cut off at 30 s for big collections), keeps
separate budgets, and a 429 still ends in an error page. Rejected because it
does not meet goals 3 and 4.

The owner picked A, with C's fixes folded in.

## Design

### Rules everything else follows

1. **Page renders never call Discogs.** Only `/api/*` endpoints do. A crawler,
   link preview or hover-preload that renders a page costs nothing.
2. **One request, one page.** An API request makes a small fixed number of
   Discogs calls: at most three when starting a sync (visibility check, profile,
   first page) and otherwise at most one. The one exception is the value
   estimate, bounded at 20 (see below).
3. **Discogs is only called with the visitor's token.** The token comes from
   the `discogs_token` cookie and nowhere else. The server has no token of its
   own: nothing reads `env.DISCOGS_TOKEN` any more.
4. **The browser is told when to come back.** The server reports how long to
   wait before the next call; the browser obeys. No request sleeps and retries
   on a 429.
5. **Only the server writes the store, only with data it fetched from Discogs
   itself, and only for collections it has confirmed are public.**

### The token gate

Decided by the owner: everyone enters a token. Friends paste the owner's.

- **Where the token lives.** In the visitor's browser only (localStorage and
  the `discogs_token` cookie, as today). The browser sends it with each
  request; the server uses it for that request's Discogs call and keeps
  nothing. Only collection data goes into the store.
- A page request with no token cookie is redirected to `/settings` with the
  return path, as today. With the server-token fallback gone, this always
  holds.
- An API request with no token cookie gets a typed "token required" result and
  makes no Discogs call.
- An invalid or revoked token (Discogs 401) sends the visitor back to Settings,
  as today.
- The Settings page, the token store and cookie, and `/api/test-token` stay as
  they are.

A stored copy is shared: once a public collection is stored, any visitor with
any valid token reads the same copy, so a friend opening the owner's collection
costs no Discogs calls.

**Alternative the owner may prefer (not built unless chosen):** let anyone open
a *stored* copy without a token, and require a token only for things that call
Discogs (loading a new username, refreshing, value estimates). Crawlers would
still cost nothing, and a friend sent a link would see the collection without
pasting anything, so fewer copies of the owner's token would be handed out. The
price: a visitor without a token cannot refresh, so they may see a copy older
than six hours, labelled with its age.

### The store

A small module replaces `src/lib/server/cache.ts`. It has two backends behind
one interface: Cloudflare KV when `platform.env.COLLECTION_CACHE` is bound, and
an in-memory map otherwise (local dev without the binding, adapter-node). The
in-memory backend loses data on restart; that is accepted.

If the code is running on Cloudflare and the binding is missing, it logs an
error once per isolate and falls back to memory. Store write failures are logged
and reported in the API response; they are never swallowed silently.

`wrangler.toml` declares the binding:

```toml
[[kv_namespaces]]
binding = "COLLECTION_CACHE"
id = "<namespace id from the owner's Cloudflare account>"
```

This needs the owner's Cloudflare login (see Rollout).

### Snapshots

A stored collection is a set of **snapshots**. A snapshot is one pass over a
user's collection: its pages are written once and never changed.

- Per user and kind (`collection` or `wantlist`) there is one small **meta**
  record: the profile, total record count, page count, the id of the current
  complete snapshot, the id of a snapshot in progress (if any), and when the
  current snapshot was completed.
- Each page of a snapshot is its own record holding that page's 100 items.
- Keys carry a format-version prefix (for example `v2:`), so a later format
  change is a prefix bump. Old `collection:{user}` entries are ignored and
  expire on their own.
- Page records get an expiry of a few days as garbage collection. Snapshots are
  disposable; losing one only means syncing again.

A snapshot becomes **current** when every one of its pages is present in the
store. Until then the previous current snapshot keeps being served.

Because KV is eventually consistent, a snapshot id must be something the server
can validate from the request alone, without reading the store (for example an
id derived from a time bucket, or a signed id). The exact scheme is the
builder's choice within that constraint. A browser must not be able to invent
arbitrary snapshot ids.

If Discogs' total count changes between pages of one snapshot (a record was
added mid-sync), the sync still finishes. Items are de-duplicated by
`instance_id` in the browser, and the next re-sync corrects it.

### Only public collections are stored

A visitor may enter their own token and open their own *private* collection.
That must never land in the shared store.

Before a new snapshot's pages are stored, the server confirms the list is
public with one request to Discogs that carries **no** token. If Discogs
serves it, the collection is public and the snapshot is stored. If not:

- nothing is stored, and any existing stored copy for that user and kind is
  removed;
- the visitor's own view still works: pages come straight from Discogs with
  their token, through the same endpoint and the same paced loader, on every
  visit.

Removal has to hold against guessing. Snapshot ids are predictable, so a stored
page is only served while its snapshot is still being filled or is the current
one for that user; anything else is refused even if the record still exists.

If the tokenless request is itself rate-limited, the endpoint answers "wait"
like any other rate limit and the browser tries again. Collection and wantlist
visibility are separate settings on Discogs, so each kind is checked on its
own. *The builder should confirm against the live API that a public collection
is readable with no token; if it is not, fall back to storing only when the
token's own username (from `/oauth/identity`) differs from the requested one.*

### The sync endpoint

`GET /api/collection/[username]?page=N&snapshot=ID` is the single way a
collection page is obtained.

- No token cookie: "token required", no Discogs call.
- If that page of that snapshot is in the store: return it. No Discogs call.
- If not: fetch the page from Discogs with the visitor's token, store it (if
  public), return it. Page 1 of a brand-new sync also does the visibility
  check, fetches the profile and writes the meta record.
- The response says where the data came from (`store` or `discogs`), the
  snapshot id, the page and total counts, and how long the browser should wait
  before its next call: zero for stored pages, at least 1.1 s after a Discogs
  call, longer when `X-Discogs-Ratelimit-Remaining` is low.
- If Discogs answers 429: the endpoint returns immediately with a "wait"
  result and a delay. It does not retry inside the request.
- Unknown user, private collection, bad token and upstream failure each get a
  distinct, typed result the page can show plainly.
- When the last page of an in-progress snapshot is stored, a separate, cheap
  completion step checks that all pages are present (a key listing, not reading
  the page bodies) and switches meta to the new snapshot. If pages are missing,
  it says which; the browser fetches them and asks again, a bounded number of
  times.
- Pages of a completed snapshot never change, so those responses may be cached
  by the browser for up to six hours. Pages of an in-progress snapshot must not
  be.

`DELETE /api/collection/[username]` is removed. It let any visitor force a full
re-fetch with no limit.

The multi-page server loops (`fetchUserCollection`, `fetchFullUserCollection`,
`fetchUserWantlist`) and their `setTimeout` pacing are deleted. Nothing on the
server loops over pages any more. `fetchDiscogs` loses its in-request 429 retry
and gains reading of the rate-limit headers.

### The profile page

`/u/[username]`'s `load` checks for the token cookie (redirecting to Settings
if absent), then reads meta and page 1 of the current (or in-progress) snapshot
from the store and returns them. It makes no Discogs call. If nothing is stored,
it returns an empty result and the page renders a loading shell
(`SkeletonProfile.svelte` already exists).

The progressive loader moves out of `+page.svelte` into its own module so it can
be unit-tested and reused by the wantlist and compare pages. It:

- loads pages of a completed snapshot with a little concurrency and no pacing;
- loads pages of an in-progress snapshot one at a time, waiting as the server
  instructs;
- on a "wait" result, shows it in the banner ("Discogs is busy, resuming in
  20 s, showing 400 of 1,500") and resumes by itself, backing off up to a
  minute, without giving up;
- shows plain states for unknown user and private collection;
- keeps today's batching of page appends (every few pages).

Link-preview text uses the stored total record count. It no longer quotes
artist count or top genre, which today are computed from whatever was loaded
(page 1 only on a cold load, so "100 records" for a 1,500-record collection).

### Keeping a copy fresh: refresh on visit

Decided by the owner.

- A stored copy opens immediately, whatever its age.
- If the current snapshot was completed more than **six hours** ago, the page
  (after rendering) starts a new snapshot and syncs it in the background at the
  server's pace, while the visitor keeps looking at the current one. When it
  completes, the fresh records are swapped in. The page shows how old the
  displayed copy is while this runs.
- The Refresh button starts the same re-sync on demand, at most once every 10
  minutes per username (enforced on the server from meta). Inside the cooldown
  it does nothing and says so.
- If the visitor leaves mid-sync, the in-progress snapshot stays. The next
  visitor's browser continues it if it is recent (about an hour), otherwise a
  new one starts.
- While Discogs is rate-limiting, the current copy stays on screen and the
  re-sync waits and resumes.
- Because no token is kept on the server, a copy only updates while a visitor
  with a token is on the page. A collection nobody opens stays as old as its
  last visit; the next visit shows that copy for the seconds the re-sync takes.

### Wantlist

The wantlist uses the same mechanism with kind `wantlist`: a stored snapshot, a
sync endpoint (`/api/wantlist/[username]`), the shared loader, the same
six-hour refresh and visibility check. The wantlist `load` reads the store only.

### Compare

`/compare/[user1]/[user2]`'s `load` reads the two meta records only. The page
runs the shared loader for one user and then the other (never both against
Discogs at once), then computes the comparison in the browser. The comparison
logic in today's loader (album keys, overlap, unique-to-each, genre and decade
breakdowns, similarity score) is pure and moves unchanged into a utility
function with unit tests. The page shows per-user progress until both are
loaded.

### Value estimate

- The 20 sampled releases are chosen deterministically from the collection
  (same collection, same 20), so every visitor's estimate hits the same stored
  prices.
- Stored prices keep for 6 hours (today: 1 hour), in line with the freshness
  term.
- The endpoint uses the visitor's cookie token only (today it also accepts an
  `x-discogs-token` header and the server token), stops at the first 429 and
  returns what it has with a delay, so the page shows a partial estimate rather
  than failures.
- The cap of 20 release ids per request stays.

### Value history

`/api/value-history/[username]` is left as it is, as a stated exception to rule
5. It stores a number the browser computed (the extrapolated estimate) and
shows the series to any visitor with a token, clamped and limited to one entry
per day as today. Its gate becomes "a token cookie is present" (today: cookie
or server token).

This is the one dataset in the store that cannot be rebuilt from Discogs, so it
needs the real KV binding to persist; on the in-memory backend it is lost on
restart. Having the server record the snapshot itself would also need the
server to choose the price sample, which is out of scope here and noted for
project 3.

### Widget

Decided by the owner: `/api/widget` makes no Discogs calls and needs no token.
It reads the record count and the three most recent titles from the stored copy
of the configured username (`WIDGET_USERNAME`), so it is as fresh as the last
visit that re-synced that collection.

- A poll must be cheap: one small store read and no store writes (at one poll
  every five minutes, a write per poll would use over a quarter of the
  free-plan daily write allowance). The meta record should therefore carry
  what the widget needs.
- If there is no stored copy (never loaded, or the collection is private), it
  returns its existing fallback shape with a "not loaded yet" status.
- The hardcoded `https://records.home` link becomes the request's own origin.

With this, `env.DISCOGS_TOKEN` is unused. Remove it from `.env.example`, and
remove the startup warning about it from `hooks.server.ts`.

### Visibility

- `GET /api/status` returns which store backend is active (`kv` or `memory`),
  the app version, and the last rate-limit reading this isolate saw. No
  secrets.
- Every sync response carries its source (`store` or `discogs`), so "a reload
  made zero Discogs calls" can be checked in the browser's network tab and
  asserted in tests.

### Crawlers

`robots.txt` disallows `/api/`, `/compare/` and `/u/`. Without a token every
one of those redirects to Settings or returns "token required", so there is
nothing for a crawler to index and nothing it can spend.

## What a visit costs afterwards

| Situation | Discogs calls |
|---|---|
| Any request with no token | 0 |
| View a stored collection less than 6 hours old | 0 |
| View a stored collection more than 6 hours old | 0 to show it, then `P + 2` in the background, about one per second |
| First-ever view of a username | `P + 2`, about one per second |
| Refresh button (at most every 10 minutes per username) | `P + 2`, about one per second |
| Stored wantlist / compare of two fresh stored collections | 0 |
| Value estimate, prices stored in the last 6 hours | 0 |
| Value estimate otherwise | up to 20 |
| Widget | 0 |

## Testing

- **Unit:** the store (both backends), the sync endpoint (no token, stored
  page, Discogs page, 429 → wait, completion with and without missing pages,
  snapshot id validation, typed errors, public vs private), the six-hour
  re-sync trigger and Refresh cooldown, the Discogs client (header reading, no
  in-request retry), the browser loader as a state machine with fake fetch and
  timers, the comparison utility, the value and widget changes. Every route's
  test asserts that a request with no token cookie makes no Discogs call even
  when `DISCOGS_TOKEN` is set in the environment.
- **End to end:** because the page now gets its records through `/api/*` from
  the browser, Playwright can stub those routes. Add a profile-render test from
  stubbed pages (with a token cookie set) and a test that a "wait" result shows
  the banner and then recovers. The existing redirect-to-Settings tests stay,
  and gain a case where the server token is set but the visitor has none.
- **On the live site after deploy:** `/api/status` reports `kv`; the first load
  of the owner's collection shows `discogs` sources; a reload shows only
  `store`; a private-window visit to `/` lands on Settings.

## Rollout

Needs the owner's Cloudflare login:

1. `npx wrangler login`.
2. In a scratch folder, `npx wrangler pages download config record-shelf` to see
   the live project settings, since the checked-in `wrangler.toml` overrides
   them. If `DISCOGS_TOKEN` is set on the project, delete it (dashboard:
   Workers & Pages → record-shelf → Settings → Variables and Secrets).
3. Find or create the KV namespace (`npx wrangler kv namespace list` /
   `create COLLECTION_CACHE`) and put its id in `wrangler.toml`.
4. Deploy as usual (`npm run build`, then
   `npx wrangler pages deploy .svelte-kit/cloudflare`), bumping the version.
5. Open `/api/status`, then open the owner's profile once to build its copy.

## Build order

Each step leaves the app working.

1. Store module, Discogs client changes, status endpoint, `wrangler.toml`
   binding, `robots.txt`; remove the server-token fallback from every route.
2. Collection sync endpoint with the public-only check, shared browser loader,
   profile page reading from the store, banner states.
3. Six-hour background re-sync, Refresh with cooldown; remove `DELETE`.
4. Wantlist on the same mechanism.
5. Compare on the same mechanism; comparison logic into a utility.
6. Value estimate changes; widget reading from the stored copy; remove the last
   reads of `env.DISCOGS_TOKEN`.

## Left to the builder

- The exact key names, snapshot id scheme, and the wire shape of the API
  responses, within the rules above.
- Whether starting a re-sync and completing a snapshot are separate routes or
  actions on the sync route.
- Concurrency for stored pages, backoff curve, and whether to pause syncing
  while the tab is hidden.
- The exact wording of banner and error states.
- File and module layout, following the existing conventions (`$lib/server/*`
  for server code, `server.test.ts` beside routes).

## Left for project 2

Rendering the profile from a small stored summary before the records arrive
(stat tiles, chart data, link-preview details). It needs
`computeCollectionStats` reshaped so per-page results can be merged on the
server without loading every record in one request (free-plan CPU limit). Until
then, numbers on a stored collection fill in over the second or two it takes to
read the stored pages, which is the same behaviour as today but much faster.

## Decisions and who made them

**The owner:**
- Runs on Cloudflare Pages.
- Everyone enters a token; friends are given the owner's. No personal-token
  removal.
- Rate limits must not break the site for people being shown it.
- Approach A.
- Freshness: refresh on visit at six hours.
- No Discogs token is kept on the server. The server-token setting is removed
  and the widget reads from the stored copy.

**My calls (correct any of these):**
- Only collections confirmed public are stored; a private collection is served
  to its owner uncached and never stored.
- Design to free-plan limits.
- Refresh button limited to once per 10 minutes per username.
- Wantlist and compare are in scope, because they are the other two paths that
  call Discogs.
- The first-ever view of a username renders a loading shell rather than
  fetching on the server, so that no page render calls Discogs.
- Link previews show the record count only until project 2.
- The value estimate keeps its 20-per-click loop, made stable and
  429-tolerant, rather than being rebuilt. Prices keep for 6 hours.
- Value history is left unchanged as a stated exception.
- `robots.txt` blocks `/u/` as well, since those pages now only redirect
  without a token.
- In-memory store for adapter-node and local dev.
- Design doc is left uncommitted until the owner asks for a commit.
