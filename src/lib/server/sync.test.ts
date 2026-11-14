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
		vi.spyOn(console, 'warn').mockImplementation(() => {});
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
		const boom = new Error('boom');
		for (const [err, code] of [
			[new DiscogsAPIError('x', 404, 'NOT_FOUND'), 'NOT_FOUND'],
			[boom, 'UPSTREAM']
		] as const) {
			const deps = makeDeps(); deps.discogs.listPage.mockRejectedValue(err);
			expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'error', code });
		}
		// Only the unexpected Error is logged: exactly the prefix and the error, nothing else.
		expect(logged).toHaveBeenCalledTimes(1);
		expect(logged.mock.calls[0]).toHaveLength(2);
		expect(logged.mock.calls[0][0]).toBe('[record-shelf] sync: unexpected error');
		expect(logged.mock.calls[0][1]).toBe(boom);
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
	it('joining a stored page 1 that has no profile returns the profile from meta', async () => {
		const deps = makeDeps(); publicList(deps);
		await startSync('collection', 'TestUser', 'tok', false, deps);
		const meta: any = await deps.store.getJSON(metaKey('collection', 'TestUser'));
		const key = pageKey('collection', 'TestUser', SNAP, 1);
		const { profile: _p, startedAt: _s, ...bare }: any = await deps.store.getJSON(key);
		await deps.store.putJSON(key, bare, 60);
		deps.discogs.listPage.mockClear();
		const r: any = await startSync('collection', 'TestUser', 'tok', false, deps);
		expect(r).toMatchObject({ status: 'ok', source: 'store', profile: meta.profile });
		expect(deps.discogs.listPage).not.toHaveBeenCalled();
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
		it('trusts meta.current as recorded: page 1 gone still gives fresh, no Discogs call, current kept', async () => {
			const deps = makeDeps(); await completed(deps);
			await deps.store.delete(pageKey('collection', 'u', SNAP, 1));
			now = T0 + 60 * 60_000;
			expect(await startSync('collection', 'u', 'tok', false, deps)).toEqual({ status: 'fresh', snapshot: SNAP });
			expect(deps.discogs.listPage).not.toHaveBeenCalled();
			const meta: any = await deps.store.getJSON(metaKey('collection', 'u'));
			expect(meta.current).toMatchObject({ id: SNAP });
		});
		it('a new snapshot carries current forward unchanged', async () => {
			const deps = makeDeps(); await completed(deps);
			await deps.store.delete(pageKey('collection', 'u', SNAP, 1));
			now = T0 + FRESH_MS;
			expect(await startSync('collection', 'u', 'tok', false, deps)).toMatchObject({ status: 'ok', source: 'discogs' });
			const meta: any = await deps.store.getJSON(metaKey('collection', 'u'));
			expect(meta.current).toMatchObject({ id: SNAP, completedAt: T0 });
		});
	});
});

