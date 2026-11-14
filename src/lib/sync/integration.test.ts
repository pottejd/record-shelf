import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import { createEngine } from './engine';
import { REFRESH_COOLDOWN_MS, type StoredInitial } from './types';
import { setPaceForTests } from '$lib/api/discogs';
import { makeSyncHandlers } from '$lib/server/syncRoute';
import { readStored } from '$lib/server/sync';
import { getStore, resetMemoryStoreForTests } from '$lib/server/store';
import { fingerprint, resetWritersWarningForTests } from '$lib/server/writers';

// The real engine and the real Discogs client driving the real sync handlers
// over the real memory store. Only Discogs' side of the network is faked, and
// it refuses any call made while a server handler is running.

type Item = { instance_id: number };
const T0 = 1_800_000_000_000;
/** The one token whose fingerprint the site lists as allowed to write to the shared store. */
const WRITER = 'site-owner-token';
/** Any other visitor's own token. */
const VISITOR = 'visitors-own-token';
let inServer = false;

/** A fake Discogs for one list of `total` records, 100 to a page. */
function fakeDiscogs(username: string, total: number) {
	const discogs = {
		/** When set, the list is private: only this token can read it. */
		privateTo: null as string | null,
		calls: [] as string[],
		busyOn: null as string | null
	};
	const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
	vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input);
		if (url.hostname !== 'api.discogs.com') throw new Error(`unexpected fetch ${input}`);
		if (inServer) throw new Error(`the server called Discogs: ${input}`);
		if (url.searchParams.has('token')) throw new Error('the token was put in the address');
		const token = /^Discogs token=(.+)$/.exec(new Headers(init?.headers).get('authorization') ?? '')?.[1] ?? null;
		if (token === null && init?.headers) throw new Error('a call with no token must not cost a preflight');
		const page = Number(url.searchParams.get('page'));
		const perPage = Number(url.searchParams.get('per_page'));
		const name = url.pathname === `/users/${username}` ? 'profile' : token === null ? 'probe' : `page ${page}`;
		discogs.calls.push(name);
		// What a browser sees for a 429: no readable answer.
		if (discogs.busyOn === name) throw new TypeError('Failed to fetch');
		if (name === 'profile') return reply(200, { username, avatar_url: 'a.png', location: 'Here', email: 'owner@example.com' });
		if (discogs.privateTo !== null && token !== discogs.privateTo) return reply(403);
		const from = (page - 1) * perPage;
		const releases = Array.from({ length: Math.max(0, Math.min(perPage, total - from)) }, (_, i) => ({
			id: from + i + 1, instance_id: from + i + 1, folder_id: 1, rating: 0, date_added: '2020-01-01',
			notes: [{ field_id: 1, value: 'paid $5' }],
			basic_information: { id: from + i + 1, title: `T${from + i + 1}`, artists: [{ name: 'Art' }] }
		}));
		return reply(200, { pagination: { page, pages: Math.ceil(total / perPage), per_page: perPage, items: total, urls: {} }, releases });
	}));
	return discogs;
}

/** An engine whose server requests go straight to the collection handlers, as a visitor holding `token`. */
function engineFor(username: string, token: string, initial: StoredInitial<Item> | null = null) {
	const { GET, POST } = makeSyncHandlers('collection');
	const sleeps: number[] = [];
	const hooks = { onSleep: (_ms: number) => {} };
	const fetchFn = (async (input: string, init?: RequestInit) => {
		const url = new URL(input, 'http://localhost');
		const event = {
			params: { username: decodeURIComponent(url.pathname.split('/')[3]) },
			platform: undefined,
			cookies: { get: (name: string) => (name === 'discogs_token' ? token : undefined) },
			url,
			request: new Request(url, init)
		} as any;
		inServer = true;
		try {
			return await (init?.method === 'POST' ? POST(event) : GET(event));
		} finally {
			inServer = false;
		}
	}) as typeof fetch;
	const engine = createEngine<Item>({
		kind: 'collection', username, initial, keyOf: (i) => i.instance_id, autoRefresh: false,
		deps: { fetchFn, token: () => token, sleep: async (ms) => { sleeps.push(ms); hooks.onSleep(ms); }, now: () => Date.now() },
		onChange: () => {}
	});
	return { engine, sleeps, hooks };
}

