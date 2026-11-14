import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStore, resetMemoryStoreForTests } from './store';
import {
	startSync, getPage, storePage, dropStored, completeSync, readStored,
	metaKey, pageKey, snapshotIdAt, isSnapshotOpen
} from './sync';
import {
	FRESH_MS, MAX_TOTAL_PAGES, REFRESH_COOLDOWN_MS, SNAPSHOT_BUCKET_MS, SNAPSHOT_OPEN_MS,
	type SyncKind
} from '$lib/sync/types';

const T0 = 1_800_000_000_000; // snapshot id "3000000"
const SNAP = '3000000';
const profile = { username: 'TestUser', avatar_url: 'a.png', location: '' };
const item = (n: number) => ({ instance_id: n, basic_information: { id: n, title: `T${n}`, artists: [{ name: 'Art (2)' }] } });
/** A page as a browser hands it over. Page 1 carries the profile. */
const handover = (page: number, pages = 3, total = 250, snapshot = SNAP) => ({
	snapshot, page, totalPages: pages, totalItems: total,
	items: Array.from({ length: page === pages ? total - (pages - 1) * 100 : 100 }, (_, i) => item((page - 1) * 100 + i + 1)),
	...(page === 1 ? { profile } : {})
});

let now = T0;
const makeDeps = (writer = true) => ({ store: getStore(undefined), now: () => now, writer });
type Deps = ReturnType<typeof makeDeps>;

/** What a browser does after `open`: hands over page 1 with the profile. */
async function opened(deps: Deps, pages = 3, total = 250, kind: SyncKind = 'collection', username = 'TestUser') {
	const start = await startSync(kind, username, false, deps);
	if (start.status !== 'open') throw new Error(`expected open, got ${start.status}`);
	expect(await storePage(kind, username, handover(1, pages, total, start.snapshot), deps)).toEqual({ status: 'stored' });
	return start.snapshot;
}
/** A completed one-page copy. */
async function completed(deps: Deps, kind: SyncKind = 'collection', username = 'TestUser') {
	await opened(deps, 1, 40, kind, username);
	expect(await completeSync(kind, username, SNAP, deps)).toMatchObject({ status: 'complete' });
}
const metaOf = (deps: Deps, kind: SyncKind = 'collection') => deps.store.getJSON<any>(metaKey(kind, 'TestUser'));

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
});

describe('startSync answers from the store alone', () => {
	it('nothing stored → open with the snapshot id, and nothing is written', async () => {
		const deps = makeDeps();
		const put = vi.spyOn(deps.store, 'putJSON');
		expect(await startSync('collection', 'TestUser', false, deps)).toEqual({ status: 'open', snapshot: SNAP, store: true });
		expect(put).not.toHaveBeenCalled();
	});
	it('a second start in the same bucket joins the stored page 1', async () => {
		const deps = makeDeps(); await opened(deps);
		now = T0 + 60_000;
		const r: any = await startSync('collection', 'testuser', false, deps);
		expect(r).toMatchObject({ status: 'ok', snapshot: SNAP, page: 1, totalPages: 3, totalItems: 250, profile });
		expect(r.items).toHaveLength(100);
	});
	it('joining a stored page 1 that has no profile returns the profile from meta', async () => {
		const deps = makeDeps(); await opened(deps);
		const key = pageKey('collection', 'TestUser', SNAP, 1);
		const { profile: _p, startedAt: _s, ...bare }: any = await deps.store.getJSON(key);
		await deps.store.putJSON(key, bare, 60);
		expect(await startSync('collection', 'TestUser', false, deps)).toMatchObject({ status: 'ok', profile });
	});
	it('an open pending snapshot whose page 1 is gone is opened again under the same id', async () => {
		const deps = makeDeps(); await opened(deps);
		await deps.store.delete(pageKey('collection', 'TestUser', SNAP, 1));
		now = T0 + SNAPSHOT_BUCKET_MS;
		expect(await startSync('collection', 'TestUser', false, deps)).toEqual({ status: 'open', snapshot: SNAP, store: true });
	});

	describe('with a completed snapshot', () => {
		it('not forced and under 6 h old → fresh', async () => {
			const deps = makeDeps(); await completed(deps);
			now = T0 + FRESH_MS - 1;
			expect(await startSync('collection', 'TestUser', false, deps)).toEqual({ status: 'fresh', snapshot: SNAP });
		});
		it('not forced and 6 h old → open with a new id; current is kept when page 1 arrives', async () => {
			const deps = makeDeps(); await completed(deps);
			now = T0 + FRESH_MS;
			const next = snapshotIdAt(now);
			expect(await startSync('collection', 'TestUser', false, deps)).toEqual({ status: 'open', snapshot: next, store: true });
			expect(await storePage('collection', 'TestUser', handover(1, 1, 41, next), deps)).toEqual({ status: 'stored' });
			const meta = await metaOf(deps);
			expect(meta.current).toMatchObject({ id: SNAP, completedAt: T0 });
			expect(meta.pending).toMatchObject({ id: next, totalItems: 41, completedAt: null });
		});
		it('forced inside 10 minutes → cooldown with the time left', async () => {
			const deps = makeDeps(); await completed(deps);
			now = T0 + 4 * 60_000;
			expect(await startSync('collection', 'TestUser', true, deps)).toEqual({ status: 'cooldown', retryAfterMs: REFRESH_COOLDOWN_MS - 4 * 60_000 });
		});
		it('forced after 10 minutes → open with a new id', async () => {
			const deps = makeDeps(); await completed(deps);
			now = T0 + REFRESH_COOLDOWN_MS;
			expect(await startSync('collection', 'TestUser', true, deps)).toEqual({ status: 'open', snapshot: snapshotIdAt(now), store: true });
		});
		it('trusts meta.current as recorded: page 1 gone still gives fresh', async () => {
			const deps = makeDeps(); await completed(deps);
			await deps.store.delete(pageKey('collection', 'TestUser', SNAP, 1));
			now = T0 + 60 * 60_000;
			expect(await startSync('collection', 'TestUser', false, deps)).toEqual({ status: 'fresh', snapshot: SNAP });
			expect((await metaOf(deps)).current).toMatchObject({ id: SNAP });
		});
	});
});

