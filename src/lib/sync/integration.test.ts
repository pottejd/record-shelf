import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEngine } from './engine';
import { REFRESH_COOLDOWN_MS, type StoredInitial } from './types';
import { makeSyncHandlers } from '$lib/server/syncRoute';
import { readStored } from '$lib/server/sync';
import { getStore, resetMemoryStoreForTests } from '$lib/server/store';

// The real engine driving the real sync handlers over the real memory store.
// Only Discogs is faked; the engine's sleeps are recorded, never waited.

type Item = { instance_id: number };
type Visibility = 'public' | 'owner-only' | 'private';
const T0 = 1_800_000_000_000;
const OWNER = 'owner-token';

/** A fake Discogs for one collection of `total` records, 100 to a page. */
function fakeDiscogs(username: string, total: number) {
	const discogs = { visibility: 'public' as Visibility, calls: [] as string[] };
	const reply = (status: number, body: unknown = {}) =>
		new Response(JSON.stringify(body), { status, headers: { 'X-Discogs-Ratelimit-Remaining': '50' } });
	vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input);
		if (url.hostname !== 'api.discogs.com') throw new Error(`unexpected fetch ${input}`);
		discogs.calls.push(input);
		const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
		const readable = discogs.visibility === 'public' || (discogs.visibility === 'owner-only' && auth === `Discogs token=${OWNER}`);
		if (url.pathname === `/users/${username}`) return reply(200, { username, avatar_url: 'a.png', location: 'Here' });
		if (!readable) return reply(403);
		const page = Number(url.searchParams.get('page'));
		const perPage = Number(url.searchParams.get('per_page'));
		const from = (page - 1) * perPage;
		const releases = Array.from({ length: Math.max(0, Math.min(perPage, total - from)) }, (_, i) => ({
			id: from + i + 1, instance_id: from + i + 1, rating: 0, date_added: '2020-01-01',
			basic_information: { id: from + i + 1, title: `T${from + i + 1}`, artists: [{ name: 'Art' }] }
		}));
		return reply(200, { pagination: { page, pages: Math.ceil(total / perPage), per_page: perPage, items: total, urls: {} }, releases });
	}));
	return discogs;
}

/** An engine whose requests go straight to the collection handlers, as a visitor holding `token`. */
function engineFor(username: string, token: string, initial: StoredInitial<Item> | null = null) {
	const { GET, POST } = makeSyncHandlers('collection');
	const sleeps: number[] = [];
	const fetchFn = (async (input: string, init?: RequestInit) => {
		const url = new URL(input, 'http://localhost');
		const event = {
			params: { username: decodeURIComponent(url.pathname.split('/')[3]) },
			platform: undefined,
			cookies: { get: (name: string) => (name === 'discogs_token' ? token : undefined) },
			url,
			request: new Request(url, init)
		} as any;
		return init?.method === 'POST' ? POST(event) : GET(event);
	}) as typeof fetch;
	const engine = createEngine<Item>({
		kind: 'collection', username, initial, keyOf: (i) => i.instance_id, autoRefresh: false,
		deps: { fetchFn, sleep: async (ms) => { sleeps.push(ms); }, now: () => Date.now() },
		onChange: () => {}
	});
	return { engine, sleeps };
}

const ids = (list: Item[]) => list.map((i) => i.instance_id);
const storedKeys = (username: string) => getStore(undefined).listKeys(`v2:collection:${username}:`);

beforeEach(() => {
	resetMemoryStoreForTests();
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(T0);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('engine + handlers + memory store, Discogs faked', () => {
	it('cold load of a public three-page list, then a second load from the stored copy with no Discogs call', async () => {
		const discogs = fakeDiscogs('alice', 250);
		const first = engineFor('alice', OWNER);
		await first.engine.run();
		expect(first.engine.state).toMatchObject({ phase: 'done', totalItems: 250, error: null, profile: { username: 'alice' } });
		expect(ids(first.engine.state.items)).toEqual(Array.from({ length: 250 }, (_, i) => i + 1));
		expect(first.engine.state.asOf).toBe(T0);

		discogs.calls.length = 0;
		const initial = await readStored('collection', 'alice', getStore(undefined), Date.now());
		expect(initial).toMatchObject({ complete: true, totalItems: 250 });
		const second = engineFor('alice', 'another-visitor', initial as StoredInitial<Item>);
		await second.engine.run();
		expect(second.engine.state).toMatchObject({ phase: 'done', totalItems: 250, profile: { username: 'alice' } });
		expect(ids(second.engine.state.items)).toEqual(ids(first.engine.state.items));
		expect(discogs.calls).toEqual([]);
	});

	it('a private list loads for its owner and leaves nothing in the store', async () => {
		const discogs = fakeDiscogs('bob', 150);
		discogs.visibility = 'owner-only';
		const { engine } = engineFor('bob', OWNER);
		await engine.run();
		expect(engine.state).toMatchObject({ phase: 'done', totalItems: 150, error: null });
		expect(engine.state.items).toHaveLength(150);
		expect(await storedKeys('bob')).toEqual([]);
		expect(await readStored('collection', 'bob', getStore(undefined), Date.now())).toBeNull();
	});

	it('a stored public list that turns private: a non-owner\'s forced refresh ends PRIVATE and the copy is gone', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const discogs = fakeDiscogs('carol', 150);
		await engineFor('carol', OWNER).engine.run();
		expect((await storedKeys('carol')).length).toBeGreaterThan(0);

		const initial = await readStored('collection', 'carol', getStore(undefined), Date.now());
		const friend = engineFor('carol', 'friend-token', initial as StoredInitial<Item>);
		await friend.engine.run();
		expect(friend.engine.state.items).toHaveLength(150);

		discogs.visibility = 'owner-only';
		vi.setSystemTime(T0 + REFRESH_COOLDOWN_MS);
		await friend.engine.refresh();
		expect(friend.engine.state).toMatchObject({ phase: 'error', error: { code: 'PRIVATE' }, items: [] });
		expect(await storedKeys('carol')).toEqual([]);
		expect(await readStored('collection', 'carol', getStore(undefined), Date.now())).toBeNull();
		expect(warn).toHaveBeenCalledWith('[record-shelf] sync: removed stored copy', 'collection', 'carol');
	});
});