const ids = (list: Item[]) => list.map((i) => i.instance_id);
const storedKeys = (username: string) => getStore(undefined).listKeys(`v2:collection:${username}:`);
const storedInitial = async (username: string) =>
	(await readStored('collection', username, getStore(undefined), Date.now())) as StoredInitial<Item> | null;

beforeEach(async () => {
	resetMemoryStoreForTests();
	resetWritersWarningForTests();
	setPaceForTests(0);
	inServer = false;
	for (const k of Object.keys(mockEnv)) delete mockEnv[k];
	mockEnv.STORE_WRITERS = await fingerprint(WRITER);
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(T0);
});
afterEach(() => {
	setPaceForTests(null);
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('a visitor whose token the site lists as a writer', () => {
	it('cold load of a public three-page list is stored; anyone then loads it from the stored copy with no Discogs call', async () => {
		const discogs = fakeDiscogs('alice', 250);
		const first = engineFor('alice', WRITER);
		await first.engine.run();
		expect(first.engine.state).toMatchObject({ phase: 'done', totalItems: 250, error: null, profile: { username: 'alice' } });
		expect(ids(first.engine.state.items)).toEqual(Array.from({ length: 250 }, (_, i) => i + 1));
		expect(first.engine.state.asOf).toBe(T0);
		expect(discogs.calls).toEqual(['probe', 'page 1', 'profile', 'page 2', 'page 3']);

		// The store holds the public fields only: no token, no owner-only data.
		const store = getStore(undefined);
		const everything = JSON.stringify(await Promise.all((await storedKeys('alice')).map((key) => store.getJSON(key))));
		for (const secret of [WRITER, 'owner@example.com', 'paid $5', 'folder_id', 'notes']) expect(everything).not.toContain(secret);

		discogs.calls.length = 0;
		const initial = await storedInitial('alice');
		expect(initial).toMatchObject({ complete: true, totalItems: 250 });
		const second = engineFor('alice', VISITOR, initial);
		await second.engine.run();
		expect(second.engine.state).toMatchObject({ phase: 'done', totalItems: 250, profile: { username: 'alice' } });
		expect(ids(second.engine.state.items)).toEqual(ids(first.engine.state.items));
		expect(discogs.calls).toEqual([]);
	});

	it('leaves mid-sync: the next writer takes the stored pages from the store and only the rest from Discogs', async () => {
		const discogs = fakeDiscogs('dave', 250);
		const first = engineFor('dave', WRITER);
		discogs.busyOn = 'page 3';
		first.hooks.onSleep = () => first.engine.stop(); // Discogs is busy on page 3: the visitor closes the tab.
		await first.engine.run();
		expect(first.sleeps).toEqual([30_000]);
		expect(await storedInitial('dave')).toMatchObject({ complete: false, totalItems: 250 });

		discogs.busyOn = null;
		discogs.calls.length = 0;
		const second = engineFor('dave', WRITER); // a friend given the same token, in another browser
		await second.engine.run();
		expect(discogs.calls).toEqual(['page 3']);
		expect(second.engine.state).toMatchObject({ phase: 'done', totalItems: 250, asOf: T0, profile: { username: 'dave' } });
		expect(ids(second.engine.state.items)).toEqual(Array.from({ length: 250 }, (_, i) => i + 1));
		expect(await storedInitial('dave')).toMatchObject({ complete: true, completedAt: T0 });
	});

	it('opening their own private list: it loads, and nothing is stored', async () => {
		const discogs = fakeDiscogs('bob', 150);
		discogs.privateTo = WRITER;
		const { engine } = engineFor('bob', WRITER);
		await engine.run();
		expect(engine.state).toMatchObject({ phase: 'done', totalItems: 150, error: null });
		expect(engine.state.items).toHaveLength(150);
		expect(await storedKeys('bob')).toEqual([]);
		expect(await storedInitial('bob')).toBeNull();
	});

	it('refreshing a stored list that has turned private and is not theirs: PRIVATE, and the copy is gone', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const discogs = fakeDiscogs('carol', 150);
		const writer = engineFor('carol', WRITER);
		await writer.engine.run();
		expect((await storedKeys('carol')).length).toBeGreaterThan(0);

		discogs.privateTo = 'carols-token';
		vi.setSystemTime(T0 + REFRESH_COOLDOWN_MS);
		await writer.engine.refresh();
		expect(writer.engine.state).toMatchObject({ phase: 'error', error: { code: 'PRIVATE' }, items: [] });
		expect(await storedKeys('carol')).toEqual([]);
		expect(await storedInitial('carol')).toBeNull();
		expect(warn).toHaveBeenCalledWith('[record-shelf] sync: removed stored copy', 'collection', 'carol');
	});

	it('refreshing their own stored list after making it private: it still shows, and the copy is gone', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const discogs = fakeDiscogs('erin', 150);
		const owner = engineFor('erin', WRITER);
		await owner.engine.run();

		discogs.privateTo = WRITER;
		vi.setSystemTime(T0 + REFRESH_COOLDOWN_MS);
		await owner.engine.refresh();
		expect(owner.engine.state).toMatchObject({ phase: 'done', error: null, totalItems: 150 });
		expect(owner.engine.state.items).toHaveLength(150);
		expect(await storedKeys('erin')).toEqual([]);
	});
});