describe('storePage', () => {
	it('page 1 with a profile: writes the page and meta, pending names the snapshot', async () => {
		const deps = makeDeps();
		expect(await storePage('collection', 'TestUser', handover(1), deps)).toEqual({ status: 'stored' });
		expect(await metaOf(deps)).toEqual({
			profile, current: null, recent: [],
			pending: { id: SNAP, totalItems: 250, totalPages: 3, startedAt: T0, completedAt: null }
		});
		const one: any = await deps.store.getJSON(pageKey('collection', 'TestUser', SNAP, 1));
		expect(one).toMatchObject({ page: 1, totalPages: 3, totalItems: 250, profile, startedAt: T0 });
		expect(one.items).toHaveLength(100);
	});
	it('later pages are stored once page 1 has opened the snapshot, and carry no profile or start time', async () => {
		const deps = makeDeps(); await opened(deps);
		expect(await storePage('collection', 'TestUser', handover(2), deps)).toEqual({ status: 'stored' });
		const two: any = await deps.store.getJSON(pageKey('collection', 'TestUser', SNAP, 2));
		expect(two).toMatchObject({ page: 2, totalPages: 3, totalItems: 250 });
		expect(two).not.toHaveProperty('profile');
		expect(two).not.toHaveProperty('startedAt');
	});
	it('a later page for a snapshot meta does not name → unstored, nothing written', async () => {
		const deps = makeDeps();
		expect(await storePage('collection', 'TestUser', handover(2), deps)).toEqual({ status: 'unstored' });
		expect(await deps.store.listKeys('v2:')).toEqual([]);
	});
	it('a page beyond the recorded page count → BAD_REQUEST, nothing stored', async () => {
		const deps = makeDeps(); await opened(deps);
		const before = await deps.store.listKeys('v2:');
		expect(await storePage('collection', 'TestUser', { ...handover(2), page: 4 }, deps)).toMatchObject({ status: 'error', code: 'BAD_REQUEST' });
		expect(await deps.store.listKeys('v2:')).toEqual(before);
	});
	it('an empty list is one empty page', async () => {
		const deps = makeDeps();
		expect(await storePage('collection', 'TestUser', { snapshot: SNAP, page: 1, totalPages: 1, totalItems: 0, items: [], profile }, deps)).toEqual({ status: 'stored' });
		expect(await completeSync('collection', 'TestUser', SNAP, deps)).toMatchObject({ status: 'complete' });
	});
	it('page 1 needs a profile for the user in the address', async () => {
		const deps = makeDeps();
		const { profile: _p, ...noProfile } = handover(1);
		for (const body of [noProfile, { ...noProfile, profile: { username: 'SomeoneElse' } }, { ...noProfile, profile: 'x' }]) {
			expect(await storePage('collection', 'TestUser', body, deps)).toMatchObject({ status: 'error', code: 'BAD_REQUEST' });
		}
		expect(await deps.store.listKeys('v2:')).toEqual([]);
	});
	it('the profile is matched to the address whatever its letter case', async () => {
		expect(await storePage('collection', 'testuser', handover(1), makeDeps())).toEqual({ status: 'stored' });
	});
	it('refuses a body that is out of bounds', async () => {
		const deps = makeDeps();
		const good = handover(1);
		const bad: unknown[] = [
			null, 'x', [],
			{ ...good, items: 'x' },
			{ ...good, items: Array.from({ length: 101 }, (_, i) => item(i)) },
			{ ...good, items: [1, 2] },
			{ ...good, page: 0 },
			{ ...good, page: 1.5 },
			{ ...good, page: '1' },
			{ ...good, totalPages: 0 },
			{ ...good, totalPages: MAX_TOTAL_PAGES + 1 },
			{ ...good, totalItems: -1 },
			{ ...good, totalItems: 1.5 },
			{ ...good, snapshot: 'abc' },
			{ ...good, snapshot: 3000000 }
		];
		for (const body of bad) {
			expect(await storePage('collection', 'TestUser', body, deps)).toMatchObject({ status: 'error', code: 'BAD_REQUEST' });
		}
		expect(await deps.store.listKeys('v2:')).toEqual([]);
	});
	it('a closed or future snapshot → SNAPSHOT_EXPIRED, nothing stored', async () => {
		const deps = makeDeps();
		expect(await storePage('collection', 'TestUser', handover(1, 3, 250, '9999999'), deps)).toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
		now = T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS;
		expect(await storePage('collection', 'TestUser', handover(1), deps)).toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
		expect(await deps.store.listKeys('v2:')).toEqual([]);
	});
	it('page 1 of the current snapshot is never rewritten', async () => {
		const deps = makeDeps(); await completed(deps);
		const before = await metaOf(deps);
		expect(await storePage('collection', 'TestUser', handover(1, 1, 99), deps)).toMatchObject({ status: 'error', code: 'BAD_REQUEST' });
		expect(await metaOf(deps)).toEqual(before);
		expect(((await deps.store.getJSON(pageKey('collection', 'TestUser', SNAP, 1))) as any).totalItems).toBe(40);
	});
	it('a missing later page of the current snapshot can be restored while it is open', async () => {
		const deps = makeDeps(); await opened(deps, 2, 150);
		await storePage('collection', 'TestUser', handover(2, 2, 150), deps);
		await completeSync('collection', 'TestUser', SNAP, deps);
		await deps.store.delete(pageKey('collection', 'TestUser', SNAP, 2));
		expect(await storePage('collection', 'TestUser', handover(2, 2, 150), deps)).toEqual({ status: 'stored' });
	});
	it('store write failure → unstored', async () => {
		const deps = makeDeps();
		vi.spyOn(deps.store, 'putJSON').mockResolvedValue(false);
		expect(await storePage('collection', 'TestUser', handover(1), deps)).toEqual({ status: 'unstored' });
	});
});

