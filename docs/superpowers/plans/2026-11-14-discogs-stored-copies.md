# Stored Copies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve every collection, wantlist and comparison from a stored copy in Cloudflare KV, so Discogs is only called (slowly, through one path, with the visitor's own token) to build a copy or re-sync one that is more than six hours old.

**Architecture:** Server `load` functions read the store and never call Discogs. One sync API per list kind hands out pages: from the store if present, otherwise one Discogs call that is then stored. The browser drives a sync page by page through a framework-free engine that obeys the server's "wait this long" answers. A snapshot (one pass over a list) becomes current when all its pages are stored.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), TypeScript, Cloudflare Pages + KV, adapter-node as second target, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-discogs-stored-copies-design.md`. Read it before starting any task.

## Global Constraints

- Work on a branch (`stored-copies`), never on `master`. Leave the pre-existing uncommitted `package-lock.json` change alone.
- A `load` function never calls Discogs. Only `/api/*` handlers do.
- Discogs is only ever called with the token from the `discogs_token` cookie. Nothing reads `env.DISCOGS_TOKEN`. The one tokenless call is the visibility check in Task 3.
- No token is written to the store, logged, or put in a response.
- An API request makes at most 3 Discogs calls when starting a sync and at most 1 otherwise (value estimate: at most 20).
- No handler sleeps-and-retries on a 429. It returns a `wait` result.
- Only the server writes the store, only with data it fetched from Discogs, and only for lists confirmed public. Value history is the stated exception.
- Fit the Cloudflare free plan: 10 ms CPU per request, 1,000 KV writes per day. Never parse more than one page of records in a request. The widget writes nothing.
- KV is eventually consistent: no request may require reading back what an earlier request wrote. Where a read-back is used (the page-1 marker), a miss must be safe.
- Exact values: fresh window `6 h`; Refresh cooldown `10 min` per username; snapshot bucket `10 min`; unfinished snapshot fillable for `60 min`; store expiry for meta and pages `7 days`; price expiry `6 h`; pace `1100 ms`, `5000 ms` when `remaining <= 10`, `15000 ms` when `remaining <= 3`; default wait `30 s`; maximum wait `60 s`.
- Both builds must pass: `npm run build` and `ADAPTER=node npm run build`. `npm run check` and `npx vitest run --coverage` must pass after every task.
- Follow existing conventions: tabs, `$lib/server/*` for server-only code, `*.test.ts` beside the file, `server.test.ts` beside routes.

## Review Focus

1. **A collection shrinks mid-sync.** Discogs answers 404 for a page number that no longer exists. Expected: an empty page, not "user not found". Pinned in Task 3.
2. **An empty collection or wantlist** (0 records). Expected: the sync completes and the page shows a zero state, not an endless loader. Pinned in Tasks 3 and 5.
3. **Two tabs or two visitors sync the same list at once.** Expected: the second joins the first's snapshot from the store instead of starting its own. Pinned in Task 3.
4. **A store write fails** (KV daily write allowance used up). Expected: the visitor still gets the page, the response says `stored: false`, and the browser does not ask to complete a snapshot that cannot be complete. Pinned in Tasks 3 and 5.
5. **The visitor's clock is wrong.** The browser thinks a copy is stale when the server knows it is fresh. Expected: the server's `fresh` answer wins and nothing is re-fetched. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/sync/types.ts` (new) | Shared constants and wire types for server and browser |
| `src/lib/server/store.ts` (new) | KV-or-memory JSON store behind one interface |
| `src/lib/api/discogs.ts` (modify) | Add single-call client that reads rate headers; later drop the looping fetchers |
| `src/lib/server/sync.ts` (new) | `startSync`, `getPage`, `completeSync`, `readStored`, key and snapshot-id helpers |
| `src/lib/server/syncRoute.ts` (new) | `makeSyncHandlers(kind)`: thin HTTP wrapper shared by both sync routes |
| `src/lib/sync/engine.ts` (new) | Browser sync state machine, no Svelte imports |
| `src/lib/sync/loader.svelte.ts` (new) | Runes wrapper exposing engine state reactively |
| `src/lib/utils/compare.ts` (new) | `compareCollections`, moved from the compare loader |
| `src/routes/api/status/+server.ts` (new) | Store backend, version, last rate reading |
| `src/routes/api/wantlist/[username=username]/+server.ts` (new) | Wantlist sync route |
| `src/routes/api/collection/[username=username]/+server.ts` (rewrite) | Collection sync route; `DELETE` gone |
| `src/routes/u/[username=username]/+page.server.ts`, `+page.svelte` (rewrite/modify) | Store-only load; page driven by the loader |
| `src/routes/u/[username=username]/wantlist/*` (modify) | Same for wantlist |
| `src/routes/compare/[user1=username]/[user2=username]/*` (modify) | Store-only load; comparison computed in the browser |
| `src/routes/api/value/*`, `value-history/*`, `widget/*` (modify) | Cookie-only token, 6 h prices, 429 stop; widget from store |
| `src/lib/components/profile/LoadingBanner.svelte` (rewrite) | All sync states |
| `src/lib/components/ValueEstimate.svelte`, `src/lib/utils/array.ts` (modify) | Deterministic sample, partial estimate |
| `src/lib/server/cache.ts`, `cache.test.ts` (delete) | Replaced by `store.ts` |
| `e2e/profile.test.ts` (new) | Stubbed-API profile render and wait/recover |

---

### Task 1: Store module

**Files:**
- Create: `src/lib/server/store.ts`
- Test: `src/lib/server/store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Store {
  	readonly backend: 'kv' | 'memory';
  	getJSON<T>(key: string): Promise<T | null>;
  	/** Resolves false (after console.error) when the write fails. */
  	putJSON(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
  	listKeys(prefix: string): Promise<string[]>;
  	delete(key: string): Promise<void>;
  }
  export function getStore(platform: App.Platform | undefined): Store;
  export function resetMemoryStoreForTests(): void;
  export const MEMORY_MAX_ENTRIES = 5000;
  ```

- [ ] **Step 1: Write the failing tests** in `src/lib/server/store.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStore, resetMemoryStoreForTests } from './store';

function fakeKV(overrides: Record<string, unknown> = {}) {
	return {
		get: vi.fn(async () => null),
		put: vi.fn(async () => undefined),
		delete: vi.fn(async () => undefined),
		list: vi.fn(async () => ({ keys: [], list_complete: true })),
		...overrides
	};
}
const cf = (kv?: unknown) => ({ env: kv ? { COLLECTION_CACHE: kv } : {} }) as any;

beforeEach(() => {
	resetMemoryStoreForTests();
	vi.restoreAllMocks();
});

describe('getStore', () => {
	it('uses KV when COLLECTION_CACHE is bound', () => {
		expect(getStore(cf(fakeKV())).backend).toBe('kv');
	});
	it('uses memory with no platform (adapter-node, tests)', () => {
		expect(getStore(undefined).backend).toBe('memory');
	});
	it('on Cloudflare without the binding: memory, and logs an error once per isolate', () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(getStore(cf()).backend).toBe('memory');
		getStore(cf());
		expect(err).toHaveBeenCalledTimes(1);
		expect(err.mock.calls[0][0]).toContain('COLLECTION_CACHE');
	});
});

describe('kv backend', () => {
	it('putJSON stringifies with expirationTtl and resolves true', async () => {
		const kv = fakeKV();
		expect(await getStore(cf(kv)).putJSON('k', { a: 1 }, 60)).toBe(true);
		expect(kv.put).toHaveBeenCalledWith('k', '{"a":1}', { expirationTtl: 60 });
	});
	it('putJSON resolves false and logs when KV throws', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = fakeKV({ put: vi.fn(async () => { throw new Error('quota'); }) });
		expect(await getStore(cf(kv)).putJSON('k', 1, 60)).toBe(false);
		expect(err).toHaveBeenCalled();
	});
	it('getJSON resolves null when KV throws', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = fakeKV({ get: vi.fn(async () => { throw new Error('x'); }) });
		expect(await getStore(cf(kv)).getJSON('k')).toBeNull();
	});
	it('listKeys follows the cursor until list_complete', async () => {
		const list = vi.fn()
			.mockResolvedValueOnce({ keys: [{ name: 'p:1' }], list_complete: false, cursor: 'c1' })
			.mockResolvedValueOnce({ keys: [{ name: 'p:2' }], list_complete: true });
		expect(await getStore(cf(fakeKV({ list }))).listKeys('p:')).toEqual(['p:1', 'p:2']);
		expect(list).toHaveBeenLastCalledWith({ prefix: 'p:', cursor: 'c1' });
	});
});