describe('a list seen to be not public loses its stored copy, whoever visits (F1)', () => {
	type Deps = ReturnType<typeof makeDeps>;
	const privateErr = () => new DiscogsAPIError('private', 403, 'PRIVATE');
	const removedLine = ['[record-shelf] sync: removed stored copy', 'collection', 'testuser'];
	/** A completed copy of a one-page list, 6 h old, so the next start probes Discogs. */
	async function storedCopy(deps: Deps) {
		publicList(deps, 1, 40);
		await startSync('collection', 'TestUser', 'tok', false, deps);
		await completeSync('collection', 'TestUser', SNAP, deps);
		now = T0 + FRESH_MS;
	}
	/** The tokenless probe and the authenticated calls answer as given (null: success). */
	function answers(deps: Deps, probe: Error | null, authed: Error | null, onAuthed: () => Promise<void> = async () => {}) {
		deps.discogs.listPage.mockReset();
		deps.discogs.profile.mockClear();
		deps.discogs.listPage.mockImplementation(async (_k, _u, page, _pp, token) => {
			if (token === undefined) {
				if (probe) throw probe;
				return pageOf(1, 40, 40, 1);
			}
			await onAuthed();
			if (authed) throw authed;
			return pageOf(page, 1, 40, 40);
		});
	}
	const metaOf = (deps: Deps) => deps.store.getJSON<any>(metaKey('collection', 'TestUser'));

	it('non-owner token: probe and page 1 both PRIVATE → the copy is removed first and the result is PRIVATE', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const deps = makeDeps(); await storedCopy(deps);
		const metaAtAuthedCall: unknown[] = [];
		answers(deps, privateErr(), privateErr(), async () => { metaAtAuthedCall.push(await metaOf(deps)); });
		expect(await startSync('collection', 'TestUser', 'friend-token', false, deps)).toMatchObject({ status: 'error', code: 'PRIVATE' });
		expect(metaAtAuthedCall).toEqual([null]);
		expect(await metaOf(deps)).toBeNull();
		expect(await deps.store.listKeys('v2:collection:testuser:')).toEqual([]);
		expect(warn.mock.calls).toEqual([removedLine]);
	});
	it('a probe answering BAD_TOKEN (401) is treated as not public and removes the copy', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const deps = makeDeps(); await storedCopy(deps);
		answers(deps, new DiscogsAPIError('bad', 401, 'BAD_TOKEN'), privateErr());
		expect(await startSync('collection', 'TestUser', 'friend-token', false, deps)).toMatchObject({ status: 'error', code: 'PRIVATE' });
		expect(await deps.store.listKeys('v2:collection:testuser:')).toEqual([]);
		expect(warn.mock.calls).toEqual([removedLine]);
	});
	it('meta with both current and pending: the pages of both snapshots are removed', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const deps = makeDeps(); await storedCopy(deps);
		const next = snapshotIdAt(now);
		await startSync('collection', 'TestUser', 'tok', false, deps);
		now += SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS; // pending has closed, so the next start probes
		expect(await metaOf(deps)).toMatchObject({ current: { id: SNAP }, pending: { id: next } });
		expect(await deps.store.getJSON(pageKey('collection', 'TestUser', next, 1))).not.toBeNull();
		answers(deps, privateErr(), privateErr());
		expect(await startSync('collection', 'TestUser', 'friend-token', false, deps)).toMatchObject({ status: 'error', code: 'PRIVATE' });
		expect(await deps.store.getJSON(pageKey('collection', 'TestUser', SNAP, 1))).toBeNull();
		expect(await deps.store.getJSON(pageKey('collection', 'TestUser', next, 1))).toBeNull();
		expect(await deps.store.listKeys('v2:collection:testuser:')).toEqual([]);
		expect(warn.mock.calls).toEqual([removedLine]);
	});
	it('a probe answering NOT_FOUND removes the copy and returns NOT_FOUND without an authenticated call', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const deps = makeDeps(); await storedCopy(deps);
		answers(deps, new DiscogsAPIError('gone', 404, 'NOT_FOUND'), null);
		expect(await startSync('collection', 'TestUser', 'tok', false, deps)).toMatchObject({ status: 'error', code: 'NOT_FOUND' });
		expect(deps.discogs.listPage).toHaveBeenCalledTimes(1);
		expect(deps.discogs.profile).not.toHaveBeenCalled();
		expect(await deps.store.listKeys('v2:collection:testuser:')).toEqual([]);
		expect(warn.mock.calls).toEqual([removedLine]);
	});
	it('without meta nothing is deleted: no delete or listKeys call, nothing logged', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const probe of [privateErr(), new DiscogsAPIError('bad', 401, 'BAD_TOKEN'), new DiscogsAPIError('gone', 404, 'NOT_FOUND')]) {
			const deps = makeDeps();
			const del = vi.spyOn(deps.store, 'delete');
			const list = vi.spyOn(deps.store, 'listKeys');
			answers(deps, probe, null);
			await startSync('collection', 'TestUser', 'owner-token', false, deps);
			expect(del).not.toHaveBeenCalled();
			expect(list).not.toHaveBeenCalled();
			del.mockRestore(); list.mockRestore();
		}
		expect(warn).not.toHaveBeenCalled();
	});
	it('a rate-limited or failed probe removes nothing', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const [probe, status] of [[rateLimited(), 'wait'], [new DiscogsAPIError('down', 502, 'UPSTREAM_ERROR'), 'error']] as const) {
			const deps = makeDeps(); await storedCopy(deps);
			const before = await metaOf(deps);
			answers(deps, probe, null);
			expect(await startSync('collection', 'TestUser', 'tok', false, deps)).toMatchObject({ status });
			expect(await metaOf(deps)).toEqual(before);
			expect(await deps.store.getJSON(pageKey('collection', 'TestUser', SNAP, 1))).not.toBeNull();
			resetMemoryStoreForTests(); now = T0;
		}
		expect(warn).not.toHaveBeenCalled();
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
	it('storing page 1 keeps the profile and start time; other pages carry neither', async () => {
		const deps = makeDeps(); await started(deps);
		const meta: any = await deps.store.getJSON(metaKey('collection', 'u'));
		await deps.store.delete(pageKey('collection', 'u', SNAP, 1));
		expect(await getPage('collection', 'u', 'tok', SNAP, 1, deps)).toMatchObject({ status: 'ok', page: 1, stored: true });
		const one: any = await deps.store.getJSON(pageKey('collection', 'u', SNAP, 1));
		expect(one.profile).toEqual(meta.profile);
		expect(one.startedAt).toBe(meta.pending.startedAt);
		await getPage('collection', 'u', 'tok', SNAP, 2, deps);
		const two: any = await deps.store.getJSON(pageKey('collection', 'u', SNAP, 2));
		expect(two).not.toHaveProperty('profile');
		expect(two).not.toHaveProperty('startedAt');
	});
	it('page 1 answered from Discogs carries the profile from meta; other pages do not (F3)', async () => {
		const deps = makeDeps(); await started(deps);
		const meta: any = await deps.store.getJSON(metaKey('collection', 'u'));
		await deps.store.delete(pageKey('collection', 'u', SNAP, 1));
		expect(await getPage('collection', 'u', 'tok', SNAP, 1, deps)).toMatchObject({ status: 'ok', page: 1, source: 'discogs', profile: meta.profile });
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).not.toHaveProperty('profile');
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
		vi.spyOn(console, 'warn').mockImplementation(() => {});
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
	it('without meta (private list) the page is returned but not stored', async () => {
		const deps = makeDeps();
		deps.discogs.listPage.mockResolvedValue(pageOf(2, 3, 250));
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toMatchObject({ status: 'ok', stored: false });
		expect(await deps.store.listKeys('v2:')).toEqual([]);
	});
	it('uses meta, not the page-1 record, as the marker: page 1 is never read', async () => {
		const deps = makeDeps(); await started(deps);
		const read = vi.spyOn(deps.store, 'getJSON');
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toMatchObject({ status: 'ok', stored: true });
		expect(read.mock.calls.map(([key]) => key)).not.toContain(pageKey('collection', 'u', SNAP, 1));
	});
	it('Discogs 404 on a page beyond the first is an empty page, stored (Review Focus 1)', async () => {
		const deps = makeDeps(); await started(deps);
		deps.discogs.listPage.mockRejectedValue(new DiscogsAPIError('gone', 404, 'NOT_FOUND'));
		expect(await getPage('collection', 'u', 'tok', SNAP, 3, deps)).toMatchObject({ status: 'ok', page: 3, items: [], totalPages: 3, totalItems: 250, stored: true });
	});
	it('Discogs 404 beyond the snapshot\'s page count → BAD_REQUEST, nothing stored', async () => {
		const deps = makeDeps(); await started(deps);
		const before = await deps.store.listKeys('v2:');
		deps.discogs.listPage.mockRejectedValue(new DiscogsAPIError('gone', 404, 'NOT_FOUND'));
		expect(await getPage('collection', 'u', 'tok', SNAP, 4, deps)).toMatchObject({ status: 'error', code: 'BAD_REQUEST' });
		expect(await deps.store.listKeys('v2:')).toEqual(before);
	});
	it('Discogs 404 without meta → BAD_REQUEST, nothing stored', async () => {
		const deps = makeDeps();
		deps.discogs.listPage.mockRejectedValue(new DiscogsAPIError('gone', 404, 'NOT_FOUND'));
		expect(await getPage('collection', 'u', 'tok', SNAP, 2, deps)).toMatchObject({ status: 'error', code: 'BAD_REQUEST' });
		expect(await deps.store.listKeys('v2:')).toEqual([]);
	});
	it('a page Discogs returns beyond the recorded count is still stored (the list grew)', async () => {
		const deps = makeDeps(); await started(deps);
		deps.discogs.listPage.mockResolvedValue(pageOf(4, 4, 350));
		expect(await getPage('collection', 'u', 'tok', SNAP, 4, deps)).toMatchObject({ status: 'ok', page: 4, stored: true });
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
		now = T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS; // closed, but current
		expect(await completeSync('collection', 'u', SNAP, deps)).toEqual(first);
	});
	it('a closed snapshot that is not current → SNAPSHOT_EXPIRED, meta unchanged', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('collection', 'u', 'tok', false, deps);
		const before = await deps.store.getJSON(metaKey('collection', 'u'));
		now = T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS;
		expect(await completeSync('collection', 'u', SNAP, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
		expect(await deps.store.getJSON(metaKey('collection', 'u'))).toEqual(before);
	});
	it('a late complete of an older snapshot than current → SNAPSHOT_EXPIRED, nothing written (F6)', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('collection', 'u', 'tok', false, deps);
		now = T0 + 2 * SNAPSHOT_BUCKET_MS; // SNAP is still open
		const newer = { id: snapshotIdAt(now), totalItems: 41, totalPages: 1, startedAt: now - 1000, completedAt: now - 500 };
		await deps.store.putJSON(metaKey('collection', 'u'), { profile, current: newer, pending: null, recent: [] }, 60);
		const before = await deps.store.getJSON(metaKey('collection', 'u'));
		const put = vi.spyOn(deps.store, 'putJSON');
		expect(await completeSync('collection', 'u', SNAP, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
		expect(put).not.toHaveBeenCalled();
		expect(await deps.store.getJSON(metaKey('collection', 'u'))).toEqual(before);
	});
	it('completing keeps a pending snapshot that is a different one (F6)', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('collection', 'u', 'tok', false, deps);
		now = T0 + SNAPSHOT_BUCKET_MS;
		const other = { id: snapshotIdAt(now), totalItems: 41, totalPages: 1, startedAt: now, completedAt: null };
		await deps.store.putJSON(metaKey('collection', 'u'), { profile, current: null, pending: other, recent: [] }, 60);
		expect(await completeSync('collection', 'u', SNAP, deps)).toMatchObject({ status: 'complete', snapshot: SNAP });
		const meta: any = await deps.store.getJSON(metaKey('collection', 'u'));
		expect(meta.current).toMatchObject({ id: SNAP });
		expect(meta.pending).toEqual(other);
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
	it('falls back to the open pending snapshot when current\'s page 1 is gone', async () => {
		const deps = makeDeps(); publicList(deps, 1, 40);
		await startSync('collection', 'u', 'tok', false, deps);
		await completeSync('collection', 'u', SNAP, deps);
		now = T0 + FRESH_MS;
		const next = snapshotIdAt(now);
		await startSync('collection', 'u', 'tok', false, deps);
		await deps.store.delete(pageKey('collection', 'u', SNAP, 1));
		expect(await readStored('collection', 'u', deps.store, now)).toMatchObject({ complete: false, completedAt: null, snapshot: next });
	});
});

describe('owner-only fields are never stored or returned', () => {
	const ownerProfile = { username: 'Owner', avatar_url: 'o.png', location: 'Leeds', email: 'owner@example.com' } as any;
	const ownerItem = (n: number) => ({
		id: n, instance_id: n, folder_id: 7, rating: 3, date_added: '2020-01-01T00:00:00-08:00',
		basic_information: { id: n, title: `T${n}`, artists: [{ name: 'Art' }] },
		notes: [{ field_id: 1, value: 'paid $5' }]
	});
	for (const kind of ['collection', 'wantlist'] as const) {
		it(`${kind}: profile and items are reduced to public fields`, async () => {
			const deps = makeDeps();
			deps.discogs.profile.mockResolvedValue({ data: ownerProfile, remaining: 50 });
			deps.discogs.listPage.mockImplementation(async (_k, _u, page, _pp, token) => ({
				data: {
					items: token === undefined ? [ownerItem(1)] : [ownerItem(page * 10 + 1), ownerItem(page * 10 + 2)],
					pagination: { page, pages: 2, per_page: 100, items: 150, urls: {} }
				},
				remaining: 50
			}));
			const put = vi.spyOn(deps.store, 'putJSON');
			const started = await startSync(kind, 'Owner', 'tok', false, deps);
			const next = await getPage(kind, 'Owner', 'tok', SNAP, 2, deps);
			expect(started).toMatchObject({ status: 'ok', stored: true });
			expect(next).toMatchObject({ status: 'ok', stored: true });
			const everything = JSON.stringify([started, next, put.mock.calls]);
			for (const secret of ['owner@example.com', 'paid $5', 'folder_id', 'notes']) {
				expect(everything).not.toContain(secret);
			}
			expect((started as any).profile).toEqual({ username: 'Owner', avatar_url: 'o.png', location: 'Leeds' });
			const kept = (n: number) => {
				const { folder_id: _f, notes: _n, instance_id, ...rest } = ownerItem(n);
				return kind === 'collection' ? { ...rest, instance_id } : rest;
			};
			expect((started as any).items).toEqual([kept(11), kept(12)]);
			expect((next as any).items).toEqual([kept(21), kept(22)]);
		});
	}
});