describe('owner-only fields are never stored or returned', () => {
	const ownerProfile = { username: 'Owner', avatar_url: 'o.png', location: 'Leeds', email: 'owner@example.com' };
	const ownerItem = (n: number) => ({
		id: n, instance_id: n, folder_id: 7, rating: 3, date_added: '2020-01-01T00:00:00-08:00',
		basic_information: { id: n, title: `T${n}`, artists: [{ name: 'Art' }] },
		notes: [{ field_id: 1, value: 'paid $5' }]
	});
	for (const kind of ['collection', 'wantlist'] as const) {
		it(`${kind}: profile and items are reduced to public fields`, async () => {
			const deps = makeDeps();
			const put = vi.spyOn(deps.store, 'putJSON');
			const body = (page: number) => ({
				snapshot: SNAP, page, totalPages: 2, totalItems: 150,
				items: [ownerItem(page * 10 + 1), ownerItem(page * 10 + 2)],
				...(page === 1 ? { profile: ownerProfile } : {}),
				extra: 'ignored'
			});
			expect(await storePage(kind, 'Owner', body(1), deps)).toEqual({ status: 'stored' });
			expect(await storePage(kind, 'Owner', body(2), deps)).toEqual({ status: 'stored' });
			const first: any = await getPage(kind, 'Owner', SNAP, 1, deps);
			const next: any = await getPage(kind, 'Owner', SNAP, 2, deps);
			const everything = JSON.stringify([first, next, put.mock.calls]);
			for (const secret of ['owner@example.com', 'paid $5', 'folder_id', 'notes', 'ignored']) {
				expect(everything).not.toContain(secret);
			}
			expect(first.profile).toEqual({ username: 'Owner', avatar_url: 'o.png', location: 'Leeds' });
			const kept = (n: number) => {
				const { folder_id: _f, notes: _n, instance_id, ...rest } = ownerItem(n);
				return kind === 'collection' ? { ...rest, instance_id } : rest;
			};
			expect(first.items).toEqual([kept(11), kept(12)]);
			expect(next.items).toEqual([kept(21), kept(22)]);
		});
	}
});