describe('memory backend', () => {
	it('round-trips JSON, lists by prefix and deletes', async () => {
		const s = getStore(undefined);
		await s.putJSON('a:1', { n: 1 }, 60);
		await s.putJSON('a:2', { n: 2 }, 60);
		await s.putJSON('b:1', { n: 3 }, 60);
		expect(await s.getJSON('a:1')).toEqual({ n: 1 });
		expect((await s.listKeys('a:')).sort()).toEqual(['a:1', 'a:2']);
		await s.delete('a:1');
		expect(await s.getJSON('a:1')).toBeNull();
	});
	it('expires entries after ttlSeconds', async () => {
		vi.useFakeTimers();
		const s = getStore(undefined);
		await s.putJSON('k', 1, 60);
		vi.advanceTimersByTime(61_000);
		expect(await s.getJSON('k')).toBeNull();
		expect(await s.listKeys('k')).toEqual([]);
		vi.useRealTimers();
	});
	it('is shared between getStore calls', async () => {
		await getStore(undefined).putJSON('k', 1, 60);
		expect(await getStore(undefined).getJSON('k')).toBe(1);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/server/store.test.ts`
Expected: FAIL, cannot resolve `./store`.

- [ ] **Step 3: Implement `src/lib/server/store.ts`** to the interface above.

Declare a local `KVLike` interface (`get(key, 'json')`, `put(key, value, { expirationTtl })`, `delete(key)`, `list({ prefix, cursor? })`) rather than importing Cloudflare types. "On Cloudflare" means `platform?.env !== undefined`. The memory backend is one module-level `Map` holding JSON strings with an expiry time; when it reaches `MEMORY_MAX_ENTRIES` it evicts the oldest insertion. The error message for the missing binding: `[record-shelf] COLLECTION_CACHE KV binding is missing — using a per-isolate memory store. Add the binding in wrangler.toml.`

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/server/store.test.ts && npm run check`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/store.ts src/lib/server/store.test.ts
git commit -m "feat: add KV-or-memory store module"
```

---

### Task 2: Single-call Discogs client

**Files:**
- Create: `src/lib/sync/types.ts`
- Modify: `src/lib/api/discogs.ts` (additive; the existing `fetchDiscogs` and looping fetchers stay until Task 10)
- Test: `src/lib/api/discogs.test.ts` (append a `describe('discogsGet')` block)

**Interfaces:**
- Produces, in `src/lib/sync/types.ts`:
  ```ts
  import type { DiscogsUserProfile } from '$lib/types/discogs';

  export type SyncKind = 'collection' | 'wantlist';

  export const FRESH_MS = 6 * 60 * 60 * 1000;
  export const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
  export const SNAPSHOT_BUCKET_MS = 10 * 60 * 1000;
  export const SNAPSHOT_OPEN_MS = 60 * 60 * 1000;
  export const SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60;
  export const PRICE_TTL_SECONDS = 6 * 60 * 60;
  export const PAGE_SIZE = 100;
  export const PACE_MS = 1100;
  export const PACE_LOW_MS = 5000;
  export const PACE_CRITICAL_MS = 15000;
  export const DEFAULT_RETRY_AFTER_MS = 30_000;
  export const MAX_WAIT_MS = 60_000;

  export type SyncErrorCode =
  	| 'TOKEN_REQUIRED' | 'BAD_TOKEN' | 'NOT_FOUND' | 'PRIVATE'
  	| 'SNAPSHOT_EXPIRED' | 'BAD_REQUEST' | 'UPSTREAM';

  export interface SnapshotRef {
  	id: string; totalItems: number; totalPages: number;
  	startedAt: number; completedAt: number | null;
  }
  /** The only profile fields ever stored or sent to the browser (amended in Task 3). */
  export interface PublicProfile { username: string; avatar_url: string; location: string }
  export interface SnapshotMeta {
  	profile: PublicProfile;
  	current: SnapshotRef | null;
  	pending: SnapshotRef | null;
  	recent: Array<{ artist: string; title: string }>;
  }
  export interface PageRecord<T = unknown> {
  	items: T[]; page: number; totalPages: number; totalItems: number;
  	/** Present on page 1 only. */
  	profile?: PublicProfile; startedAt?: number;
  }

  export interface SyncOk<T> {
  	status: 'ok'; snapshot: string; page: number; totalPages: number; totalItems: number;
  	items: T[]; source: 'store' | 'discogs'; stored: boolean; nextDelayMs: number;
  	profile?: PublicProfile;
  }
  export interface SyncWait { status: 'wait'; retryAfterMs: number }
  export interface SyncError { status: 'error'; code: SyncErrorCode; message: string }
  export type SyncPageResult<T> = SyncOk<T> | SyncWait | SyncError;
  export type SyncStartResult<T> =
  	| SyncOk<T> | { status: 'fresh'; snapshot: string }
  	| { status: 'cooldown'; retryAfterMs: number } | SyncWait | SyncError;
  export type SyncCompleteResult =
  	| { status: 'complete'; snapshot: string; completedAt: number }
  	| { status: 'incomplete'; missing: number[] } | SyncError;

  export interface StoredInitial<T> {
  	profile: PublicProfile; snapshot: string; complete: boolean;
  	completedAt: number | null; totalItems: number; totalPages: number; firstPage: T[];
  }
  ```
- Produces, in `src/lib/api/discogs.ts`:
  ```ts
  export interface DiscogsResult<T> { data: T; remaining: number | null }
  export interface ListPage { items: unknown[]; pagination: DiscogsPagination }
  export function discogsGet<T>(endpoint: string, options: { userAgent: string; token?: string }): Promise<DiscogsResult<T>>;
  export function fetchProfile(username: string, options: { userAgent: string; token?: string }): Promise<DiscogsResult<DiscogsUserProfile>>;
  export function fetchListPage(kind: SyncKind, username: string, page: number, perPage: number, options: { userAgent: string; token?: string }): Promise<DiscogsResult<ListPage>>;
  export function lastRateReading(): { remaining: number | null; at: number | null; last429At: number | null };
  // DiscogsAPIError gains a 4th constructor parameter and field: retryAfterMs?: number
  ```

- [ ] **Step 1: Write the failing tests** (append to `src/lib/api/discogs.test.ts`, reusing its existing `fetch` stubbing style)

```ts
describe('discogsGet', () => {
	const opts = { userAgent: 'T/1', token: 'tok' };
	const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
		new Response(JSON.stringify(body), { status, headers });

	it('returns data and the remaining budget from X-Discogs-Ratelimit-Remaining', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => res(200, { a: 1 }, { 'X-Discogs-Ratelimit-Remaining': '42' })));
		expect(await discogsGet('/x', opts)).toEqual({ data: { a: 1 }, remaining: 42 });
		expect(lastRateReading().remaining).toBe(42);
	});
	it('reports remaining as null when the header is absent', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => res(200, {})));
		expect((await discogsGet('/x', opts)).remaining).toBeNull();
	});
	it('on 429 throws RATE_LIMITED at once, without a second fetch', async () => {
		const f = vi.fn(async () => res(429, {}, { 'Retry-After': '7' }));
		vi.stubGlobal('fetch', f);
		await expect(discogsGet('/x', opts)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterMs: 7000 });
		expect(f).toHaveBeenCalledTimes(1);
		expect(lastRateReading().last429At).not.toBeNull();
	});
	it('uses 30000 ms when Retry-After is missing or not a number', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => res(429, {}, { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' })));
		await expect(discogsGet('/x', opts)).rejects.toMatchObject({ retryAfterMs: 30000 });
	});
	it('sends no Authorization header when no token is given', async () => {
		const f = vi.fn(async () => res(200, {}));
		vi.stubGlobal('fetch', f);
		await discogsGet('/x', { userAgent: 'T/1' });
		expect((f.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Authorization');
	});
	it('maps 401, 403, 404 and other statuses like fetchDiscogs', async () => {
		for (const [status, code] of [[401, 'BAD_TOKEN'], [403, 'PRIVATE'], [404, 'NOT_FOUND'], [500, 'UPSTREAM_ERROR']] as const) {
			vi.stubGlobal('fetch', vi.fn(async () => res(status, {})));
			await expect(discogsGet('/x', opts)).rejects.toMatchObject({ code });
		}
	});
});

describe('fetchListPage', () => {
	it('requests the collection endpoint and returns releases as items', async () => {
		const f = vi.fn(async () => new Response(JSON.stringify({ pagination: { page: 2, pages: 3, per_page: 100, items: 250, urls: {} }, releases: [{ id: 1 }] })));
		vi.stubGlobal('fetch', f);
		const r = await fetchListPage('collection', 'Some User', 2, 100, { userAgent: 'T/1', token: 't' });
		expect(f.mock.calls[0][0]).toBe('https://api.discogs.com/users/Some%20User/collection/folders/0/releases?page=2&per_page=100&sort=added&sort_order=desc');
		expect(r.data.items).toEqual([{ id: 1 }]);
		expect(r.data.pagination.pages).toBe(3);
	});
	it('requests the wants endpoint and returns wants as items', async () => {
		const f = vi.fn(async () => new Response(JSON.stringify({ pagination: { page: 1, pages: 1, per_page: 1, items: 1, urls: {} }, wants: [{ id: 9 }] })));
		vi.stubGlobal('fetch', f);
		const r = await fetchListPage('wantlist', 'u', 1, 1, { userAgent: 'T/1' });
		expect(f.mock.calls[0][0]).toBe('https://api.discogs.com/users/u/wants?page=1&per_page=1&sort=added&sort_order=desc');
		expect(r.data.items).toEqual([{ id: 9 }]);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/api/discogs.test.ts`
Expected: FAIL, `discogsGet` is not exported.

- [ ] **Step 3: Create `src/lib/sync/types.ts`** exactly as in the Interfaces block.

- [ ] **Step 4: Implement the additions in `src/lib/api/discogs.ts`**

`discogsGet` makes exactly one `fetch`. Status mapping is the same as the existing `fetchDiscogs` except that a 429 throws immediately with `retryAfterMs` (numeric `Retry-After` seconds × 1000, else `DEFAULT_RETRY_AFTER_MS`). `lastRateReading` returns module-level values updated by every `discogsGet` call. `fetchProfile` calls `/users/{username}`.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/api/discogs.test.ts && npm run check`
Expected: PASS (existing tests in the file still pass).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/types.ts src/lib/api/discogs.ts src/lib/api/discogs.test.ts
git commit -m "feat: add single-call Discogs client that reads rate-limit headers"
```

---

### Task 3: Server sync core

**Files:**
- Create: `src/lib/server/sync.ts`
- Test: `src/lib/server/sync.test.ts`

**Interfaces:**
- Consumes: `Store`, `getStore`, `resetMemoryStoreForTests` (Task 1); `fetchProfile`, `fetchListPage`, `DiscogsResult`, `ListPage`, `DiscogsAPIError` and everything in `src/lib/sync/types.ts` (Task 2); `cleanArtistName` from `$lib/utils/discogs`; `USER_AGENT` from `$lib/constants`.
- Produces:
  ```ts
  export interface DiscogsPort {
  	profile(username: string, token: string): Promise<DiscogsResult<DiscogsUserProfile>>;
  	listPage(kind: SyncKind, username: string, page: number, perPage: number, token: string | undefined): Promise<DiscogsResult<ListPage>>;
  }
  export interface SyncDeps { store: Store; discogs: DiscogsPort; now: () => number }
  export const discogsPort: DiscogsPort; // real one: fetchProfile / fetchListPage with USER_AGENT

  export function metaKey(kind: SyncKind, username: string): string;   // `v2:${kind}:${lowercased}:meta`
  export function pageKey(kind: SyncKind, username: string, snapshot: string, page: number): string; // `v2:${kind}:${lowercased}:s:${snapshot}:p:${page}`
  export function snapshotIdAt(ms: number): string;                    // String(Math.floor(ms / SNAPSHOT_BUCKET_MS))
  export function isSnapshotOpen(snapshot: string, now: number): boolean;
  export function paceFor(remaining: number | null): number;

  export function startSync(kind: SyncKind, username: string, token: string, force: boolean, deps: SyncDeps): Promise<SyncStartResult<unknown>>;
  export function getPage(kind: SyncKind, username: string, token: string, snapshot: string, page: number, deps: SyncDeps): Promise<SyncPageResult<unknown>>;
  export function completeSync(kind: SyncKind, username: string, snapshot: string, deps: SyncDeps): Promise<SyncCompleteResult>;
  export function readStored(kind: SyncKind, username: string, store: Store, now: number): Promise<StoredInitial<unknown> | null>;
  ```

> **Amended during execution** (rulings in the SDD ledger, fix round 1). The
> behaviour list below is the amended version and is authoritative. The test
> listing in Step 1 predates the amendments; the committed
> `src/lib/server/sync.test.ts` is the authoritative test file.
>
> - Everything received from Discogs is reduced to an allowlist before it is
>   stored or returned: profile → `PublicProfile { username, avatar_url, location }`;
>   collection item → `id, instance_id, rating, date_added, basic_information`;
>   wantlist item → `id, rating, date_added, basic_information`.
> - `startSync` makes no presence check on the current snapshot's pages.
> - `getPage` uses meta, not the page-1 record, as the "public" marker and the
>   source of totals, so it never parses two pages.
> - A 404 beyond the snapshot's `totalPages` is `BAD_REQUEST`, not a stored page.
> - `completeSync` requires an open snapshot unless it is already current.
> - `readStored` falls back to the open pending snapshot when the current
>   snapshot's page 1 cannot be read.

**Behaviour the tests pin (write the code to these, in this order):**

`isSnapshotOpen(s, now)`: `s` matches `/^\d{1,12}$/`, and with `start = Number(s) * SNAPSHOT_BUCKET_MS`: `start <= now && now < start + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS`.

`paceFor`: `null` or `> 10` → `PACE_MS`; `<= 10` → `PACE_LOW_MS`; `<= 3` → `PACE_CRITICAL_MS`.

`startSync`:
1. Read meta. No presence check is made on the current snapshot's pages: meta and pages share one expiry, so a current young enough to hit the shortcuts below still has its pages.
2. Not forced, `meta.current` set, `now - completedAt < FRESH_MS` → `{ status: 'fresh', snapshot }`.
3. Forced, `meta.current` set, `now - completedAt < REFRESH_COOLDOWN_MS` → `{ status: 'cooldown', retryAfterMs: <time left> }`.
4. Snapshot id = `meta.pending.id` if that is open and differs from `current.id`, else `snapshotIdAt(now)`. If it equals `current.id` → `fresh`.
5. If page 1 of that snapshot is already stored → return it (`source: 'store'`, `stored: true`, `nextDelayMs: 0`, with `profile`). No Discogs call.
6. Visibility check: `discogs.listPage(kind, username, 1, 1, undefined)`. Success → public. `PRIVATE` or `BAD_TOKEN` → not public. `RATE_LIMITED` → `wait`. `NOT_FOUND` → error `NOT_FOUND`. Anything else → error `UPSTREAM`.
7. `discogs.listPage(kind, username, 1, PAGE_SIZE, token)`, then `discogs.profile(username, token)`. `RATE_LIMITED` → `wait` with the error's `retryAfterMs`; `BAD_TOKEN`, `NOT_FOUND`, `PRIVATE` → error with that code; anything else → `UPSTREAM`.
8. `totalPages = Math.max(1, pagination.pages)`.
9. Public: put the page-1 record (with `profile` and `startedAt: now`) and meta (`current` unchanged, `pending` = this snapshot, `recent` unchanged or `[]`), both with `SNAPSHOT_TTL_SECONDS`; `stored` is true only if both puts succeeded. Not public: delete every stored page of `meta.current` and `meta.pending` (find them with `listKeys` on each snapshot's page prefix), then `store.delete(metaKey)`; `stored: false`.
10. Return `ok` with `source: 'discogs'` and `nextDelayMs: paceFor(<lowest remaining seen>)`.

`getPage`:
1. `page` must be an integer `>= 1` and `snapshot` must match `/^\d{1,12}$/`, else error `BAD_REQUEST`.
2. A stored page is served (`ok` from store, `nextDelayMs: 0`) only if its snapshot is open, or is `meta.current` (read meta only when the snapshot is not open). A stored page of any other snapshot → error `SNAPSHOT_EXPIRED`. This is what makes an old copy unreachable once a list turns private or is superseded; snapshot ids are guessable, so the store alone must not be the gate.
3. Not stored and snapshot not open → error `SNAPSHOT_EXPIRED`.
4. Meta is the "public" marker and the source of totals. `ref` is `meta.pending` if its id is this snapshot, else `meta.current` if its id is this snapshot, else none. The page-1 record is never read here.
5. Fetch from Discogs with the token. `NOT_FOUND` on `page > 1` is an empty page (`items: []`, totals from `ref`) only when `ref` exists and `page <= ref.totalPages`; otherwise it is `BAD_REQUEST` and nothing is stored. Other errors map as in `startSync` step 7.
6. Store the page only if `ref` exists. `stored` reports whether it was stored. A missing or stale meta is safe: the page is returned unstored.

`completeSync`:
1. Bad snapshot format → `BAD_REQUEST`. If the snapshot is already `meta.current` → `complete` with the stored `completedAt`. Otherwise the snapshot must be open, else `SNAPSHOT_EXPIRED`. Page 1 missing → `{ status: 'incomplete', missing: [1] }`.
2. `listKeys` on the snapshot's page prefix; any page `1..totalPages` absent → `incomplete` with those numbers, ascending.
3. If `meta.current.id` is already this snapshot → `complete` with the stored `completedAt`.
4. Write meta: `profile` from page 1; `current = { id, totalItems, totalPages, startedAt, completedAt: now }`; `pending: null`; `recent` = for `collection`, the first 3 page-1 items as `{ artist: cleanArtistName(first artist name) || 'Unknown', title }`, for `wantlist` `[]`. Failed put → error `UPSTREAM`.

`readStored`: use `meta.current` if its page 1 can be read; otherwise `meta.pending` if it is open and its page 1 can be read; otherwise `null`. `complete` is true only for `current`.

- [ ] **Step 1: Write the failing tests** in `src/lib/server/sync.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStore, resetMemoryStoreForTests } from './store';
import { DiscogsAPIError } from '$lib/api/discogs';
import {
	startSync, getPage, completeSync, readStored,
	metaKey, pageKey, snapshotIdAt, isSnapshotOpen, paceFor
} from './sync';
import { FRESH_MS, REFRESH_COOLDOWN_MS, SNAPSHOT_BUCKET_MS, SNAPSHOT_OPEN_MS } from '$lib/sync/types';

const T0 = 1_800_000_000_000; // snapshot id "3000000"
const SNAP = '3000000';
const profile = { username: 'TestUser', avatar_url: 'a.png' } as any;
const item = (n: number) => ({ instance_id: n, basic_information: { id: n, title: `T${n}`, artists: [{ name: 'Art (2)' }] } });
const pageOf = (page: number, pages: number, total: number, count = 100) => ({
	data: { items: Array.from({ length: count }, (_, i) => item((page - 1) * 100 + i + 1)), pagination: { page, pages, per_page: 100, items: total, urls: {} } },
	remaining: 50
});
const rateLimited = () => new DiscogsAPIError('rl', 429, 'RATE_LIMITED', 12_000);

let now = T0;
function makeDeps() {
	const discogs = { profile: vi.fn(async () => ({ data: profile, remaining: 50 })), listPage: vi.fn() };
	return { store: getStore(undefined), discogs, now: () => now };
}
/** listPage: tokenless probe succeeds, then each authed page comes from `pages`. */
function publicList(deps: ReturnType<typeof makeDeps>, pages = 3, total = 250) {
	deps.discogs.listPage.mockImplementation(async (_k, _u, page, perPage, token) =>
		token === undefined ? pageOf(1, total, total, 1) : pageOf(page, pages, total, page === pages ? total - (pages - 1) * 100 : perPage));
}

beforeEach(() => { resetMemoryStoreForTests(); now = T0; });

describe('helpers', () => {
	it('lowercases the username in keys', () => {
		expect(metaKey('collection', 'TestUser')).toBe('v2:collection:testuser:meta');
		expect(pageKey('wantlist', 'TestUser', SNAP, 2)).toBe('v2:wantlist:testuser:s:3000000:p:2');
	});
	it('derives the snapshot id from a 10-minute bucket', () => {
		expect(snapshotIdAt(T0)).toBe(SNAP);
		expect(snapshotIdAt(T0 + SNAPSHOT_BUCKET_MS - 1)).toBe(SNAP);
		expect(snapshotIdAt(T0 + SNAPSHOT_BUCKET_MS)).toBe('3000001');
	});
	it('a snapshot is open for its bucket plus 60 minutes, never in the future, never malformed', () => {
		expect(isSnapshotOpen(SNAP, T0)).toBe(true);
		expect(isSnapshotOpen(SNAP, T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS - 1)).toBe(true);
		expect(isSnapshotOpen(SNAP, T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS)).toBe(false);
		expect(isSnapshotOpen('3000001', T0)).toBe(false);
		expect(isSnapshotOpen('abc', T0)).toBe(false);
	});
	it('paces 1100 / 5000 / 15000 ms by remaining budget', () => {
		expect([paceFor(null), paceFor(11), paceFor(10), paceFor(4), paceFor(3), paceFor(0)])
			.toEqual([1100, 1100, 5000, 5000, 15000, 15000]);
	});
});

describe('startSync', () => {
	it('new public list: probes without a token, fetches page 1 and profile, stores both', async () => {
		const deps = makeDeps(); publicList(deps);
		const r = await startSync('collection', 'TestUser', 'tok', false, deps);
		expect(r).toMatchObject({ status: 'ok', snapshot: SNAP, page: 1, totalPages: 3, totalItems: 250, source: 'discogs', stored: true, nextDelayMs: 1100, profile });
		expect(deps.discogs.listPage.mock.calls[0]).toEqual(['collection', 'TestUser', 1, 1, undefined]);
		expect(deps.discogs.listPage.mock.calls[1]).toEqual(['collection', 'TestUser', 1, 100, 'tok']);
		expect(deps.discogs.listPage).toHaveBeenCalledTimes(2);
		expect(deps.discogs.profile).toHaveBeenCalledTimes(1);
		const meta: any = await deps.store.getJSON(metaKey('collection', 'TestUser'));
		expect(meta.pending).toMatchObject({ id: SNAP, totalItems: 250, totalPages: 3, startedAt: T0, completedAt: null });
		expect(meta.current).toBeNull();
		expect(await deps.store.getJSON(pageKey('collection', 'TestUser', SNAP, 1))).toMatchObject({ page: 1, profile, startedAt: T0 });
	});
	it('never writes the token to the store', async () => {
		const deps = makeDeps(); publicList(deps);
		const put = vi.spyOn(deps.store, 'putJSON');
		await startSync('collection', 'TestUser', 'SECRET-TOKEN', false, deps);
		expect(JSON.stringify(put.mock.calls)).not.toContain('SECRET-TOKEN');
	});
	it('private list (tokenless probe gets PRIVATE): returns the page unstored and deletes any meta', async () => {
		const deps = makeDeps();
		await deps.store.putJSON(metaKey('collection', 'TestUser'), { profile, current: null, pending: null, recent: [] }, 60);
		deps.discogs.listPage.mockImplementation(async (_k, _u, page, _pp, token) => {
			if (token === undefined) throw new DiscogsAPIError('private', 403, 'PRIVATE');
			return pageOf(page, 3, 250);
		});
		const r = await startSync('collection', 'TestUser', 'tok', false, deps);
		expect(r).toMatchObject({ status: 'ok', stored: false, source: 'discogs' });
		expect(await deps.store.getJSON(metaKey('collection', 'TestUser'))).toBeNull();
		expect(await deps.store.listKeys('v2:collection:testuser:s:')).toEqual([]);
	});
	it('rate-limited probe → wait, and nothing else is called', async () => {
		const deps = makeDeps();
		deps.discogs.listPage.mockRejectedValue(rateLimited());
		expect(await startSync('collection', 'u', 'tok', false, deps)).toEqual({ status: 'wait', retryAfterMs: 12_000 });
		expect(deps.discogs.listPage).toHaveBeenCalledTimes(1);
		expect(deps.discogs.profile).not.toHaveBeenCalled();
	});
	it('maps NOT_FOUND, BAD_TOKEN and unexpected errors', async () => {
		for (const [err, code] of [
			[new DiscogsAPIError('x', 404, 'NOT_FOUND'), 'NOT_FOUND'],
			[new Error('boom'), 'UPSTREAM']
		] as const) {
			const deps = makeDeps(); deps.discogs.listPage.mockRejectedValue(err);
			expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'error', code });
		}
		const deps = makeDeps();
		deps.discogs.listPage.mockImplementation(async (_k, _u, _p, _pp, token) => {
			if (token === undefined) return pageOf(1, 1, 1, 1);
			throw new DiscogsAPIError('bad', 401, 'BAD_TOKEN');
		});
		expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'error', code: 'BAD_TOKEN' });
	});
	it('a second start in the same bucket joins the stored page 1 with no Discogs call (Review Focus 3)', async () => {
		const deps = makeDeps(); publicList(deps);
		await startSync('collection', 'TestUser', 'tok', false, deps);
		deps.discogs.listPage.mockClear(); deps.discogs.profile.mockClear();
		now = T0 + 60_000;
		const r = await startSync('collection', 'testuser', 'other-token', false, deps);
		expect(r).toMatchObject({ status: 'ok', snapshot: SNAP, source: 'store', stored: true, nextDelayMs: 0, profile });
		expect(deps.discogs.listPage).not.toHaveBeenCalled();
		expect(deps.discogs.profile).not.toHaveBeenCalled();
	});
	it('empty list: totalPages is 1 and items is [] (Review Focus 2)', async () => {
		const deps = makeDeps();
		deps.discogs.listPage.mockResolvedValue({ data: { items: [], pagination: { page: 1, pages: 0, per_page: 100, items: 0, urls: {} } }, remaining: 50 });
		expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'ok', totalPages: 1, totalItems: 0, items: [] });
	});
	it('store write failure: page still returned, stored is false (Review Focus 4)', async () => {
		const deps = makeDeps(); publicList(deps);
		vi.spyOn(deps.store, 'putJSON').mockResolvedValue(false);
		expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'ok', stored: false });
	});

	describe('with a completed snapshot', () => {
		async function completed(deps: ReturnType<typeof makeDeps>) {
			publicList(deps, 1, 40);
			await startSync('collection', 'u', 'tok', false, deps);
			await completeSync('collection', 'u', SNAP, deps);
			deps.discogs.listPage.mockClear();
		}
		it('not forced and under 6 h old → fresh, no Discogs call', async () => {
			const deps = makeDeps(); await completed(deps);
			now = T0 + FRESH_MS - 1;
			expect(await startSync('collection', 'u', 'tok', false, deps)).toEqual({ status: 'fresh', snapshot: SNAP });
			expect(deps.discogs.listPage).not.toHaveBeenCalled();
		});
		it('not forced and 6 h old → starts a new snapshot, current kept', async () => {
			const deps = makeDeps(); await completed(deps);
			now = T0 + FRESH_MS;
			const r = await startSync('collection', 'u', 'tok', false, deps);
			expect(r).toMatchObject({ status: 'ok', snapshot: snapshotIdAt(now), source: 'discogs' });
			const meta: any = await deps.store.getJSON(metaKey('collection', 'u'));
			expect(meta.current.id).toBe(SNAP);
			expect(meta.pending.id).toBe(snapshotIdAt(now));
		});
		it('forced inside 10 minutes → cooldown with the time left', async () => {
			const deps = makeDeps(); await completed(deps);
			now = T0 + 4 * 60_000;
			expect(await startSync('collection', 'u', 'tok', true, deps)).toEqual({ status: 'cooldown', retryAfterMs: REFRESH_COOLDOWN_MS - 4 * 60_000 });
		});
		it('forced after 10 minutes → starts a new snapshot', async () => {
			const deps = makeDeps(); await completed(deps);
			now = T0 + REFRESH_COOLDOWN_MS;
			expect(await startSync('collection', 'u', 'tok', true, deps)).toMatchObject({ status: 'ok', source: 'discogs' });
		});
		it('ignores a current snapshot whose page 1 has gone from the store', async () => {
			const deps = makeDeps(); await completed(deps);
			await deps.store.delete(pageKey('collection', 'u', SNAP, 1));
			now = T0 + 60 * 60_000;
			expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'ok', source: 'discogs' });
		});
	});
});

