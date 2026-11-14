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

beforeEach(() => { vi.restoreAllMocks(); resetMemoryStoreForTests(); now = T0; });

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
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		for (const [err, code] of [
			[new DiscogsAPIError('x', 404, 'NOT_FOUND'), 'NOT_FOUND'],
			[new Error('boom'), 'UPSTREAM']
		] as const) {
			const deps = makeDeps(); deps.discogs.listPage.mockRejectedValue(err);
			expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'error', code });
		}
		// Only the unexpected Error is logged, and never with the token.
		expect(logged).toHaveBeenCalledTimes(1);
		expect(logged.mock.calls[0].map(String).join(' ')).not.toContain('tok');
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
		it('drops a dead current snapshot so readStored falls through to the new pending one', async () => {
			const deps = makeDeps(); await completed(deps);
			await deps.store.delete(pageKey('collection', 'u', SNAP, 1));
			now = T0 + 60 * 60_000;
			const next = snapshotIdAt(now);
			expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'ok', snapshot: next });
			const meta: any = await deps.store.getJSON(metaKey('collection', 'u'));
			expect(meta.current).toBeNull();
			expect(meta.pending.id).toBe(next);
			expect(await readStored('collection', 'u', deps.store, now)).toMatchObject({ complete: false, snapshot: next });
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