describe('getPage reads the store and nothing else', () => {
	it('serves a stored page; page 1 carries the profile', async () => {
		const deps = makeDeps(); await opened(deps);
		await storePage('collection', 'TestUser', handover(2), deps);
		expect(await getPage('collection', 'TestUser', SNAP, 1, deps)).toMatchObject({ status: 'ok', snapshot: SNAP, page: 1, totalPages: 3, totalItems: 250, profile });
		const two: any = await getPage('collection', 'TestUser', SNAP, 2, deps);
		expect(two).toMatchObject({ status: 'ok', page: 2 });
		expect(two).not.toHaveProperty('profile');
	});
	it('a page of an open snapshot that is not stored → missing', async () => {
		const deps = makeDeps(); await opened(deps);
		expect(await getPage('collection', 'TestUser', SNAP, 2, deps)).toEqual({ status: 'missing' });
		expect(await getPage('collection', 'nobody', SNAP, 1, deps)).toEqual({ status: 'missing' });
	});
	it('serves a stored page of the current snapshot long after it has closed', async () => {
		const deps = makeDeps(); await completed(deps);
		now = T0 + 5 * 60 * 60_000;
		expect(await getPage('collection', 'TestUser', SNAP, 1, deps)).toMatchObject({ status: 'ok' });
	});
	it('does not serve a stored page of a closed snapshot that is not current', async () => {
		const deps = makeDeps(); await opened(deps); // opened, never completed
		now = T0 + 5 * 60 * 60_000;
		expect(await getPage('collection', 'TestUser', SNAP, 1, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
	});
	it('a missing page of a closed snapshot → SNAPSHOT_EXPIRED', async () => {
		const deps = makeDeps(); await opened(deps);
		now = T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS;
		expect(await getPage('collection', 'TestUser', SNAP, 2, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
	});
	it('rejects an invented snapshot id and bad page numbers', async () => {
		const deps = makeDeps();
		expect(await getPage('collection', 'u', 'abc', 1, deps)).toMatchObject({ code: 'BAD_REQUEST' });
		expect(await getPage('collection', 'u', SNAP, 0, deps)).toMatchObject({ code: 'BAD_REQUEST' });
		expect(await getPage('collection', 'u', '9999999', 1, deps)).toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
	});
});

describe('dropStored: a list seen to be not public loses its stored copy, whoever visits', () => {
	const removedLine = ['[record-shelf] sync: removed stored copy', 'collection', 'testuser'];

	it('removes meta and every page of the current and the pending snapshot', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const deps = makeDeps(); await completed(deps);
		now = T0 + FRESH_MS;
		const next = await opened(deps, 2, 150);
		await storePage('collection', 'TestUser', handover(2, 2, 150, next), deps);
		expect(await metaOf(deps)).toMatchObject({ current: { id: SNAP }, pending: { id: next } });

		expect(await dropStored('collection', 'TestUser', deps)).toEqual({ status: 'dropped' });
		expect(await metaOf(deps)).toBeNull();
		expect(await deps.store.listKeys('v2:collection:testuser:')).toEqual([]);
		expect(warn.mock.calls).toEqual([removedLine]);
		// The old pages are no longer served, and nothing can be added to them.
		expect(await getPage('collection', 'TestUser', SNAP, 1, deps)).toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
		expect(await storePage('collection', 'TestUser', handover(2, 2, 150, next), deps)).toEqual({ status: 'unstored' });
		expect(await readStored('collection', 'TestUser', deps.store, now)).toBeNull();
	});
	it('without meta nothing is deleted: no delete or listKeys call, nothing logged', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const deps = makeDeps();
		const del = vi.spyOn(deps.store, 'delete');
		const list = vi.spyOn(deps.store, 'listKeys');
		expect(await dropStored('collection', 'TestUser', deps)).toEqual({ status: 'dropped' });
		expect(del).not.toHaveBeenCalled();
		expect(list).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
	});
	it('leaves the other kind alone', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const deps = makeDeps();
		await completed(deps, 'collection');
		await completed(deps, 'wantlist');
		await dropStored('wantlist', 'TestUser', deps);
		expect(await metaOf(deps, 'collection')).not.toBeNull();
		expect(await metaOf(deps, 'wantlist')).toBeNull();
	});
});

describe('completeSync', () => {
	it('reports missing pages in ascending order', async () => {
		const deps = makeDeps(); await opened(deps);
		await storePage('collection', 'TestUser', handover(3), deps);
		expect(await completeSync('collection', 'TestUser', SNAP, deps)).toEqual({ status: 'incomplete', missing: [2] });
	});
	it('with no page 1 → incomplete [1]', async () => {
		expect(await completeSync('collection', 'u', SNAP, makeDeps())).toEqual({ status: 'incomplete', missing: [1] });
	});
	it('all pages present → meta.current switches, pending clears, recent holds 3 cleaned titles', async () => {
		const deps = makeDeps(); await opened(deps);
		await storePage('collection', 'TestUser', handover(2), deps);
		await storePage('collection', 'TestUser', handover(3), deps);
		now = T0 + 5000;
		expect(await completeSync('collection', 'TestUser', SNAP, deps)).toEqual({ status: 'complete', snapshot: SNAP, completedAt: T0 + 5000 });
		const meta = await metaOf(deps);
		expect(meta.current).toEqual({ id: SNAP, totalItems: 250, totalPages: 3, startedAt: T0, completedAt: T0 + 5000 });
		expect(meta.pending).toBeNull();
		expect(meta.recent).toEqual([{ artist: 'Art', title: 'T1' }, { artist: 'Art', title: 'T2' }, { artist: 'Art', title: 'T3' }]);
	});
	it('is idempotent: a second call returns the first completedAt', async () => {
		const deps = makeDeps(); await opened(deps, 1, 40);
		const first = await completeSync('collection', 'TestUser', SNAP, deps);
		now = T0 + 99_000;
		expect(await completeSync('collection', 'TestUser', SNAP, deps)).toEqual(first);
		now = T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS; // closed, but current
		expect(await completeSync('collection', 'TestUser', SNAP, deps)).toEqual(first);
	});
	it('a closed snapshot that is not current → SNAPSHOT_EXPIRED, meta unchanged', async () => {
		const deps = makeDeps(); await opened(deps, 1, 40);
		const before = await metaOf(deps);
		now = T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS;
		expect(await completeSync('collection', 'TestUser', SNAP, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
		expect(await metaOf(deps)).toEqual(before);
	});
	it('a late complete of an older snapshot than current → SNAPSHOT_EXPIRED, nothing written', async () => {
		const deps = makeDeps(); await opened(deps, 1, 40);
		now = T0 + 2 * SNAPSHOT_BUCKET_MS; // SNAP is still open
		const newer = { id: snapshotIdAt(now), totalItems: 41, totalPages: 1, startedAt: now - 1000, completedAt: now - 500 };
		await deps.store.putJSON(metaKey('collection', 'TestUser'), { profile, current: newer, pending: null, recent: [] }, 60);
		const before = await metaOf(deps);
		const put = vi.spyOn(deps.store, 'putJSON');
		expect(await completeSync('collection', 'TestUser', SNAP, deps)).toMatchObject({ status: 'error', code: 'SNAPSHOT_EXPIRED' });
		expect(put).not.toHaveBeenCalled();
		expect(await metaOf(deps)).toEqual(before);
	});
	it('completing keeps a pending snapshot that is a different one', async () => {
		const deps = makeDeps(); await opened(deps, 1, 40);
		now = T0 + SNAPSHOT_BUCKET_MS;
		const other = { id: snapshotIdAt(now), totalItems: 41, totalPages: 1, startedAt: now, completedAt: null };
		await deps.store.putJSON(metaKey('collection', 'TestUser'), { profile, current: null, pending: other, recent: [] }, 60);
		expect(await completeSync('collection', 'TestUser', SNAP, deps)).toMatchObject({ status: 'complete', snapshot: SNAP });
		const meta = await metaOf(deps);
		expect(meta.current).toMatchObject({ id: SNAP });
		expect(meta.pending).toEqual(other);
	});
	it('wantlist meta has an empty recent list', async () => {
		const deps = makeDeps(); await completed(deps, 'wantlist');
		expect((await metaOf(deps, 'wantlist')).recent).toEqual([]);
	});
});

describe('readStored', () => {
	it('returns null when nothing is stored', async () => {
		expect(await readStored('collection', 'u', getStore(undefined), T0)).toBeNull();
	});
	it('returns the completed snapshot with its first page', async () => {
		const deps = makeDeps(); await completed(deps);
		const s = await readStored('collection', 'TESTUSER', deps.store, T0 + 1);
		expect(s).toMatchObject({ profile, snapshot: SNAP, complete: true, completedAt: T0, totalItems: 40, totalPages: 1 });
		expect(s!.firstPage).toHaveLength(40);
	});
	it('returns an open in-progress snapshot as incomplete, and null once it has closed', async () => {
		const deps = makeDeps(); await opened(deps);
		expect(await readStored('collection', 'TestUser', deps.store, T0 + 1)).toMatchObject({ complete: false, completedAt: null, snapshot: SNAP });
		expect(await readStored('collection', 'TestUser', deps.store, T0 + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS)).toBeNull();
	});
	it('falls back to the open pending snapshot when current\'s page 1 is gone', async () => {
		const deps = makeDeps(); await completed(deps);
		now = T0 + FRESH_MS;
		const next = await opened(deps, 1, 41);
		await deps.store.delete(pageKey('collection', 'TestUser', SNAP, 1));
		expect(await readStored('collection', 'TestUser', deps.store, now)).toMatchObject({ complete: false, completedAt: null, snapshot: next });
	});
});

describe('a visitor who may not write to the shared store', () => {
	const reader = () => makeDeps(false);

	it('is told so when a sync opens, and is refused whatever is handed over', async () => {
		const deps = reader();
		const put = vi.spyOn(deps.store, 'putJSON');
		expect(await startSync('collection', 'TestUser', false, deps)).toEqual({ status: 'open', snapshot: SNAP, store: false });
		for (const body of [handover(1), handover(2), null, { snapshot: 'abc' }]) {
			expect(await storePage('collection', 'TestUser', body, deps)).toEqual({ status: 'unstored' });
		}
		expect(put).not.toHaveBeenCalled();
		expect(await deps.store.listKeys('v2:')).toEqual([]);
	});
	it('cannot add to or change a copy a writer is building', async () => {
		await opened(makeDeps());
		const deps = reader();
		const before = await metaOf(deps);
		expect(await storePage('collection', 'TestUser', handover(2), deps)).toEqual({ status: 'unstored' });
		expect(await storePage('collection', 'TestUser', handover(1, 3, 999), deps)).toEqual({ status: 'unstored' });
		expect(await metaOf(deps)).toEqual(before);
		expect(await deps.store.getJSON(pageKey('collection', 'TestUser', SNAP, 2))).toBeNull();
	});
	it('cannot drop a stored copy', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await completed(makeDeps());
		const deps = reader();
		const del = vi.spyOn(deps.store, 'delete');
		expect(await dropStored('collection', 'TestUser', deps)).toEqual({ status: 'refused' });
		expect(del).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
		expect(await readStored('collection', 'TestUser', deps.store, now)).not.toBeNull();
	});
	it('can still read: start joins or reports fresh, and stored pages are served', async () => {
		const writer = makeDeps();
		await opened(writer, 2, 150);
		const deps = reader();
		expect(await startSync('collection', 'TestUser', false, deps)).toMatchObject({ status: 'ok', page: 1, totalItems: 150 });
		expect(await getPage('collection', 'TestUser', SNAP, 1, deps)).toMatchObject({ status: 'ok' });
		expect(await getPage('collection', 'TestUser', SNAP, 2, deps)).toEqual({ status: 'missing' });
		await storePage('collection', 'TestUser', handover(2, 2, 150), writer);
		await completeSync('collection', 'TestUser', SNAP, writer);
		expect(await startSync('collection', 'TestUser', false, deps)).toEqual({ status: 'fresh', snapshot: SNAP });
	});
	it('may complete a snapshot whose pages a writer has all stored: it only marks what is already there', async () => {
		const writer = makeDeps();
		await opened(writer, 2, 150);
		await storePage('collection', 'TestUser', handover(2, 2, 150), writer);
		expect(await completeSync('collection', 'TestUser', SNAP, reader())).toMatchObject({ status: 'complete' });
	});
});