describe('getPage', () => {
	async function started(deps: ReturnType<typeof makeDeps>) {
		publicList(deps); await startSync('collection', 'u', 'tok', false, deps);
		deps.discogs.listPage.mockClear();
	}
	it('fetches a missing page with the token, stores it, and paces by remaining', async () => {
		const deps = makeDeps(); await started(deps);
		const r = await getPage('collection', 'u', 'tok', SNAP, 2, deps);
		expect(r).toMatchObject({ status: 'ok', page: 2, source: 'discogs', stored: true, nextDelayMs: 1100 });
		expect(deps.discogs.listPage).toHaveBeenCalledWith('collection', 'u', 2, 100, 'tok');
	});
	it('serves a stored page with no Discogs call and no delay', async () => {
		const deps = makeDeps(); await started(deps);
		await getPage('collection', 'u', 'tok', SNAP, 2, deps);
		deps.discogs.listPage.mockClear();
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toMatchObject({ status: 'ok', source: 'store', stored: true, nextDelayMs: 0 });
		expect(deps.discogs.listPage).not.toHaveBeenCalled();
	});
	it('serves a stored page of the current snapshot long after it has closed', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('collection', 'u', 'tok', false, deps);
		await completeSync('collection', 'u', SNAP, deps);
		now = T0 + 5 * 60 * 60_000;
		expect(await getPage('collection', 'u', 'tok', SNAP, 1, deps)).toMatchObject({ status: 'ok', source: 'store' });
	});
	it('does not serve a stored page of a closed snapshot that is not current', async () => {
		const deps = makeDeps(); await started(deps); // started, never completed
		now = T0 + 5 * 60 * 60_000;
		expect(await getPage('collection', 'u', 'tok', SNAP, 1, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
	});
	it('a list that turned private: its stored pages are deleted and no longer served', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('collection', 'u', 'tok', false, deps);
		await completeSync('collection', 'u', SNAP, deps);
		now = T0 + 6 * 60 * 60_000;
		deps.discogs.listPage.mockImplementation(async (_k, _u, page, _pp, token) => {
			if (token === undefined) throw new DiscogsAPIError('private', 403, 'PRIVATE');
			return pageOf(page, 1, 40, 40);
		});
		expect(await startSync('collection', 'u', 'owner-token', false, deps)).toMatchObject({ status: 'ok', stored: false });
		expect(await deps.store.listKeys('v2:collection:u:')).toEqual([]);
		expect(await getPage('collection', 'u', 'tok', SNAP, 1, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
	});
	it('a missing page of a closed snapshot → SNAPSHOT_EXPIRED, no Discogs call', async () => {
		const deps = makeDeps(); await started(deps);
		now = T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS;
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
		expect(deps.discogs.listPage).not.toHaveBeenCalled();
	});
	it('rejects an invented snapshot id and bad page numbers without calling Discogs', async () => {
		const deps = makeDeps();
		expect(await getPage('collection', 'u', 'tok', 'abc', 1, deps)).toMatchObject({ code: 'BAD_REQUEST' });
		expect(await getPage('collection', 'u', 'tok', SNAP, 0, deps)).toMatchObject({ code: 'BAD_REQUEST' });
		expect(await getPage('collection', 'u', 'tok', '9999999', 1, deps)).toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
		expect(deps.discogs.listPage).not.toHaveBeenCalled();
	});
	it('429 → wait at once, single call', async () => {
		const deps = makeDeps(); await started(deps);
		deps.discogs.listPage.mockRejectedValue(rateLimited());
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toEqual({ status: 'wait', retryAfterMs: 12_000 });
		expect(deps.discogs.listPage).toHaveBeenCalledTimes(1);
	});
	it('low remaining budget slows the next call', async () => {
		const deps = makeDeps(); await started(deps);
		deps.discogs.listPage.mockResolvedValue({ ...pageOf(2, 3, 250), remaining: 2 });
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toMatchObject({ nextDelayMs: 15000 });
	});
	it('without a stored page 1 (private list) the page is returned but not stored', async () => {
		const deps = makeDeps();
		deps.discogs.listPage.mockResolvedValue(pageOf(2, 3, 250));
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toMatchObject({ status: 'ok', stored: false });
		expect(await deps.store.listKeys('v2:')).toEqual([]);
	});
	it('Discogs 404 on a page beyond the first is an empty page, stored (Review Focus 1)', async () => {
		const deps = makeDeps(); await started(deps);
		deps.discogs.listPage.mockRejectedValue(new DiscogsAPIError('gone', 404, 'NOT_FOUND'));
		expect(await getPage('collection', 'u', 'tok', SNAP, 3, deps)).toMatchObject({ status: 'ok', page: 3, items: [], totalPages: 3, totalItems: 250, stored: true });
	});
	it('store write failure → stored false (Review Focus 4)', async () => {
		const deps = makeDeps(); await started(deps);
		vi.spyOn(deps.store, 'putJSON').mockResolvedValue(false);
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toMatchObject({ status: 'ok', stored: false });
	});
});

describe('completeSync', () => {
	it('reports missing pages in ascending order', async () => {
		const deps = makeDeps(); publicList(deps);
		await startSync('collection', 'u', 'tok', false, deps);
		await getPage('collection', 'u', 'tok', SNAP, 3, deps);
		expect(await completeSync('collection', 'u', SNAP, deps)).toEqual({ status: 'incomplete', missing: [2] });
	});
	it('with no page 1 → incomplete [1]', async () => {
		expect(await completeSync('collection', 'u', SNAP, makeDeps())).toEqual({ status: 'incomplete', missing: [1] });
	});
	it('all pages present → meta.current switches, pending clears, recent holds 3 cleaned titles', async () => {
		const deps = makeDeps(); publicList(deps);
		await startSync('collection', 'u', 'tok', false, deps);
		await getPage('collection', 'u', 'tok', SNAP, 2, deps);
		await getPage('collection', 'u', 'tok', SNAP, 3, deps);
		now = T0 + 5000;
		expect(await completeSync('collection', 'u', SNAP, deps)).toEqual({ status: 'complete', snapshot: SNAP, completedAt: T0 + 5000 });
		const meta: any = await deps.store.getJSON(metaKey('collection', 'u'));
		expect(meta.current).toEqual({ id: SNAP, totalItems: 250, totalPages: 3, startedAt: T0, completedAt: T0 + 5000 });
		expect(meta.pending).toBeNull();
		expect(meta.recent).toEqual([{ artist: 'Art', title: 'T1' }, { artist: 'Art', title: 'T2' }, { artist: 'Art', title: 'T3' }]);
	});
	it('is idempotent: a second call returns the first completedAt', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('collection', 'u', 'tok', false, deps);
		const first = await completeSync('collection', 'u', SNAP, deps);
		now = T0 + 99_000;
		expect(await completeSync('collection', 'u', SNAP, deps)).toEqual(first);
	});
	it('wantlist meta has an empty recent list', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('wantlist', 'u', 'tok', false, deps);
		await completeSync('wantlist', 'u', SNAP, deps);
		expect(((await deps.store.getJSON(metaKey('wantlist', 'u'))) as any).recent).toEqual([]);
	});
});