describe('a visitor with any other token', () => {
	it('sees a public list straight from Discogs, and nothing is stored', async () => {
		const discogs = fakeDiscogs('frank', 250);
		const put = vi.spyOn(getStore(undefined), 'putJSON');
		const { engine } = engineFor('frank', VISITOR);
		await engine.run();
		expect(engine.state).toMatchObject({ phase: 'done', totalItems: 250, error: null, profile: { username: 'frank' }, asOf: null });
		expect(engine.state.items).toHaveLength(250);
		// No public check: there is nothing to decide when nothing will be stored.
		expect(discogs.calls).toEqual(['page 1', 'profile', 'page 2', 'page 3']);
		expect(put).not.toHaveBeenCalled();
		expect(await storedInitial('frank')).toBeNull();
	});

	it('cannot replace or remove a stored copy, even by forcing a refresh of a list that has turned private', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const discogs = fakeDiscogs('gina', 150);
		await engineFor('gina', WRITER).engine.run();
		const keys = await storedKeys('gina');
		const before = await storedInitial('gina');

		discogs.privateTo = VISITOR; // the list's owner makes it private and looks at it with their own token
		vi.setSystemTime(T0 + REFRESH_COOLDOWN_MS);
		const visitor = engineFor('gina', VISITOR, before);
		await visitor.engine.run();
		await visitor.engine.refresh();
		expect(visitor.engine.state).toMatchObject({ phase: 'done', error: null, totalItems: 150 });
		expect(await storedKeys('gina')).toEqual(keys);
		expect(await storedInitial('gina')).toEqual(before);
		expect(warn).not.toHaveBeenCalled();

		// The copy goes the next time a writer's browser looks.
		await engineFor('gina', WRITER, before).engine.refresh();
		expect(await storedKeys('gina')).toEqual([]);
	});

	it('with no writer configured on the site, nobody stores anything: the list still loads', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		delete mockEnv.STORE_WRITERS;
		const discogs = fakeDiscogs('hal', 150);
		const { engine } = engineFor('hal', WRITER);
		await engine.run();
		expect(engine.state).toMatchObject({ phase: 'done', totalItems: 150, error: null });
		expect(discogs.calls).toEqual(['page 1', 'profile', 'page 2']);
		expect(await storedKeys('hal')).toEqual([]);
	});
});