describe('readStored', () => {
	it('returns null when nothing is stored', async () => {
		expect(await readStored('collection', 'u', getStore(undefined), T0)).toBeNull();
	});
	it('returns the completed snapshot with its first page', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('collection', 'u', 'tok', false, deps);
		await completeSync('collection', 'u', SNAP, deps);
		const s = await readStored('collection', 'U', deps.store, T0 + 1);
		expect(s).toMatchObject({ profile, snapshot: SNAP, complete: true, completedAt: T0, totalItems: 40, totalPages: 1 });
		expect(s!.firstPage).toHaveLength(40);
	});
	it('returns an open in-progress snapshot as incomplete, and null once it has closed', async () => {
		const deps = makeDeps(); publicList(deps);
		await startSync('collection', 'u', 'tok', false, deps);
		expect(await readStored('collection', 'u', deps.store, T0 + 1)).toMatchObject({ complete: false, completedAt: null, snapshot: SNAP });
		expect(await readStored('collection', 'u', deps.store, T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS)).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/server/sync.test.ts`
Expected: FAIL, cannot resolve `./sync`.

- [ ] **Step 3: Implement `src/lib/server/sync.ts`** to the Interfaces block and the behaviour list above.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/server/sync.test.ts && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/sync.ts src/lib/server/sync.test.ts
git commit -m "feat: add server sync core (start, page, complete, stored read)"
```

---

### Task 4: Sync route factory, status endpoint, robots

**Files:**
- Create: `src/lib/server/syncRoute.ts`, `src/routes/api/status/+server.ts`
- Modify: `static/robots.txt`
- Test: `src/lib/server/syncRoute.test.ts`, `src/routes/api/status/server.test.ts`

**Interfaces:**
- Consumes: `startSync`, `getPage`, `completeSync`, `discogsPort` (Task 3); `getStore` (Task 1); `lastRateReading` (Task 2).
- Produces:
  ```ts
  // src/lib/server/syncRoute.ts
  import type { RequestHandler } from '@sveltejs/kit';
  export function httpStatusFor(result: { status: string; code?: SyncErrorCode }): number;
  export function makeSyncHandlers(kind: SyncKind): { GET: RequestHandler; POST: RequestHandler };
  ```
  Wire contract:
  - `GET ?page=N&snapshot=S` → `getPage`.
  - `POST { "action": "start", "force"?: boolean }` → `startSync`.
  - `POST { "action": "complete", "snapshot": "S" }` → `completeSync`.
  - No `discogs_token` cookie → body `{ status: 'error', code: 'TOKEN_REQUIRED', message }`, HTTP 401, nothing else called.
  - HTTP status: `TOKEN_REQUIRED` 401, `BAD_TOKEN` 401, `PRIVATE` 403, `NOT_FOUND` 404, `SNAPSHOT_EXPIRED` 409, `BAD_REQUEST` 400, `UPSTREAM` 502; every non-error result 200.
  - Every response: `content-type: application/json`, `cache-control: no-store`. Build responses with `new Response(JSON.stringify(result), …)`.
  - `GET /api/status` → `{ store: 'kv' | 'memory', version: string, discogs: { remaining, at, last429At } }`, `cache-control: no-store`.

- [ ] **Step 1: Write the failing tests**

`src/lib/server/syncRoute.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sync', () => ({
	startSync: vi.fn(), getPage: vi.fn(), completeSync: vi.fn(), discogsPort: { marker: true }
}));
vi.mock('./store', () => ({ getStore: vi.fn(() => ({ backend: 'memory' })) }));

import { makeSyncHandlers, httpStatusFor } from './syncRoute';
import { startSync, getPage, completeSync } from './sync';

const { GET, POST } = makeSyncHandlers('collection');
const event = (o: { token?: string; search?: string; body?: unknown } = {}) => ({
	params: { username: 'TestUser' },
	platform: undefined,
	cookies: { get: (n: string) => (n === 'discogs_token' ? o.token : undefined) },
	url: new URL(`http://x/api/collection/TestUser${o.search ?? ''}`),
	request: new Request('http://x', { method: 'POST', body: o.body === undefined ? undefined : JSON.stringify(o.body) })
}) as any;

beforeEach(() => { vi.clearAllMocks(); process.env.DISCOGS_TOKEN = 'server-token-must-be-ignored'; });

describe('makeSyncHandlers', () => {
	it('GET without a token cookie: 401 TOKEN_REQUIRED and nothing is called, even with DISCOGS_TOKEN set', async () => {
		const res = await GET(event({ search: '?page=2&snapshot=3000000' }));
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ status: 'error', code: 'TOKEN_REQUIRED' });
		expect(getPage).not.toHaveBeenCalled();
	});
	it('POST without a token cookie: 401 and nothing is called', async () => {
		const res = await POST(event({ body: { action: 'start' } }));
		expect(res.status).toBe(401);
		expect(startSync).not.toHaveBeenCalled();
	});
	it('GET passes kind, username, token, snapshot and page to getPage; responds no-store', async () => {
		vi.mocked(getPage).mockResolvedValue({ status: 'wait', retryAfterMs: 5 });
		const res = await GET(event({ token: 'tok', search: '?page=2&snapshot=3000000' }));
		expect(vi.mocked(getPage).mock.calls[0].slice(0, 5)).toEqual(['collection', 'TestUser', 'tok', '3000000', 2]);
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(await res.json()).toEqual({ status: 'wait', retryAfterMs: 5 });
	});
	it('GET with a missing or non-numeric page is 400 BAD_REQUEST', async () => {
		expect((await GET(event({ token: 'tok', search: '?snapshot=3000000' }))).status).toBe(400);
		expect((await GET(event({ token: 'tok', search: '?page=x&snapshot=3000000' }))).status).toBe(400);
		expect(getPage).not.toHaveBeenCalled();
	});
	it('POST start passes force (default false)', async () => {
		vi.mocked(startSync).mockResolvedValue({ status: 'fresh', snapshot: '1' });
		await POST(event({ token: 'tok', body: { action: 'start' } }));
		await POST(event({ token: 'tok', body: { action: 'start', force: true } }));
		expect(vi.mocked(startSync).mock.calls.map((c) => c[3])).toEqual([false, true]);
	});
	it('POST complete passes the snapshot', async () => {
		vi.mocked(completeSync).mockResolvedValue({ status: 'incomplete', missing: [2] });
		const res = await POST(event({ token: 'tok', body: { action: 'complete', snapshot: '3000000' } }));
		expect(vi.mocked(completeSync).mock.calls[0].slice(0, 3)).toEqual(['collection', 'TestUser', '3000000']);
		expect(await res.json()).toEqual({ status: 'incomplete', missing: [2] });
	});
	it('POST with an unknown action or unparseable body is 400 BAD_REQUEST', async () => {
		expect((await POST(event({ token: 'tok', body: { action: 'delete' } }))).status).toBe(400);
		expect((await POST(event({ token: 'tok' }))).status).toBe(400);
	});
	it('exposes only GET and POST', () => {
		expect(Object.keys(makeSyncHandlers('wantlist')).sort()).toEqual(['GET', 'POST']);
	});
});

describe('httpStatusFor', () => {
	it('maps error codes and treats everything else as 200', () => {
		const s = (code: any) => httpStatusFor({ status: 'error', code });
		expect([s('TOKEN_REQUIRED'), s('BAD_TOKEN'), s('PRIVATE'), s('NOT_FOUND'), s('SNAPSHOT_EXPIRED'), s('BAD_REQUEST'), s('UPSTREAM')])
			.toEqual([401, 401, 403, 404, 409, 400, 502]);
		expect(httpStatusFor({ status: 'wait' })).toBe(200);
	});
});
```

`src/routes/api/status/server.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('$app/environment', () => ({ version: '9.9.9' }));
import { GET } from './+server';

describe('status endpoint', () => {
	it('reports the store backend, version and last rate reading, and no secrets', async () => {
		process.env.DISCOGS_TOKEN = 'must-not-appear';
		const res = await GET({ platform: undefined } as any);
		const body = await res.json();
		expect(body).toMatchObject({ store: 'memory', version: '9.9.9' });
		expect(Object.keys(body).sort()).toEqual(['discogs', 'store', 'version']);
		expect(Object.keys(body.discogs).sort()).toEqual(['at', 'last429At', 'remaining']);
		expect(JSON.stringify(body)).not.toContain('must-not-appear');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});
	it('reports kv when the binding is present', async () => {
		const res = await GET({ platform: { env: { COLLECTION_CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() } } } } as any);
		expect((await res.json()).store).toBe('kv');
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/server/syncRoute.test.ts src/routes/api/status/server.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/lib/server/syncRoute.ts` and `src/routes/api/status/+server.ts`.**

Handlers build `SyncDeps` as `{ store: getStore(platform), discogs: discogsPort, now: Date.now }`.

- [ ] **Step 4: Replace `static/robots.txt`** with:

```
User-agent: *
Disallow: /api/
Disallow: /compare/
Disallow: /u/
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/server/syncRoute.test.ts src/routes/api/status/server.test.ts && npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/syncRoute.ts src/lib/server/syncRoute.test.ts src/routes/api/status static/robots.txt
git commit -m "feat: add sync route factory, status endpoint, and crawler rules"
```

---

### Task 5: Browser sync engine and loader

**Files:**
- Create: `src/lib/sync/engine.ts`, `src/lib/sync/loader.svelte.ts`
- Test: `src/lib/sync/engine.test.ts`

**Interfaces:**
- Consumes: wire types and constants from `src/lib/sync/types.ts`; the wire contract in Task 4.
- Produces:
  ```ts
  // src/lib/sync/engine.ts
  export type LoaderPhase = 'idle' | 'loading' | 'waiting' | 'refreshing' | 'done' | 'error';
  export interface EngineState<T> {
  	profile: PublicProfile | null;   // from src/lib/sync/types.ts
  	items: T[];               // what is on screen
  	totalItems: number;
  	loaded: number;           // records fetched so far in the active pass
  	phase: LoaderPhase;
  	background: boolean;      // active pass is a re-sync over a copy already on screen
  	resumeAt: number | null;  // epoch ms a wait ends
  	asOf: number | null;      // completedAt of the copy on screen
  	error: { code: SyncErrorCode | 'NETWORK'; message: string } | null;
  	cooldownUntil: number | null;
  }
  export interface EngineDeps { fetchFn: typeof fetch; sleep: (ms: number) => Promise<void>; now: () => number }
  export interface EngineOptions<T> {
  	kind: SyncKind; username: string; initial: StoredInitial<T> | null;
  	keyOf: (item: T) => number;
  	autoRefresh?: boolean;    // default true
  	deps?: Partial<EngineDeps>;
  	onChange: (state: EngineState<T>) => void;
  }
  export interface Engine<T> {
  	readonly state: EngineState<T>;
  	/** Loads everything for the first view. Resolves when phase is done or error (then, if autoRefresh, continues into refreshIfStale). */
  	run(): Promise<void>;
  	refreshIfStale(): Promise<void>;
  	/** The Refresh button: start with force. */
  	refresh(): Promise<void>;
  	stop(): void;
  }
  export function createEngine<T>(options: EngineOptions<T>): Engine<T>;
  export const STORED_CONCURRENCY = 4;
  export const FLUSH_EVERY_PAGES = 3;
  export const MAX_RESTARTS = 2;
  export const MAX_COMPLETE_ATTEMPTS = 3;
  export const MAX_NETWORK_RETRIES = 3;

  // src/lib/sync/loader.svelte.ts
  export function createLoader<T>(options: Omit<EngineOptions<T>, 'onChange'>): Engine<T>; // `state` is reactive ($state.raw, replaced on every change)
  ```
  Requests: `GET /api/${kind}/${encodeURIComponent(username)}?page=N&snapshot=S`; `POST` the same path with JSON bodies from Task 4.

**Behaviour the tests pin:**

- Every response is read as JSON whatever its HTTP status; the `status` field decides what happens.
- A pass sleeps a page's `nextDelayMs` only before fetching another page. There is no sleep after the last page.
- Initial state from `initial`: `profile`, `items = firstPage`, `totalItems`, `asOf = completedAt`, `phase: 'idle'`. With `initial: null`: empty, `profile: null`.
- `run()` with a complete `initial`: fetch pages `2..totalPages` of `initial.snapshot`, up to `STORED_CONCURRENCY` at a time, appended in page order, no sleeping. Never calls `start`.
- `run()` with an incomplete `initial`: fetch pages `2..` one at a time, sleeping each response's `nextDelayMs` before the next; then `complete`.
- `run()` with no `initial`: `POST start`. On `ok`: take `profile`, page 1, then pages one at a time as above; `complete` only if every page of the pass came back with `stored: true`. On `fresh`: `GET` page 1 of that snapshot and continue as a complete stored copy.
- Items are flushed to `state.items` every `FLUSH_EVERY_PAGES` pages and at the end, de-duplicated by `keyOf`.
- `wait`: `phase: 'waiting'`, `resumeAt = now + delay`, sleep, retry the same request. Delay is `retryAfterMs` doubled for each consecutive `wait`, capped at `MAX_WAIT_MS`. A success resets the doubling. Waiting never gives up.
- `SNAPSHOT_EXPIRED` on a page: discard the pass and `POST start` again (handling `ok` and `fresh` exactly as on a first load), at most `MAX_RESTARTS` times, then `phase: 'error'`.
- `complete` → `incomplete`: fetch the listed pages (paced), then `complete` again, at most `MAX_COMPLETE_ATTEMPTS`; after that finish as `done` anyway. On `complete`: `asOf = completedAt`.
- Network failure, unparseable response, or `UPSTREAM`: retry the same request after 2 s, 4 s, 8 s (`MAX_NETWORK_RETRIES`), then `phase: 'error'` with the code (`NETWORK` for the first two cases). Items already on screen stay.
- `NOT_FOUND`, `PRIVATE`: `phase: 'error'`, `items: []`, `profile` kept if known. `TOKEN_REQUIRED`, `BAD_TOKEN`: `phase: 'error'` with that code (the page redirects).
- `refreshIfStale()`: if `asOf` is null or `now - asOf < FRESH_MS`, do nothing. Otherwise `POST start` (not forced). `fresh` → nothing changes (Review Focus 5). `ok` → `phase: 'refreshing'`, `background: true`; `items` keep showing the old copy while `loaded` counts the new pass; when the pass finishes, swap `items`, set `asOf`, `phase: 'done'`, `background: false`.
- `refresh()`: `POST start` with `force: true`. `cooldown` → `cooldownUntil = now + retryAfterMs`, nothing else changes. `ok` → same background pass as above.
- `stop()`: no further fetches or state changes.
- Default deps: global `fetch`, `setTimeout`-based sleep, `Date.now`.

- [ ] **Step 1: Write the failing tests** in `src/lib/sync/engine.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { createEngine, type EngineState } from './engine';
import { FRESH_MS, MAX_WAIT_MS } from './types';

type Item = { instance_id: number };
const T0 = 1_800_000_000_000;
const profile = { username: 'u' } as any;
const items = (from: number, count: number): Item[] => Array.from({ length: count }, (_, i) => ({ instance_id: from + i }));
const ok = (page: number, totalPages: number, totalItems: number, list: Item[], extra: object = {}) =>
	({ status: 'ok', snapshot: 'S1', page, totalPages, totalItems, items: list, source: 'discogs', stored: true, nextDelayMs: 1100, ...extra });

/** Scripted server: `handler(method, url, body)` returns the JSON to send, or throws for a network error. */
function harness(handler: (method: string, url: string, body: any) => unknown, initial: any = null, opts: object = {}) {
	const calls: Array<{ method: string; url: string; body: any }> = [];
	const sleeps: number[] = [];
	const states: EngineState<Item>[] = [];
	let now = T0;
	const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
		const method = init?.method ?? 'GET';
		const body = init?.body ? JSON.parse(init.body as string) : undefined;
		calls.push({ method, url, body });
		return new Response(JSON.stringify(handler(method, url, body)));
	}) as any;
	const engine = createEngine<Item>({
		kind: 'collection', username: 'u', initial, keyOf: (i) => i.instance_id,
		deps: { fetchFn, sleep: async (ms) => { sleeps.push(ms); now += ms; }, now: () => now },
		onChange: (s) => states.push(s), ...opts
	});
	return { engine, calls, sleeps, states, setNow: (n: number) => (now = n) };
}
const pageOfUrl = (url: string) => Number(new URL(url, 'http://x').searchParams.get('page'));
const stored = (totalPages: number, totalItems: number, completedAt: number | null = T0, complete = true) =>
	({ profile, snapshot: 'S0', complete, completedAt, totalItems, totalPages, firstPage: items(1, 100) });

describe('first load', () => {
	it('with nothing stored: starts, walks pages in order, sleeps nextDelayMs between them, then completes', async () => {
		const h = harness((method, url, body) => {
			if (method === 'POST' && body.action === 'start') return ok(1, 3, 250, items(1, 100), { profile });
			if (method === 'POST' && body.action === 'complete') return { status: 'complete', snapshot: 'S1', completedAt: T0 + 9 };
			return ok(pageOfUrl(url), 3, 250, items((pageOfUrl(url) - 1) * 100 + 1, pageOfUrl(url) === 3 ? 50 : 100));
		}, null, { autoRefresh: false });
		await h.engine.run();
		expect(h.calls.map((c) => c.method + (c.body?.action ?? pageOfUrl(c.url)))).toEqual(['POSTstart', 'GET2', 'GET3', 'POSTcomplete']);
		expect(h.calls[1].url).toBe('/api/collection/u?page=2&snapshot=S1');
		expect(h.calls[0].body).toEqual({ action: 'start', force: false });
		expect(h.sleeps).toEqual([1100, 1100]);
		expect(h.engine.state).toMatchObject({ phase: 'done', profile, totalItems: 250, loaded: 250, asOf: T0 + 9, error: null });
		expect(h.engine.state.items).toHaveLength(250);
	});
	it('empty list: one page, completes, done with zero items (Review Focus 2)', async () => {
		const h = harness((_m, _u, body) => body.action === 'start'
			? ok(1, 1, 0, [], { profile }) : { status: 'complete', snapshot: 'S1', completedAt: T0 }, null, { autoRefresh: false });
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'done', totalItems: 0, items: [] });
	});
	it('does not call complete when any page was not stored (private list, or store failure — Review Focus 4)', async () => {
		const h = harness((method, url, body) => method === 'POST'
			? ok(1, 2, 150, items(1, 100), { profile, stored: false })
			: ok(2, 2, 150, items(101, 50), { stored: false }), null, { autoRefresh: false });
		await h.engine.run();
		expect(h.calls.some((c) => c.body?.action === 'complete')).toBe(false);
		expect(h.engine.state.phase).toBe('done');
	});
	it('with a complete stored copy: loads the other pages without start and without sleeping', async () => {
		const h = harness((_m, url) => ok(pageOfUrl(url), 3, 250, items((pageOfUrl(url) - 1) * 100 + 1, pageOfUrl(url) === 3 ? 50 : 100), { snapshot: 'S0', source: 'store', nextDelayMs: 0 }),
			stored(3, 250), { autoRefresh: false });
		expect(h.engine.state).toMatchObject({ phase: 'idle', profile, asOf: T0 });
		expect(h.engine.state.items).toHaveLength(100);
		await h.engine.run();
		expect(h.calls.map((c) => c.method)).toEqual(['GET', 'GET']);
		expect(h.calls.every((c) => c.url.includes('snapshot=S0'))).toBe(true);
		expect(h.sleeps).toEqual([]);
		expect(h.engine.state.items.map((i) => i.instance_id)).toEqual(items(1, 250).map((i) => i.instance_id));
	});
	it('with an in-progress stored copy: continues one page at a time, then completes', async () => {
		const h = harness((method, url, body) => method === 'POST'
			? { status: 'complete', snapshot: 'S0', completedAt: T0 + 1 }
			: ok(pageOfUrl(url), 2, 150, items(101, 50), { snapshot: 'S0' }), stored(2, 150, null, false), { autoRefresh: false });
		await h.engine.run();
		expect(h.calls.map((c) => c.method + (c.body?.action ?? ''))).toEqual(['GET', 'POSTcomplete']);
		expect(h.engine.state.asOf).toBe(T0 + 1);
	});
	it('de-duplicates by key', async () => {
		const h = harness((method, _u, body) => method === 'GET' ? ok(2, 2, 3, items(2, 2))
			: body.action === 'start' ? ok(1, 2, 3, items(1, 2), { profile }) : { status: 'complete', snapshot: 'S1', completedAt: T0 }, null, { autoRefresh: false });
		await h.engine.run();
		expect(h.engine.state.items.map((i) => i.instance_id)).toEqual([1, 2, 3]);
	});
	it('reads the JSON body whatever the HTTP status', async () => {
		const h = harness(() => ({}), null, { autoRefresh: false, deps: {
			fetchFn: (async () => new Response(JSON.stringify({ status: 'error', code: 'PRIVATE', message: 'p' }), { status: 403 })) as any,
			sleep: async () => {}, now: () => T0
		} });
		await h.engine.run();
		expect(h.engine.state.error).toEqual({ code: 'PRIVATE', message: 'p' });
	});
});

describe('waiting and failures', () => {
	it('wait: enters waiting with resumeAt, sleeps, retries the same page, doubling up to 60 s', async () => {
		let waits = 0;
		const h = harness((method, url, body) => {
			if (method === 'POST') return body.action === 'start' ? ok(1, 2, 150, items(1, 100), { profile }) : { status: 'complete', snapshot: 'S1', completedAt: T0 };
			return waits++ < 3 ? { status: 'wait', retryAfterMs: 20_000 } : ok(2, 2, 150, items(101, 50));
		}, null, { autoRefresh: false });
		await h.engine.run();
		expect(h.sleeps).toEqual([1100, 20_000, 40_000, MAX_WAIT_MS]);
		const waiting = h.states.find((s) => s.phase === 'waiting')!;
		expect(waiting.resumeAt).toBe(T0 + 1100 + 20_000);
		expect(h.calls.filter((c) => c.method === 'GET')).toHaveLength(4);
		expect(h.engine.state.phase).toBe('done');
	});
	it('SNAPSHOT_EXPIRED on a page restarts with start, at most twice, then errors', async () => {
		const h = harness((method, _u, body) => method === 'POST' && body.action === 'start'
			? ok(1, 2, 150, items(1, 100), { profile })
			: { status: 'error', code: 'SNAPSHOT_EXPIRED', message: 'x' }, null, { autoRefresh: false });
		await h.engine.run();
		expect(h.calls.filter((c) => c.body?.action === 'start')).toHaveLength(3);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'SNAPSHOT_EXPIRED' } });
	});
	it('incomplete: fetches the missing pages then completes again', async () => {
		let completes = 0;
		const h = harness((method, url, body) => {
			if (method === 'GET') return ok(pageOfUrl(url), 2, 150, items(101, 50));
			if (body.action === 'start') return ok(1, 2, 150, items(1, 100), { profile });
			return completes++ === 0 ? { status: 'incomplete', missing: [2] } : { status: 'complete', snapshot: 'S1', completedAt: T0 + 5 };
		}, null, { autoRefresh: false });
		await h.engine.run();
		expect(h.calls.map((c) => c.method + (c.body?.action ?? pageOfUrl(c.url)))).toEqual(['POSTstart', 'GET2', 'POSTcomplete', 'GET2', 'POSTcomplete']);
		expect(h.engine.state).toMatchObject({ phase: 'done', asOf: T0 + 5 });
	});
	it('NOT_FOUND: error, no items', async () => {
		const h = harness(() => ({ status: 'error', code: 'NOT_FOUND', message: 'nope' }), null, { autoRefresh: false });
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NOT_FOUND', message: 'nope' }, items: [] });
		expect(h.calls).toHaveLength(1);
	});
	it('network failure: retries after 2 s, 4 s, 8 s, then errors as NETWORK keeping what is on screen', async () => {
		const h = harness(() => { throw new Error('offline'); }, stored(2, 150), { autoRefresh: false });
		await h.engine.run();
		expect(h.sleeps).toEqual([2000, 4000, 8000]);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NETWORK' } });
		expect(h.engine.state.items).toHaveLength(100);
	});
	it('stop() halts further fetches', async () => {
		const h = harness((method, url, body) => method === 'POST'
			? ok(1, 5, 500, items(1, 100), { profile }) : ok(pageOfUrl(url), 5, 500, items(pageOfUrl(url) * 100, 100)), null, { autoRefresh: false });
		const p = h.engine.run();
		h.engine.stop();
		await p;
		expect(h.calls.length).toBeLessThanOrEqual(2);
	});
});

describe('refreshing', () => {
	const freshServer = (method: string, url: string, body: any) => {
		if (method === 'GET' && url.includes('snapshot=S0')) return ok(2, 2, 150, items(101, 50), { snapshot: 'S0', source: 'store', nextDelayMs: 0 });
		if (method === 'GET') return ok(2, 2, 151, items(1101, 51));
		if (body.action === 'start') return ok(1, 2, 151, items(1001, 100), { profile });
		return { status: 'complete', snapshot: 'S1', completedAt: T0 + FRESH_MS + 7 };
	};
	it('a copy 6 h old is shown, then re-synced in the background and swapped in', async () => {
		const h = harness(freshServer, stored(2, 150));
		h.setNow(T0 + FRESH_MS);
		await h.engine.run();
		const during = h.states.find((s) => s.phase === 'refreshing')!;
		expect(during).toMatchObject({ background: true, asOf: T0 });
		expect(during.items.every((i) => i.instance_id < 1000)).toBe(true);
		expect(h.engine.state).toMatchObject({ phase: 'done', background: false, asOf: T0 + FRESH_MS + 7, totalItems: 151 });
		expect(h.engine.state.items).toHaveLength(151);
		expect(h.engine.state.items[0].instance_id).toBe(1001);
		expect(h.calls.find((c: any) => c.body?.action === 'start')).toMatchObject({ body: { action: 'start', force: false } });
	});
	it('a copy under 6 h old is not re-synced', async () => {
		const h = harness(freshServer, stored(2, 150));
		h.setNow(T0 + FRESH_MS - 1);
		await h.engine.run();
		expect(h.calls.some((c: any) => c.body?.action === 'start')).toBe(false);
	});
	it('the server answering fresh wins over the browser clock (Review Focus 5)', async () => {
		const h = harness((method, _u, body) => method === 'GET'
			? ok(2, 2, 150, items(101, 50), { snapshot: 'S0', source: 'store', nextDelayMs: 0 })
			: { status: 'fresh', snapshot: 'S0' }, stored(2, 150));
		h.setNow(T0 + 30 * 24 * 60 * 60_000);
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'done', asOf: T0, background: false });
		expect(h.engine.state.items).toHaveLength(150);
		expect(h.calls.filter((c) => c.body?.action === 'start')).toHaveLength(1);
	});
	it('autoRefresh false: no re-sync until refreshIfStale() is called', async () => {
		const h = harness(freshServer, stored(2, 150), { autoRefresh: false });
		h.setNow(T0 + FRESH_MS);
		await h.engine.run();
		expect(h.calls.some((c: any) => c.body?.action === 'start')).toBe(false);
		await h.engine.refreshIfStale();
		expect(h.engine.state.items).toHaveLength(151);
	});
	it('refresh() sends force and records a cooldown without changing the copy', async () => {
		const h = harness((method, _u, body) => method === 'POST' ? { status: 'cooldown', retryAfterMs: 240_000 } : ok(2, 2, 150, items(101, 50), { snapshot: 'S0', source: 'store', nextDelayMs: 0 }), stored(2, 150), { autoRefresh: false });
		await h.engine.run();
		await h.engine.refresh();
		expect(h.calls.at(-1)!.body).toEqual({ action: 'start', force: true });
		expect(h.engine.state).toMatchObject({ phase: 'done', cooldownUntil: T0 + 240_000, asOf: T0 });
	});
	it('a list that turned private during a re-sync clears the copy on screen', async () => {
		const h = harness((method, _u) => method === 'GET'
			? ok(2, 2, 150, items(101, 50), { snapshot: 'S0', source: 'store', nextDelayMs: 0 })
			: { status: 'error', code: 'PRIVATE', message: 'private' }, stored(2, 150));
		h.setNow(T0 + FRESH_MS);
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'PRIVATE' }, items: [] });
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/sync/engine.test.ts`
Expected: FAIL, cannot resolve `./engine`.

- [ ] **Step 3: Implement `src/lib/sync/engine.ts`** to the Interfaces block and behaviour list. No Svelte or `$app` imports. Every state change builds a new state object and calls `onChange`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/sync/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `src/lib/sync/loader.svelte.ts`**

```ts
import { createEngine, type Engine, type EngineOptions, type EngineState } from './engine';

export function createLoader<T>(options: Omit<EngineOptions<T>, 'onChange'>): Engine<T> {
	let state = $state.raw<EngineState<T>>(undefined as never);
	const engine = createEngine<T>({ ...options, onChange: (s) => (state = s) });
	state = engine.state;
	return {
		get state() { return state; },
		run: () => engine.run(),
		refreshIfStale: () => engine.refreshIfStale(),
		refresh: () => engine.refresh(),
		stop: () => engine.stop()
	};
}
```

- [ ] **Step 6: Run checks**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync/engine.ts src/lib/sync/engine.test.ts src/lib/sync/loader.svelte.ts
git commit -m "feat: add browser sync engine and reactive loader"
```

---

### Task 6: Profile page on stored copies

**Files:**
- Rewrite: `src/routes/api/collection/[username=username]/+server.ts`, its `server.test.ts`
- Rewrite: `src/routes/u/[username=username]/+page.server.ts`, its `server.test.ts`
- Modify: `src/routes/u/[username=username]/+page.svelte`
- Rewrite: `src/lib/components/profile/LoadingBanner.svelte`
- Create: `src/lib/components/profile/LoadingBanner.test.ts`, `e2e/profile.test.ts`

**Interfaces:**
- Consumes: `makeSyncHandlers` (Task 4); `readStored` (Task 3); `getStore` (Task 1); `createLoader`, `EngineState` (Task 5); `StoredInitial` (Task 2).
- Produces:
  - Page data: `{ username: string; stored: StoredInitial<DiscogsCollectionItem> | null }`.
  - `LoadingBanner` props: `{ state: EngineState<unknown>; label?: string; onRetry: () => void }` (`label` defaults to `'collection'`). Tasks 7 and 8 reuse it.

**Exact banner copy** (`{age}` is e.g. `7 hours`, `2 days`; whole units, minimum `1 minute`):

| State | Text |
|---|---|
| `phase: 'loading'` | `Loading {label}: {loaded} of {totalItems} records…` |
| `phase: 'waiting'` | `Discogs is busy — resuming in {seconds}s.` (counts down each second from `resumeAt`) |
| `phase: 'refreshing'` | `Showing a copy from {age} ago — updating ({loaded} of {totalItems})…` |
| `phase: 'error'`, code `NETWORK` or `UPSTREAM` or `SNAPSHOT_EXPIRED` | `Couldn't reach Discogs — showing {items.length} of {totalItems} records.` with a `Retry` button calling `onRetry` |
| `cooldownUntil` in the future (any phase) | `Already refreshed in the last 10 minutes.` |
| otherwise | renders nothing |

Loading, waiting and refreshing use `aria-live="polite"`; the error uses `role="alert"`. Keep the existing progress bar for loading and refreshing (`loaded / totalItems`).

**Exact page copy:**
- `NOT_FOUND`: `No Discogs user named "{username}".`
- `PRIVATE`: `{username}'s collection is private.`
- `<title>` when a profile is known: `{profile.username}'s Collection - Record Shelf`; otherwise `Record Shelf`.
- Description and `og:description`: `{profile.username}'s record collection: {totalItems} records on Record Shelf`. Remove the artist-count and top-genre text from all meta tags.

- [ ] **Step 1: Write the failing server tests**

`src/routes/api/collection/[username=username]/server.test.ts` (replace the whole file):

```ts
import { describe, it, expect, vi } from 'vitest';
const made = vi.hoisted(() => ({ kinds: [] as string[] }));
vi.mock('$lib/server/syncRoute', () => ({
	makeSyncHandlers: (kind: string) => { made.kinds.push(kind); return { GET: 'g', POST: 'p' }; }
}));
import * as route from './+server';

describe('collection sync route', () => {
	it('is the collection sync handlers and nothing else (no DELETE)', () => {
		expect(made.kinds).toEqual(['collection']);
		expect(Object.keys(route).sort()).toEqual(['GET', 'POST']);
	});
});
```

`src/routes/u/[username=username]/server.test.ts` (replace the whole file):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const err = new Error('redirect') as Error & { status: number; location: string };
		err.status = status; err.location = location; throw err;
	}
}));
vi.mock('$lib/server/sync', () => ({ readStored: vi.fn() }));
vi.mock('$lib/server/store', () => ({ getStore: vi.fn(() => ({ backend: 'memory' })) }));
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import { load } from './+page.server';
import { readStored } from '$lib/server/sync';

const event = (token?: string) => ({
	params: { username: 'TestUser' }, platform: undefined,
	cookies: { get: (n: string) => (n === 'discogs_token' ? token : undefined) }
}) as any;

beforeEach(() => { vi.clearAllMocks(); process.env.DISCOGS_TOKEN = 'server-token-must-be-ignored'; });

describe('profile load', () => {
	it('redirects to settings without a token cookie, even when DISCOGS_TOKEN is set, and reads nothing', async () => {
		await expect(load(event())).rejects.toMatchObject({ status: 303, location: '/settings?redirect=/u/TestUser' });
		expect(readStored).not.toHaveBeenCalled();
	});
	it('returns the stored copy and never calls Discogs', async () => {
		const stored = { snapshot: 'S0', complete: true, firstPage: [] };
		vi.mocked(readStored).mockResolvedValue(stored as any);
		expect(await load(event('tok'))).toEqual({ username: 'TestUser', stored });
		expect(vi.mocked(readStored).mock.calls[0].slice(0, 2)).toEqual(['collection', 'TestUser']);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
	it('returns stored: null when nothing is stored', async () => {
		vi.mocked(readStored).mockResolvedValue(null);
		expect(await load(event('tok'))).toEqual({ username: 'TestUser', stored: null });
	});
});
```

- [ ] **Step 2: Write the failing banner test** in `src/lib/components/profile/LoadingBanner.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LoadingBanner from './LoadingBanner.svelte';

const base = { profile: null, items: [], totalItems: 1500, loaded: 400, phase: 'done', background: false, resumeAt: null, asOf: null, error: null, cooldownUntil: null } as any;
const show = (state: object, extra: object = {}) => render(LoadingBanner, { props: { state: { ...base, ...state }, onRetry: () => {}, ...extra } });

describe('LoadingBanner', () => {
	it('renders nothing when done', () => {
		const { container } = show({});
		expect(container.textContent?.trim()).toBe('');
	});
	it('loading', () => {
		show({ phase: 'loading' });
		expect(screen.getByText('Loading collection: 400 of 1500 records…')).toBeInTheDocument();
	});
	it('loading uses the label', () => {
		show({ phase: 'loading' }, { label: 'wantlist' });
		expect(screen.getByText('Loading wantlist: 400 of 1500 records…')).toBeInTheDocument();
	});
	it('waiting counts down from resumeAt', () => {
		vi.useFakeTimers(); vi.setSystemTime(1_000_000);
		show({ phase: 'waiting', resumeAt: 1_020_000 });
		expect(screen.getByText('Discogs is busy — resuming in 20s.')).toBeInTheDocument();
		vi.useRealTimers();
	});
	it('refreshing shows the age of the copy on screen', () => {
		vi.useFakeTimers(); vi.setSystemTime(100 * 3_600_000);
		show({ phase: 'refreshing', background: true, asOf: 93 * 3_600_000 });
		expect(screen.getByText('Showing a copy from 7 hours ago — updating (400 of 1500)…')).toBeInTheDocument();
		vi.useRealTimers();
	});
	it('a network error shows what is on screen and a working Retry', async () => {
		const onRetry = vi.fn();
		show({ phase: 'error', error: { code: 'NETWORK', message: 'x' }, items: new Array(300) }, { onRetry });
		expect(screen.getByRole('alert')).toHaveTextContent("Couldn't reach Discogs — showing 300 of 1500 records.");
		await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		expect(onRetry).toHaveBeenCalled();
	});
	it('cooldown', () => {
		show({ cooldownUntil: Date.now() + 60_000 });
		expect(screen.getByText('Already refreshed in the last 10 minutes.')).toBeInTheDocument();
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run "src/routes/api/collection" "src/routes/u/[username=username]/server.test.ts" src/lib/components/profile/LoadingBanner.test.ts`
Expected: FAIL.

- [ ] **Step 4: Rewrite `src/routes/api/collection/[username=username]/+server.ts`**

```ts
import { makeSyncHandlers } from '$lib/server/syncRoute';

export const { GET, POST } = makeSyncHandlers('collection');
```

- [ ] **Step 5: Rewrite `src/routes/u/[username=username]/+page.server.ts`**

Redirect `303` to `/settings?redirect=/u/${encodeURIComponent(username)}` when there is no `discogs_token` cookie; otherwise return `{ username, stored: await readStored('collection', username, getStore(platform), Date.now()) }`. No `$env` import, no Discogs import.

- [ ] **Step 6: Rewrite `LoadingBanner.svelte`** to the props and copy table above.

- [ ] **Step 7: Rework the script of `src/routes/u/[username=username]/+page.svelte`**

Replace the `items` state, the two loading `$effect`s and `refreshCollection` with:

```ts
const loader = $derived(
	createLoader<DiscogsCollectionItem>({
		kind: 'collection',
		username: data.username,
		initial: data.stored,
		keyOf: (i) => i.instance_id
	})
);
$effect(() => {
	const l = loader;
	randomHighlights = [];
	l.run();
	return () => l.stop();
});
let s = $derived(loader.state);
let items = $derived(s.items);
let stats = $derived(computeCollectionStats(items));
```

Then:
- `profile` and `totalDiscogsItems` come from `s.profile` and `s.totalItems`.
- `randomHighlights` is sampled once, the first time `items` is non-empty.
- An effect sends the visitor to `/settings?redirect=/u/{username}` (via `goto`) when `s.error?.code` is `TOKEN_REQUIRED` or `BAD_TOKEN`.
- Markup, checked in this order: (1) `s.error?.code` is `NOT_FOUND` or `PRIVATE` → `BrandNav`, the exact message above in a `.card` with `role="alert"`, and `SiteFooter`; (2) `s.profile` is set → the existing page with `<LoadingBanner state={s} onRetry={() => loader.run()} />`, and `ProfileHeader` given `refreshing={s.phase === 'refreshing'}` and `onRefresh={() => loader.refresh()}`; (3) otherwise → `BrandNav`, `<LoadingBanner … />` and `<SkeletonProfile />`.
- Meta tags as specified above.

- [ ] **Step 8: Write the e2e test** `e2e/profile.test.ts`

```ts
import { test, expect, type Page } from '@playwright/test';

const item = (n: number) => ({
	id: n, instance_id: n, folder_id: 1, rating: 0, date_added: '2026-01-01T00:00:00-00:00',
	basic_information: { id: n, title: `Album ${n}`, year: 1990, thumb: '', resource_url: '', artists: [{ id: 1, name: 'Artist', resource_url: '' }], labels: [{ id: 1, name: 'Label', catno: '1', resource_url: '' }], formats: [{ name: 'Vinyl', qty: '1' }], genres: ['Rock'], styles: [] }
});
const page = (p: number, count: number) => ({
	status: 'ok', snapshot: 'S1', page: p, totalPages: 2, totalItems: 150, source: 'discogs', stored: true, nextDelayMs: 0,
	items: Array.from({ length: count }, (_, i) => item((p - 1) * 100 + i + 1))
});
const profile = { id: 1, username: 'someuser', avatar_url: '', location: '' };

async function withToken(pw: Page) {
	await pw.context().addCookies([{ name: 'discogs_token', value: 'e2e', url: 'http://localhost:4173' }]);
}

test('renders a profile from the sync API and reports the full record count', async ({ page: pw }) => {
	await withToken(pw);
	await pw.route('**/api/collection/someuser**', async (route) => {
		const req = route.request();
		if (req.method() === 'POST') {
			const body = req.postDataJSON();
			return route.fulfill({ json: body.action === 'start' ? { ...page(1, 100), profile } : { status: 'complete', snapshot: 'S1', completedAt: Date.now() } });
		}
		return route.fulfill({ json: page(2, 50) });
	});
	await pw.goto('/u/someuser');
	await expect(pw.locator('h1')).toHaveText('someuser');
	await expect(pw.locator('#overview')).toContainText('150');
});

test('a wait result shows the busy banner and then recovers', async ({ page: pw }) => {
	await withToken(pw);
	let gets = 0;
	await pw.route('**/api/collection/someuser**', async (route) => {
		const req = route.request();
		if (req.method() === 'POST') {
			const body = req.postDataJSON();
			return route.fulfill({ json: body.action === 'start' ? { ...page(1, 100), profile } : { status: 'complete', snapshot: 'S1', completedAt: Date.now() } });
		}
		return route.fulfill({ json: gets++ === 0 ? { status: 'wait', retryAfterMs: 2000 } : page(2, 50) });
	});
	await pw.goto('/u/someuser');
	await expect(pw.getByText(/Discogs is busy — resuming in \d+s\./)).toBeVisible();
	await expect(pw.locator('#overview')).toContainText('150', { timeout: 10_000 });
	await expect(pw.getByText(/Discogs is busy/)).toHaveCount(0);
});

test('an unknown user gets a plain message', async ({ page: pw }) => {
	await withToken(pw);
	await pw.route('**/api/collection/someuser**', (route) =>
		route.fulfill({ status: 404, json: { status: 'error', code: 'NOT_FOUND', message: 'User not found' } }));
	await pw.goto('/u/someuser');
	await expect(pw.getByRole('alert')).toHaveText('No Discogs user named "someuser".');
});
```

- [ ] **Step 9: Run everything**

Run: `npx vitest run --coverage && npm run check && npm run build && npm run test:e2e`
Expected: all PASS. The existing e2e redirect tests (`smoke.test.ts`, `security.test.ts`) still pass unchanged.

- [ ] **Step 10: Commit**

```bash
git add "src/routes/api/collection" "src/routes/u/[username=username]/+page.server.ts" "src/routes/u/[username=username]/+page.svelte" "src/routes/u/[username=username]/server.test.ts" src/lib/components/profile/LoadingBanner.svelte src/lib/components/profile/LoadingBanner.test.ts e2e/profile.test.ts
git commit -m "feat: serve the profile from stored copies via the sync loader"
```

---

### Task 7: Wantlist on stored copies

**Files:**
- Create: `src/routes/api/wantlist/[username=username]/+server.ts`, `src/routes/api/wantlist/[username=username]/server.test.ts`
- Rewrite: `src/routes/u/[username=username]/wantlist/+page.server.ts`, its `server.test.ts`
- Modify: `src/routes/u/[username=username]/wantlist/+page.svelte`

**Interfaces:**
- Consumes: `makeSyncHandlers`, `readStored`, `getStore`, `createLoader`, `LoadingBanner` (label `'wantlist'`), `SkeletonWantlist`.
- Produces: page data `{ username: string; stored: StoredInitial<DiscogsWantlistItem> | null }`.

**Exact page copy:** `NOT_FOUND`: `No Discogs user named "{username}".` · `PRIVATE`: `{username}'s wantlist is private.`

- [ ] **Step 1: Write the failing tests**

`src/routes/api/wantlist/[username=username]/server.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
const made = vi.hoisted(() => ({ kinds: [] as string[] }));
vi.mock('$lib/server/syncRoute', () => ({
	makeSyncHandlers: (kind: string) => { made.kinds.push(kind); return { GET: 'g', POST: 'p' }; }
}));
import * as route from './+server';

describe('wantlist sync route', () => {
	it('is the wantlist sync handlers and nothing else', () => {
		expect(made.kinds).toEqual(['wantlist']);
		expect(Object.keys(route).sort()).toEqual(['GET', 'POST']);
	});
});
```

`src/routes/u/[username=username]/wantlist/server.test.ts` (replace the whole file):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const err = new Error('redirect') as Error & { status: number; location: string };
		err.status = status; err.location = location; throw err;
	}
}));
vi.mock('$lib/server/sync', () => ({ readStored: vi.fn() }));
vi.mock('$lib/server/store', () => ({ getStore: vi.fn(() => ({ backend: 'memory' })) }));
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import { load } from './+page.server';
import { readStored } from '$lib/server/sync';

const event = (token?: string) => ({
	params: { username: 'TestUser' }, platform: undefined,
	cookies: { get: (n: string) => (n === 'discogs_token' ? token : undefined) }
}) as any;

beforeEach(() => { vi.clearAllMocks(); process.env.DISCOGS_TOKEN = 'server-token-must-be-ignored'; });

describe('wantlist load', () => {
	it('redirects to settings without a token cookie, even when DISCOGS_TOKEN is set, and reads nothing', async () => {
		await expect(load(event())).rejects.toMatchObject({ status: 303, location: '/settings?redirect=/u/TestUser/wantlist' });
		expect(readStored).not.toHaveBeenCalled();
	});
	it('returns the stored wantlist and never calls Discogs', async () => {
		const stored = { snapshot: 'S0', complete: true, firstPage: [] };
		vi.mocked(readStored).mockResolvedValue(stored as any);
		expect(await load(event('tok'))).toEqual({ username: 'TestUser', stored });
		expect(vi.mocked(readStored).mock.calls[0].slice(0, 2)).toEqual(['wantlist', 'TestUser']);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
	it('returns stored: null when nothing is stored', async () => {
		vi.mocked(readStored).mockResolvedValue(null);
		expect(await load(event('tok'))).toEqual({ username: 'TestUser', stored: null });
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run "src/routes/api/wantlist" "src/routes/u/[username=username]/wantlist"`
Expected: FAIL.

- [ ] **Step 3: Implement the route and the load**

`src/routes/api/wantlist/[username=username]/+server.ts`:

```ts
import { makeSyncHandlers } from '$lib/server/syncRoute';

export const { GET, POST } = makeSyncHandlers('wantlist');
```

`wantlist/+page.server.ts`: redirect `303` to `/settings?redirect=/u/${encodeURIComponent(username)}/wantlist` when there is no `discogs_token` cookie; otherwise return `{ username, stored: await readStored('wantlist', username, getStore(platform), Date.now()) }`. No `$env` import, no Discogs import.

- [ ] **Step 4: Rework `wantlist/+page.svelte`**

```ts
const loader = $derived(
	createLoader<DiscogsWantlistItem>({
		kind: 'wantlist',
		username: data.username,
		initial: data.stored,
		keyOf: (i) => i.id
	})
);
$effect(() => {
	const l = loader;
	l.run();
	return () => l.stop();
});
let s = $derived(loader.state);
```

`wantlist` is `s.items`; `profile` is `s.profile`. Keep the search and sort logic as is. The item count line reads `{s.totalItems} items`. Render `<LoadingBanner state={s} label="wantlist" onRetry={() => loader.run()} />` under the header. No profile yet: `SkeletonWantlist`. `NOT_FOUND` / `PRIVATE`: the messages above with `role="alert"`. `TOKEN_REQUIRED` / `BAD_TOKEN`: `goto('/settings?redirect=/u/{username}/wantlist')`. The "hasn't added any items" empty state shows only when `s.phase === 'done'` and `s.totalItems === 0`.

- [ ] **Step 5: Run everything**

Run: `npx vitest run --coverage && npm run check && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/api/wantlist" "src/routes/u/[username=username]/wantlist"
git commit -m "feat: serve the wantlist from stored copies"
```

---

### Task 8: Compare on stored copies

**Files:**
- Create: `src/lib/utils/compare.ts`, `src/lib/utils/compare.test.ts`
- Rewrite: `src/routes/compare/[user1=username]/[user2=username]/+page.server.ts`, its `server.test.ts`
- Modify: `src/routes/compare/[user1=username]/[user2=username]/+page.svelte`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/utils/compare.ts
  export interface Comparison {
  	overlap: DiscogsCollectionItem[];
  	uniqueTo1: DiscogsCollectionItem[];   // first UNIQUE_RECORDS_PREVIEW
  	uniqueTo2: DiscogsCollectionItem[];
  	overlapCount: number;
  	similarityScore: number;              // round(Jaccard * 100)
  	sharedArtistsCount: number;
  	sharedArtists: string[];              // first SHARED_ARTISTS_PREVIEW
  	genres1: Record<string, number>;
  	genres2: Record<string, number>;
  	sharedGenres: string[];
  	genreOverlap: Array<{ genre: string; count1: number; count2: number }>; // top GENRE_OVERLAP_LIMIT
  	decades1: Record<string, number>;
  	decades2: Record<string, number>;
  }
  export function compareCollections(items1: DiscogsCollectionItem[], items2: DiscogsCollectionItem[]): Comparison;
  ```
  Page data: `{ user1: { username: string; stored: StoredInitial<DiscogsCollectionItem> | null }; user2: { … } }`.

- [ ] **Step 1: Write the failing util test** in `src/lib/utils/compare.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { compareCollections } from './compare';

const rec = (id: number, o: { master?: number; title?: string; artist?: string; genres?: string[]; year?: number } = {}) => ({
	id, instance_id: id, folder_id: 1, rating: 0, date_added: '',
	basic_information: {
		id, master_id: o.master, title: o.title ?? `T${id}`, year: o.year ?? 0, thumb: '', resource_url: '',
		artists: [{ id: 1, name: o.artist ?? 'A', resource_url: '' }], labels: [], formats: [], genres: o.genres ?? [], styles: []
	}
}) as any;

describe('compareCollections', () => {
	it('matches by master_id, and by cleaned artist + title when there is no master', () => {
		const c = compareCollections(
			[rec(1, { master: 10 }), rec(2, { title: 'Blue', artist: 'Joni (2)' }), rec(3, { title: 'Only1' })],
			[rec(4, { master: 10 }), rec(5, { title: 'blue ', artist: 'joni' }), rec(6, { title: 'Only2' })]
		);
		expect(c.overlapCount).toBe(2);
		expect(c.uniqueTo1.map((i) => i.id)).toEqual([3]);
		expect(c.uniqueTo2.map((i) => i.id)).toEqual([6]);
		expect(c.similarityScore).toBe(50); // 2 shared of 4 distinct albums
	});
	it('counts duplicates of one album once', () => {
		expect(compareCollections([rec(1, { master: 10 }), rec(2, { master: 10 })], [rec(3, { master: 10 })]).overlapCount).toBe(1);
	});
	it('caps unique previews at 20 and shared artists at 10', () => {
		const many = (from: number) => Array.from({ length: 30 }, (_, i) => rec(from + i, { title: `X${from + i}`, artist: `Artist ${i}` }));
		const c = compareCollections(many(1), many(1000));
		expect(c.uniqueTo1).toHaveLength(20);
		expect(c.uniqueTo2).toHaveLength(20);
		expect(c.sharedArtistsCount).toBe(30);
		expect(c.sharedArtists).toHaveLength(10);
	});
	it('builds genre overlap sorted by combined count, and decade counts ignoring year 0', () => {
		const c = compareCollections(
			[rec(1, { genres: ['Rock', 'Jazz'], year: 1975 }), rec(2, { genres: ['Rock'], year: 0 })],
			[rec(3, { genres: ['Jazz'], year: 1981 })]
		);
		expect(c.genreOverlap).toEqual([{ genre: 'Rock', count1: 2, count2: 0 }, { genre: 'Jazz', count1: 1, count2: 1 }]);
		expect(c.sharedGenres).toEqual(['Jazz']);
		expect(c.decades1).toEqual({ '1970s': 1 });
		expect(c.decades2).toEqual({ '1980s': 1 });
	});
	it('two empty collections: zero score, no division by zero', () => {
		expect(compareCollections([], [])).toMatchObject({ overlapCount: 0, similarityScore: 0, overlap: [] });
	});
});
```

- [ ] **Step 2: Write the failing load test** (replace `server.test.ts` beside the compare route)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const err = new Error('redirect') as Error & { status: number; location: string };
		err.status = status; err.location = location; throw err;
	}
}));
vi.mock('$lib/server/sync', () => ({ readStored: vi.fn() }));
vi.mock('$lib/server/store', () => ({ getStore: vi.fn(() => ({ backend: 'memory' })) }));
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import { load } from './+page.server';
import { readStored } from '$lib/server/sync';

const event = (token?: string) => ({
	params: { user1: 'UserA', user2: 'UserB' }, platform: undefined,
	cookies: { get: (n: string) => (n === 'discogs_token' ? token : undefined) }
}) as any;

beforeEach(() => { vi.clearAllMocks(); process.env.DISCOGS_TOKEN = 'server-token-must-be-ignored'; });

describe('compare load', () => {
	it('redirects to settings without a token cookie and reads nothing', async () => {
		await expect(load(event())).rejects.toMatchObject({ status: 303, location: '/settings?redirect=/compare/UserA/UserB' });
		expect(readStored).not.toHaveBeenCalled();
	});
	it('returns both stored copies and never calls Discogs', async () => {
		vi.mocked(readStored).mockImplementation(async (_kind, username) => ({ snapshot: `S-${username}` }) as any);
		expect(await load(event('tok'))).toEqual({
			user1: { username: 'UserA', stored: { snapshot: 'S-UserA' } },
			user2: { username: 'UserB', stored: { snapshot: 'S-UserB' } }
		});
		expect(vi.mocked(readStored).mock.calls.map((c) => c.slice(0, 2))).toEqual([['collection', 'UserA'], ['collection', 'UserB']]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
	it('passes null through for a user with nothing stored', async () => {
		vi.mocked(readStored).mockResolvedValue(null);
		expect(await load(event('tok'))).toEqual({ user1: { username: 'UserA', stored: null }, user2: { username: 'UserB', stored: null } });
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/utils/compare.test.ts "src/routes/compare"`
Expected: FAIL.

- [ ] **Step 4: Create `src/lib/utils/compare.ts`** by moving the comparison logic out of the current loader (everything between `Promise.all` and the `return`, plus the `comparison` object), unchanged in behaviour.

- [ ] **Step 5: Rewrite the compare load** to the token check plus two `readStored('collection', …, getStore(platform), Date.now())` calls. No `$env` import, no Discogs import. (The spec says the load reads the two meta records only; `readStored` also reads each page 1 so the shared loader can start from it. Still no Discogs call.)

- [ ] **Step 6: Rework the compare page**

Two loaders, `loader1` for `data.user1` and `loader2` for `data.user2`, each built as:

```ts
const loader1 = $derived(
	createLoader<DiscogsCollectionItem>({
		kind: 'collection',
		username: data.user1.username,
		initial: data.user1.stored,
		keyOf: (i) => i.instance_id,
		autoRefresh: false
	})
);
let s1 = $derived(loader1.state);
```

One effect runs them strictly in sequence so the two never call Discogs at once:

```ts
$effect(() => {
	const a = loader1, b = loader2;
	(async () => {
		await a.run();
		await b.run();
		await a.refreshIfStale();
		await b.refreshIfStale();
	})();
	return () => { a.stop(); b.stop(); };
});
const settled = (p: LoaderPhase) => p === 'done' || p === 'refreshing';
let comparison = $derived(
	settled(s1.phase) && settled(s2.phase) ? compareCollections(s1.items, s2.items) : null
);
```

`user1.profile`, `user1.totalItems` come from `s1`. While `comparison` is null, render `BrandNav` and one `<LoadingBanner state={sN} label="{username}'s collection" …/>` per user; once it exists render the existing results markup plus the banners (so a background re-sync is visible). Errors: `NOT_FOUND` → `No Discogs user named "{username}".`; `PRIVATE` → `{username}'s collection is private.`; `TOKEN_REQUIRED` / `BAD_TOKEN` → `goto('/settings?redirect=/compare/{u1}/{u2}')`.

- [ ] **Step 7: Run everything**

Run: `npx vitest run --coverage && npm run check && npm run build && npm run test:e2e`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils/compare.ts src/lib/utils/compare.test.ts "src/routes/compare"
git commit -m "feat: compare from stored copies, computed in the browser"
```

---

### Task 9: Value estimate and value history

**Files:**
- Modify: `src/routes/api/value/[username=username]/+server.ts`, its `server.test.ts`
- Modify: `src/routes/api/value-history/[username=username]/+server.ts`, its `server.test.ts`
- Modify: `src/lib/utils/array.ts`, `src/lib/utils/array.test.ts`
- Modify: `src/lib/components/ValueEstimate.svelte`, `src/lib/components/ValueEstimate.test.ts`

**Interfaces:**
- Consumes: `getStore` (Task 1); `discogsGet`, `DiscogsAPIError` (Task 2); `PRICE_TTL_SECONDS`, `PACE_MS` (Task 2).
- Produces:
  - `export function evenSample<T>(array: T[], n: number): T[]` in `src/lib/utils/array.ts`: `count = min(max(n, 0), array.length)`; element `i` is `array[Math.floor((i * array.length) / count)]`.
  - `POST /api/value/[username]` response gains optional `retryAfterMs: number`, present only when the loop stopped on a 429. Results then cover only the ids processed before the stop.

**Value endpoint behaviour:**
- Token: `cookies.get('discogs_token')` only; otherwise 401. Remove the `x-discogs-token` header and `env` fallbacks, the `$env` import, the in-memory LRU and the `rateLimitChain`.
- Prices: store key `price:{releaseId}`, TTL `PRICE_TTL_SECONDS`; a stored price is used when `now - timestamp < PRICE_TTL_SECONDS * 1000`.
- Uncached ids are fetched one at a time with `discogsGet('/marketplace/price_suggestions/{id}', …)`, sleeping `PACE_MS` before each call except the first.
- A `RATE_LIMITED` error stops the loop: return what is priced so far plus `retryAfterMs` from the error. Any other failure counts in `failedCount` with a null price, as today.

**Value history:** `requireToken` checks the cookie only; reads and writes go through `getStore(platform)`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/utils/array.test.ts`:

```ts
describe('evenSample', () => {
	it('picks evenly spaced elements, the same ones every time', () => {
		const a = Array.from({ length: 100 }, (_, i) => i);
		expect(evenSample(a, 4)).toEqual([0, 25, 50, 75]);
		expect(evenSample(a, 4)).toEqual(evenSample(a, 4));
	});
	it('returns everything when n exceeds the length, and [] for n <= 0 or an empty array', () => {
		expect(evenSample([1, 2, 3], 20)).toEqual([1, 2, 3]);
		expect(evenSample([1, 2, 3], 0)).toEqual([]);
		expect(evenSample([], 5)).toEqual([]);
	});
});
```

In `src/routes/api/value/[username=username]/server.test.ts`: delete `uses env DISCOGS_TOKEN as fallback` and `prefers the discogs_token cookie over the env token`; change every event helper to pass the token as the `discogs_token` cookie; replace the `$lib/server/cache` mock with the real store (`resetMemoryStoreForTests()` in `beforeEach`); then add:

```ts
it('401 without a token cookie even when DISCOGS_TOKEN and an x-discogs-token header are present', async () => {
	process.env.DISCOGS_TOKEN = 'server';
	await expect(POST(makeEvent({ cookieToken: undefined, headers: { 'x-discogs-token': 'hdr' }, releaseIds: [1] }))).rejects.toMatchObject({ status: 401 });
	expect(fetch).not.toHaveBeenCalled();
});
it('stops at the first 429 and returns the partial result with retryAfterMs', async () => {
	vi.mocked(fetch)
		.mockResolvedValueOnce(new Response(JSON.stringify({ 'Near Mint (NM or M-)': { currency: 'USD', value: 10 } })))
		.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '9' } }));
	const p = POST(makeEvent({ cookieToken: 'tok', releaseIds: [1, 2, 3] }));
	await vi.runAllTimersAsync();
	const body = await (await p).json();
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(body).toMatchObject({ retryAfterMs: 9000, totalRequested: 3, pricedCount: 1, totalValue: 10 });
	expect(body.results.map((r: any) => r.releaseId)).toEqual([1]);
});
it('uses a price stored within 6 hours without fetching, and refetches one older than 6 hours', async () => {
	const store = getStore(undefined);
	await store.putJSON('price:1', { lowestPrice: 5, currency: 'USD', timestamp: Date.now() - (6 * 3_600_000 - 1000) }, 99999);
	await store.putJSON('price:2', { lowestPrice: 5, currency: 'USD', timestamp: Date.now() - 6 * 3_600_000 }, 99999);
	vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ 'Near Mint (NM or M-)': { currency: 'USD', value: 8 } })));
	const p = POST(makeEvent({ cookieToken: 'tok', releaseIds: [1, 2] }));
	await vi.runAllTimersAsync();
	const body = await (await p).json();
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(body.totalValue).toBe(13);
});
```

(Adapt `makeEvent` and timer handling to the helpers already in that file; it already uses fake timers for the pacing delay.)

In the value-history `server.test.ts`: add `401 on GET and POST when only DISCOGS_TOKEN is set (no cookie)`; switch the cache mock to the real memory store.

In `src/lib/components/ValueEstimate.test.ts` add:

```ts
it('requests the same release ids on every mount, regardless of item order', async () => {
	const bodies: string[] = [];
	vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
		if (url.includes('/api/value/')) bodies.push(init!.body as string);
		return { ok: true, json: async () => ({ totalValue: 0, pricedCount: 0, totalRequested: 20, currency: 'USD', results: [], history: [] }) } as any;
	}));
	for (const list of [makeItems(200), makeItems(200).reverse()]) {
		const { unmount } = render(ValueEstimate, { props: { items: list, username: 'u' } });
		await fireEvent.click(screen.getByRole('button'));
		await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));
		unmount();
	}
	expect(bodies[0]).toBe(bodies[1]);
	expect(JSON.parse(bodies[0]).releaseIds).toHaveLength(20);
});
it('a partial estimate says so and is not recorded in value history', async () => {
	const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ totalValue: 30, pricedCount: 3, totalRequested: 20, currency: 'USD', retryAfterMs: 30000, results: [] }) }) as any);
	vi.stubGlobal('fetch', fetchMock);
	render(ValueEstimate, { props: { items: makeItems(200), username: 'u' } });
	await fireEvent.click(screen.getByRole('button'));
	expect(await screen.findByText('Discogs is busy — this is a partial estimate. Try again in a minute.')).toBeInTheDocument();
	expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/value-history/'))).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/utils/array.test.ts "src/routes/api/value" "src/routes/api/value-history" src/lib/components/ValueEstimate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `evenSample`; the value endpoint changes; the value-history gate; and in `ValueEstimate.svelte`: sample with `evenSample([...items].sort((a, b) => a.instance_id - b.instance_id), 20)`, show the exact partial-estimate text when the response has `retryAfterMs`, and skip the value-history POST in that case.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run --coverage && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/array.ts src/lib/utils/array.test.ts "src/routes/api/value" "src/routes/api/value-history" src/lib/components/ValueEstimate.svelte src/lib/components/ValueEstimate.test.ts
git commit -m "feat: stable value sample, 6-hour prices, visitor token only"
```

---

### Task 10: Widget from the store; remove the server token and dead code

**Files:**
- Modify: `src/routes/api/widget/+server.ts`, its `server.test.ts`
- Modify: `src/hooks.server.ts`, `.env.example`, `src/lib/api/discogs.ts`, `src/lib/api/discogs.test.ts`, `src/lib/types/discogs.ts`, `src/lib/constants.ts`
- Delete: `src/lib/server/cache.ts`, `src/lib/server/cache.test.ts`

**Interfaces:**
- Consumes: `getStore`, `metaKey`, `SnapshotMeta`.
- Produces: `GET /api/widget` keeps its response shape (`appName`, `icon`, `url`, `items`, `updatedAt`) and headers (`cache-control: public, max-age=300`, `access-control-allow-origin: *`).

**Widget behaviour:**
- Username: `env.WIDGET_USERNAME || 'pottejd'` (this `$env` read stays; it is not a token).
- One store read: `getJSON<SnapshotMeta>(metaKey('collection', username))`. No Discogs call, no store write.
- `meta.current` present: items are `{ label: 'Collection', value: '{totalItems} records', type: 'highlight' }` then up to three `{ label: 'Recent', value: '{artist} - {title}', type: 'secondary' }` from `meta.recent`.
- Otherwise: `[{ label: 'Status', value: 'Not loaded yet', type: 'secondary' }]`.
- `url` is the request's origin.

- [ ] **Step 1: Write the failing widget tests** (replace the tests in `src/routes/api/widget/server.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import { GET } from './+server';
import { getStore, resetMemoryStoreForTests } from '$lib/server/store';
import { metaKey } from '$lib/server/sync';

const event = () => ({ platform: undefined, url: new URL('https://shelf.example/api/widget') }) as any;

beforeEach(() => { resetMemoryStoreForTests(); vi.clearAllMocks(); for (const k of Object.keys(mockEnv)) delete mockEnv[k]; mockEnv.DISCOGS_TOKEN = 'must-be-ignored'; });

describe('widget endpoint', () => {
	it('builds from the stored meta with no Discogs call and no store write', async () => {
		const store = getStore(undefined);
		await store.putJSON(metaKey('collection', 'pottejd'), {
			profile: {}, pending: null,
			current: { id: '1', totalItems: 1234, totalPages: 13, startedAt: 1, completedAt: 2 },
			recent: [{ artist: 'A', title: 'One' }, { artist: 'B', title: 'Two' }, { artist: 'C', title: 'Three' }]
		}, 60);
		const put = vi.spyOn(store, 'putJSON');
		const res = await GET(event());
		const body = await res.json();
		expect(body.items).toEqual([
			{ label: 'Collection', value: '1234 records', type: 'highlight' },
			{ label: 'Recent', value: 'A - One', type: 'secondary' },
			{ label: 'Recent', value: 'B - Two', type: 'secondary' },
			{ label: 'Recent', value: 'C - Three', type: 'secondary' }
		]);
		expect(body.url).toBe('https://shelf.example');
		expect(res.headers.get('access-control-allow-origin')).toBe('*');
		expect(res.headers.get('cache-control')).toBe('public, max-age=300');
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(put).not.toHaveBeenCalled();
	});
	it('says "Not loaded yet" when nothing is stored, still without calling Discogs', async () => {
		const body = await (await GET(event())).json();
		expect(body.items).toEqual([{ label: 'Status', value: 'Not loaded yet', type: 'secondary' }]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
	it('uses WIDGET_USERNAME when set', async () => {
		mockEnv.WIDGET_USERNAME = 'Other';
		await getStore(undefined).putJSON(metaKey('collection', 'other'), { profile: {}, pending: null, recent: [], current: { id: '1', totalItems: 5, totalPages: 1, startedAt: 1, completedAt: 2 } }, 60);
		expect((await (await GET(event())).json()).items[0].value).toBe('5 records');
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run "src/routes/api/widget"`
Expected: FAIL.

- [ ] **Step 3: Implement the widget change.**

- [ ] **Step 4: Remove the server token and dead code**

- `src/hooks.server.ts`: delete the `if (!env.DISCOGS_TOKEN)` warning block. Keep the `ORIGIN` check.
- `.env.example`: delete the `DISCOGS_TOKEN` comment block and the mention of it on the `docker run` line.
- `src/lib/api/discogs.ts`: delete `fetchDiscogs`, `fetchUserProfile`, `fetchCollectionPage`, `fetchUserCollection`, `fetchUserWantlist`, `fetchFullUserCollection`, `MAX_RETRIES`, `BASE_DELAY_MS`. Keep `DiscogsAPIError`, `computeCollectionStats` and the Task 2 additions.
- `src/lib/api/discogs.test.ts`: delete the `fetch functions` describe block (its cases are covered by `discogsGet` and `fetchListPage`).
- `src/lib/types/discogs.ts`: delete `UserCollection` and `CachedCollection`.
- `src/lib/constants.ts`: delete `CACHE_TTL_MS`, `CACHE_TTL_SECONDS`, `CACHE_STALE_TTL_MS`, `CACHE_STALE_TTL_SECONDS`.
- Delete `src/lib/server/cache.ts` and `src/lib/server/cache.test.ts`.

- [ ] **Step 5: Verify nothing reads the server token or the old cache**

Run: `grep -rn "DISCOGS_TOKEN" src .env.example; grep -rn "server/cache\|fetchFullUserCollection\|fetchUserWantlist\|waitUntil" src --include="*.ts" --include="*.svelte" | grep -v "service-worker"`
Expected: the first command prints only lines in `*.test.ts` files (tests that set it to prove it is ignored); the second prints nothing.

- [ ] **Step 6: Run everything on both targets**

Run: `npx vitest run --coverage && npm run check && npm run build && npm run test:e2e && ADAPTER=node npm run build`
Expected: all PASS; coverage stays above the 30% thresholds.

- [ ] **Step 7: Commit**

```bash
git add -A src .env.example
git commit -m "feat: widget reads the stored copy; remove server token and old cache"
```

---

### Task 11: Bind the store and roll out (needs the owner)

This task needs the owner's Cloudflare login and their own token in a browser. Do not start it without them.

**Files:**
- Modify: `wrangler.toml`, `package.json` (version)

- [ ] **Step 1: Owner logs in**

Owner runs: `! npx wrangler login`

- [ ] **Step 2: Capture the live project settings in a scratch folder**

Run (from a scratch directory, not the repo): `npx wrangler pages download config record-shelf`
Expected: a `wrangler.toml` showing the live settings. Confirm there is no `DISCOGS_TOKEN` variable. If there is one, the owner deletes it in the dashboard (Workers & Pages → record-shelf → Settings → Variables and Secrets).

- [ ] **Step 3: Find or create the KV namespace**

Run: `npx wrangler kv namespace list`
If none is named for this app: `npx wrangler kv namespace create COLLECTION_CACHE`
Expected: a namespace id.

- [ ] **Step 4: Declare the binding** by appending to the repo's `wrangler.toml`, with the real id:

```toml
[[kv_namespaces]]
binding = "COLLECTION_CACHE"
id = "<the namespace id from Step 3>"
```

- [ ] **Step 5: Bump the version** in `package.json` from `0.10.18` to `0.11.0`.

- [ ] **Step 6: Build, test, commit**

Run: `npx vitest run && npm run check && npm run build`
Expected: PASS.

```bash
git add wrangler.toml package.json
git commit -m "chore: bind COLLECTION_CACHE and bump to 0.11.0"
```

- [ ] **Step 7: Deploy** (owner confirms first)

Run: `npx wrangler pages deploy .svelte-kit/cloudflare`

- [ ] **Step 8: Verify on the live site with the owner**

1. Open `/api/status`. Expected: `"store":"kv"`.
2. In a private window open `/`. Expected: lands on Settings.
3. In the owner's normal browser, with the network tab open, open their profile. Expected: one `POST` (start) answering `"source":"discogs","stored":true`, then `GET` requests about a second apart, then a `POST` answering `"status":"complete"`.
4. Reload. Expected: every response says `"source":"store"`.
5. Open `/api/widget`. Expected: the record count and three recent titles.

**If step 3 shows `"stored":false` for a collection the owner knows is public:** stop. Discogs is not serving that list without a token, so the visibility check needs the fallback described in the spec under "Only public collections are stored" (store only when the token's own username, from `/oauth/identity`, differs from the requested one). Report this to the owner before changing anything.

---

## Amendment (2026-11-14): Option A — the browser calls Discogs

See the amendment at the end of the design spec for why and what. Built in one
pass, tests first, after Tasks 1–10; it replaces the Discogs-calling parts of
Tasks 2, 3 and 9.

- [x] `src/lib/sync/types.ts` — new wire contract: `start` answers `fresh` /
  `cooldown` / `ok` (join) / `open`; `GET` answers `ok` / `missing`; new
  `page` (hand a page over) and `drop` actions. No `wait`, `source`,
  `stored` or `nextDelayMs`. Expiry 30 days.
- [x] `src/lib/server/sync.ts`, `syncRoute.ts` — store only. `storePage`
  applies the allowlist and the bounds; `dropStored` removes a copy.
- [x] `src/lib/api/discogs.ts` — the browser's Discogs client: token in the
  query string, one shared paced queue, `UNREACHABLE` / `RATE_LIMITED` = busy.
- [x] `src/lib/sync/engine.ts` — makes the Discogs calls (public check, page 1,
  profile, pages), hands pages over, waits 30 s then 60 s while Discogs is busy.
- [x] Settings asks Discogs directly (`checkToken`); `/api/test-token` removed.
- [x] `src/lib/value/estimate.ts` — the value estimate in the browser, prices
  remembered in localStorage for six hours; `/api/value` removed.
- [x] `/api/status` no longer reports a rate-limit reading.
- [x] Tests: unit, the engine + client + handlers integration test, and e2e
  with both `/api/*` and `api.discogs.com` stubbed.

### Task 11, Step 8 under Option A (replaces the old Step 8)

1. Open `/api/status`. Expected: `"store":"kv"`.
2. In a private window open `/`. Expected: lands on Settings.
3. Settings → Test Token with the owner's token. Expected: "Connected as: …".
   In the network tab: one `GET` to `api.discogs.com/oauth/identity`, no
   `OPTIONS` request.
4. Open the owner's profile with the network tab open. Expected: a `POST`
   answering `"status":"open"`; then requests to `api.discogs.com` about a
   second apart (the first with no token); after each page a `POST` to
   `/api/collection/<user>` answering `"status":"stored"`; last a `POST`
   answering `"status":"complete"`.
5. Reload. Expected: no request to `api.discogs.com`; `GET`s to
   `/api/collection/<user>` answering `"status":"ok"`.
6. Open `/api/widget`. Expected: the record count and three recent titles.

**Stop and report if**, for a collection the owner knows is public, step 4
shows a `POST` with `"action":"drop"` (Discogs refused the tokenless check) or
`"status":"unstored"` on page 1 (a store write failed: tail the logs).

### Added the same day: only listed writers may write ("go stronger")

- [x] `src/lib/server/writers.ts` — `STORE_WRITERS` holds SHA-256 fingerprints
  of the tokens that may write; `isWriter(token)`; fails closed and logs once
  when unset.
- [x] `sync.ts` / `syncRoute.ts` — `deps.writer`: `start` answers
  `open` with `store: true|false`; `storePage` answers `unstored` and
  `dropStored` answers `refused` for anyone else. `complete` and reads stay open
  to any token cookie.
- [x] `/api/value-history` POST records only for a writer (`recorded`).
- [x] `/api/status` adds `writers` (count), and for the visitor `writer` and
  `fingerprint` (of their own token).
- [x] Engine: no public check and no handover when `store` is false.
- [x] Checked in Cloudflare's runtime locally (`wrangler pages dev` with
  `--kv COLLECTION_CACHE --binding STORE_WRITERS=…`, made-up tokens).

**Task 11 gains two steps, and Step 8 two checks:**

- After the first deploy (Step 7), with the owner's token saved in Settings on
  the live site, open `/api/status` and copy the `fingerprint` value. Expected
  at this point: `"writers":0,"writer":false`.
- Set it as a secret, then deploy again (a Pages secret takes effect on the
  next deployment):
  `npx wrangler pages secret put STORE_WRITERS` (paste the fingerprint at the
  prompt; add `--project record-shelf` if it asks which project).
- Step 8.1 also expects `"writers":1,"writer":true` in the owner's browser.
- Step 8.4's first `POST` must answer `"status":"open"` with `"store":true`. If
  it says `"store":false`, the secret is missing, mistyped, or not yet
  deployed: nothing will be stored. Stop and fix that first.
- Friends who paste the owner's token are writers. A visitor using a token of
  their own sees their list but it is not stored; to let one store, add their
  fingerprint to `STORE_WRITERS` (comma-separated).
