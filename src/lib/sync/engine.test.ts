import { describe, it, expect, vi } from 'vitest';
import { createEngine, COMPLETE_RETRY_MS, META_WRITE_GAP_MS, type EngineState } from './engine';
import { DEFAULT_RETRY_AFTER_MS, FRESH_MS, MAX_WAIT_MS } from './types';
import { DiscogsAPIError } from '$lib/api/discogs';

type Item = { instance_id: number };
const T0 = 1_800_000_000_000;
const TOKEN = 'visitor-token';
const profile = { username: 'u', avatar_url: 'a.png', location: '' };
const items = (from: number, count: number): Item[] => Array.from({ length: count }, (_, i) => ({ instance_id: from + i }));
/** The records of page `page` of a list of `total`, 100 to a page. */
const pageItems = (page: number, total: number, base = 0) =>
	items(base + (page - 1) * 100 + 1, Math.max(0, Math.min(100, total - (page - 1) * 100)));
/** A stored page, as the server returns it. */
const ok = (page: number, totalPages: number, totalItems: number, list: Item[], extra: object = {}) =>
	({ status: 'ok', snapshot: 'S1', page, totalPages, totalItems, items: list, ...extra });
const err = (code: string, status = 500) => new DiscogsAPIError(code, status, code);

type Server = (method: string, url: string, body: any) => unknown;
/** What the server says unless a test's script answers first: nothing is stored, everything handed over is kept. */
const emptyStore: Server = (method, _url, body) => {
	if (method === 'GET') return { status: 'missing' };
	if (body.action === 'start') return { status: 'open', snapshot: 'S1', store: true };
	if (body.action === 'page') return { status: 'stored' };
	if (body.action === 'complete') return { status: 'complete', snapshot: 'S1', completedAt: T0 + 9 };
	if (body.action === 'drop') return { status: 'dropped' };
};

interface Options {
	/** Answers first; return undefined to fall through to `emptyStore`. Throw for a network error. */
	server?: Server;
	initial?: any;
	/** Records in the list Discogs holds. */
	total?: number;
	/** Added to every instance id Discogs returns, to tell its records from stored ones. */
	base?: number;
	/** Runs before each Discogs call (`probe`, `page N`, `profile`); throw to fail that call. */
	onDiscogs?: (call: string) => void;
	token?: string | null;
	engine?: object;
}

function harness(o: Options = {}) {
	const total = o.total ?? 250;
	const calls: Array<{ method: string; url: string; body: any }> = [];
	const discogsCalls: string[] = [];
	const sleeps: number[] = [];
	const states: EngineState<Item>[] = [];
	let now = T0;
	const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
		const method = init?.method ?? 'GET';
		const body = init?.body ? JSON.parse(init.body as string) : undefined;
		calls.push({ method, url, body });
		return new Response(JSON.stringify(o.server?.(method, url, body) ?? emptyStore(method, url, body)));
	}) as any;
	const discogs = {
		listPage: vi.fn(async (_kind: string, _username: string, page: number, perPage: number, token: string | undefined) => {
			const name = token === undefined ? 'probe' : `page ${page}`;
			discogsCalls.push(name);
			o.onDiscogs?.(name);
			if (token === undefined) return { items: items(1, Math.min(1, total)), pagination: { page: 1, pages: total, per_page: 1, items: total, urls: {} } };
			if (page > 1 && (page - 1) * perPage >= total) throw err('NOT_FOUND', 404);
			return { items: pageItems(page, total, o.base), pagination: { page, pages: Math.ceil(total / perPage), per_page: perPage, items: total, urls: {} } };
		}),
		profile: vi.fn(async () => {
			discogsCalls.push('profile');
			o.onDiscogs?.('profile');
			return { ...profile, email: 'owner@example.com' };
		})
	};
	const engine = createEngine<Item>({
		kind: 'collection', username: 'u', initial: o.initial ?? null, keyOf: (i) => i.instance_id, autoRefresh: false,
		deps: {
			fetchFn, discogs: discogs as any, token: () => (o.token === undefined ? TOKEN : o.token),
			sleep: async (ms) => { sleeps.push(ms); now += ms; }, now: () => now
		},
		onChange: (s) => states.push(s), ...o.engine
	});
	/** Server calls, in order: `start`, `page 2`, `complete`, `drop`, or `GET 3`. */
	const serverCalls = () => calls.map((c) => c.method === 'GET' ? `GET ${pageOfUrl(c.url)}` : c.body.action === 'page' ? `page ${c.body.page}` : c.body.action);
	return { engine, calls, serverCalls, discogs, discogsCalls, sleeps, states, setNow: (n: number) => (now = n) };
}
const pageOfUrl = (url: string) => Number(new URL(url, 'http://x').searchParams.get('page'));
const stored = (totalPages: number, totalItems: number, completedAt: number | null = T0, complete = true) =>
	({ profile, snapshot: 'S0', complete, completedAt, totalItems, totalPages, firstPage: items(1, 100) });
const ids = (list: Item[]) => list.map((i) => i.instance_id);

describe('first load of a list nobody has stored', () => {
	it('checks the list is public, fetches each page with the token, hands each one over, then completes', async () => {
		const h = harness();
		await h.engine.run();
		expect(h.discogsCalls).toEqual(['probe', 'page 1', 'profile', 'page 2', 'page 3']);
		expect(h.discogs.listPage.mock.calls[0]).toEqual(['collection', 'u', 1, 1, undefined]);
		expect(h.discogs.listPage.mock.calls[1]).toEqual(['collection', 'u', 1, 100, TOKEN]);
		expect(h.discogs.profile.mock.calls[0]).toEqual(['u', TOKEN]);
		expect(h.serverCalls()).toEqual(['start', 'page 1', 'page 2', 'page 3', 'complete']);
		expect(h.calls[0].body).toEqual({ action: 'start', force: false });
		expect(h.calls[1].url).toBe('/api/collection/u');
		expect(h.calls[1].body).toEqual({ action: 'page', snapshot: 'S1', page: 1, totalPages: 3, totalItems: 250, items: items(1, 100), profile });
		expect(h.calls[3].body).toEqual({ action: 'page', snapshot: 'S1', page: 3, totalPages: 3, totalItems: 250, items: items(201, 50) });
		expect(h.calls[4].body).toEqual({ action: 'complete', snapshot: 'S1' });
		expect(h.engine.state).toMatchObject({ phase: 'done', profile, totalItems: 250, loaded: 250, asOf: T0 + 9, error: null });
		expect(ids(h.engine.state.items)).toEqual(ids(items(1, 250)));
		expect(h.sleeps).toEqual([]);
	});
	it('never sends the token to the server, and hands over only the public profile fields', async () => {
		const h = harness();
		await h.engine.run();
		const sent = JSON.stringify(h.calls);
		expect(sent).not.toContain(TOKEN);
		expect(sent).not.toContain('owner@example.com');
	});
	it('shows page 1 as soon as Discogs answers, before it is handed over', async () => {
		let onScreenAtHandover = -1;
		const h: ReturnType<typeof harness> = harness({
			server: (_m, _u, body) => {
				if (body?.action === 'page' && body.page === 1) onScreenAtHandover = h.engine.state.items.length;
				return undefined;
			}
		});
		await h.engine.run();
		expect(onScreenAtHandover).toBe(100);
	});
	it('empty list: one empty page, a pause for the store, then complete', async () => {
		const h = harness({ total: 0 });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'page 1', 'complete']);
		expect(h.calls[1].body).toMatchObject({ page: 1, totalPages: 1, totalItems: 0, items: [] });
		expect(h.engine.state).toMatchObject({ phase: 'done', totalItems: 0, items: [] });
	});
	it('a one-page list pauses META_WRITE_GAP_MS once before complete: the store takes one write a second per key', async () => {
		let sleepsAtComplete: number[] | null = null;
		const h: ReturnType<typeof harness> = harness({
			total: 40,
			server: (_m, _u, body) => {
				if (body?.action === 'complete') sleepsAtComplete = [...h.sleeps];
				return undefined;
			}
		});
		await h.engine.run();
		expect(sleepsAtComplete).toEqual([META_WRITE_GAP_MS]);
		expect(h.sleeps).toEqual([META_WRITE_GAP_MS]);
		expect(h.engine.state).toMatchObject({ phase: 'done', asOf: T0 + 9 });
	});
	it('with no token: TOKEN_REQUIRED, and Discogs is never called', async () => {
		const h = harness({ token: null });
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'TOKEN_REQUIRED' } });
		expect(h.discogsCalls).toEqual([]);
	});
	it('a page Discogs no longer has (the list shrank) is handed over as an empty page', async () => {
		const h = harness({ total: 250, onDiscogs: (call) => { if (call === 'page 3') throw err('NOT_FOUND', 404); } });
		await h.engine.run();
		expect(h.calls.find((c) => c.body?.page === 3)!.body).toEqual({ action: 'page', snapshot: 'S1', page: 3, totalPages: 3, totalItems: 250, items: [] });
		expect(h.serverCalls().at(-1)).toBe('complete');
		expect(h.engine.state).toMatchObject({ phase: 'done', loaded: 200 });
	});
	it('de-duplicates by key', async () => {
		const h = harness({ total: 150 });
		h.discogs.listPage.mockImplementation(async (_k: string, _u: string, page: number, _pp: number, token: string | undefined) => ({
			items: token === undefined ? [] : page === 1 ? items(1, 2) : items(2, 2),
			pagination: { page, pages: 2, per_page: 100, items: 3, urls: {} }
		}));
		await h.engine.run();
		expect(ids(h.engine.state.items)).toEqual([1, 2, 3]);
	});
});

describe('a list that is not public is never handed over', () => {
	it('private, opened by its owner: the stored copy is dropped, the pages load from Discogs, nothing is stored or completed', async () => {
		const h = harness({ total: 150, onDiscogs: (call) => { if (call === 'probe') throw err('PRIVATE', 403); } });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'drop']);
		expect(h.discogsCalls).toEqual(['probe', 'page 1', 'profile', 'page 2']);
		expect(h.engine.state).toMatchObject({ phase: 'done', totalItems: 150, error: null, profile });
		expect(h.engine.state.items).toHaveLength(150);
		expect(h.engine.state.asOf).toBeNull();
	});
	it('a tokenless 401 is treated the same way', async () => {
		const h = harness({ total: 150, onDiscogs: (call) => { if (call === 'probe') throw err('BAD_TOKEN', 401); } });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'drop']);
		expect(h.engine.state.items).toHaveLength(150);
	});
	it('private, opened by someone else: the copy is dropped first, then PRIVATE, with nothing on screen', async () => {
		const h = harness({
			initial: stored(2, 150),
			server: (method) => method === 'GET' ? ok(2, 2, 150, items(101, 50), { snapshot: 'S0' }) : undefined,
			onDiscogs: (call) => {
				expect(call === 'probe' || h.serverCalls().includes('drop')).toBe(true);
				throw err('PRIVATE', 403);
			},
			engine: { autoRefresh: true }
		});
		h.setNow(T0 + FRESH_MS);
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['GET 2', 'start', 'drop']);
		expect(h.discogsCalls).toEqual(['probe', 'page 1']);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'PRIVATE' }, items: [] });
	});
	it('no such user: the copy is dropped, NOT_FOUND, and the token is never used', async () => {
		const h = harness({ onDiscogs: () => { throw err('NOT_FOUND', 404); } });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'drop']);
		expect(h.discogsCalls).toEqual(['probe']);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NOT_FOUND' }, items: [] });
	});
});

describe('a visitor who may not write to the shared store', () => {
	const reader: Server = (_m, _u, body) => body?.action === 'start' ? { status: 'open', snapshot: 'S1', store: false } : undefined;

	it('sees the list straight from Discogs: no public check, nothing handed over, no drop, no complete', async () => {
		const h = harness({ total: 150, server: reader });
		await h.engine.run();
		expect(h.discogsCalls).toEqual(['page 1', 'profile', 'page 2']);
		expect(h.serverCalls()).toEqual(['start']);
		expect(h.engine.state).toMatchObject({ phase: 'done', totalItems: 150, error: null, profile, asOf: null });
		expect(h.engine.state.items).toHaveLength(150);
	});
	it('a private list they cannot read ends as PRIVATE without asking the site to drop anything', async () => {
		const h = harness({ server: reader, onDiscogs: () => { throw err('PRIVATE', 403); } });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start']);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'PRIVATE' } });
	});
	it('a drop the site refuses does not stop the load', async () => {
		const h = harness({
			total: 150,
			server: (_m, _u, body) => body?.action === 'drop' ? { status: 'refused' } : undefined,
			onDiscogs: (call) => { if (call === 'probe') throw err('PRIVATE', 403); }
		});
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'drop']);
		expect(h.engine.state).toMatchObject({ phase: 'done', error: null });
		expect(h.engine.state.items).toHaveLength(150);
	});
});

describe('when the store does not keep a page', () => {
	it('unstored on page 1: the list still loads, nothing more is handed over, complete is never asked', async () => {
		const h = harness({ server: (_m, _u, body) => body?.action === 'page' ? { status: 'unstored' } : undefined });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'page 1']);
		expect(h.engine.state).toMatchObject({ phase: 'done', asOf: null });
		expect(h.engine.state.items).toHaveLength(250);
	});
	it('unstored on a later page: stops handing over there', async () => {
		const h = harness({ server: (_m, _u, body) => body?.action === 'page' && body.page === 2 ? { status: 'unstored' } : undefined });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'page 1', 'page 2']);
		expect(h.engine.state.items).toHaveLength(250);
	});
	it('a refused page (BAD_REQUEST) costs the stored copy, not the visitor\'s view', async () => {
		const h = harness({ server: (_m, _u, body) => body?.action === 'page' ? { status: 'error', code: 'BAD_REQUEST', message: 'no' } : undefined });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'page 1']);
		expect(h.engine.state).toMatchObject({ phase: 'done', error: null });
		expect(h.engine.state.items).toHaveLength(250);
	});
});

describe('a list someone has stored', () => {
	const storeS0: Server = (method, url) =>
		method === 'GET' ? ok(pageOfUrl(url), 3, 250, pageItems(pageOfUrl(url), 250), { snapshot: 'S0' }) : undefined;

	it('a complete stored copy: loads the other pages from the store, with no start, no Discogs call and no sleep', async () => {
		const h = harness({ initial: stored(3, 250), server: storeS0 });
		expect(h.engine.state).toMatchObject({ phase: 'idle', profile, asOf: T0 });
		expect(h.engine.state.items).toHaveLength(100);
		await h.engine.run();
		expect(h.serverCalls().sort()).toEqual(['GET 2', 'GET 3']);
		expect(h.calls.every((c) => c.url.includes('snapshot=S0'))).toBe(true);
		expect(h.discogsCalls).toEqual([]);
		expect(h.sleeps).toEqual([]);
		expect(ids(h.engine.state.items)).toEqual(ids(items(1, 250)));
	});
	it('start answering fresh: reads page 1 and the rest from the store, never completes', async () => {
		const h = harness({ server: (method, url, body) => body?.action === 'start' ? { status: 'fresh', snapshot: 'S0' } : storeS0(method, url, body) });
		await h.engine.run();
		expect(h.serverCalls().sort()).toEqual(['GET 1', 'GET 2', 'GET 3', 'start']);
		expect(h.calls[1].url).toBe('/api/collection/u?page=1&snapshot=S0');
		expect(h.discogsCalls).toEqual([]);
		expect(h.engine.state.items).toHaveLength(250);
	});
	it('start answering fresh but page 1 is gone from the store: the list is shown straight from Discogs, storing nothing', async () => {
		const h = harness({ total: 150, server: (_m, _u, body) => body?.action === 'start' ? { status: 'fresh', snapshot: 'S0' } : undefined });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'GET 1']);
		expect(h.discogsCalls).toEqual(['page 1', 'profile', 'page 2']);
		expect(h.engine.state).toMatchObject({ phase: 'done', totalItems: 150 });
	});
	it('a complete copy with a page missing: that page comes from Discogs and is handed back', async () => {
		const h = harness({
			initial: stored(3, 250),
			server: (method, url, body) => method === 'GET' && pageOfUrl(url) === 3 ? { status: 'missing' } : storeS0(method, url, body)
		});
		await h.engine.run();
		expect(h.discogsCalls).toEqual(['page 3']);
		expect(h.calls.find((c) => c.body?.action === 'page')!.body).toMatchObject({ snapshot: 'S0', page: 3, totalPages: 3, totalItems: 250 });
		expect(h.serverCalls()).not.toContain('complete');
		expect(h.engine.state.items).toHaveLength(250);
	});
	it('joining a sync in progress: stored pages come from the store, the rest from Discogs, with no public check', async () => {
		const h = harness({
			server: (method, url, body) => {
				if (body?.action === 'start') return ok(1, 3, 250, items(1, 100), { profile });
				if (method === 'GET' && pageOfUrl(url) === 2) return ok(2, 3, 250, items(101, 100));
			}
		});
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'GET 2', 'GET 3', 'page 3', 'complete']);
		expect(h.discogsCalls).toEqual(['page 3']);
		expect(h.engine.state).toMatchObject({ phase: 'done', asOf: T0 + 9, profile });
		expect(ids(h.engine.state.items)).toEqual(ids(items(1, 250)));
	});
	it('an in-progress stored copy: continues it one page at a time, then completes', async () => {
		const h = harness({ total: 150, initial: stored(2, 150, null, false) });
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['GET 2', 'page 2', 'complete']);
		expect(h.calls.find((c) => c.body?.action === 'complete')!.body).toEqual({ action: 'complete', snapshot: 'S0' });
		expect(h.engine.state.asOf).toBe(T0 + 9);
	});
	it('a start without a profile keeps the profile already known', async () => {
		const h = harness({
			total: 151, initial: stored(2, 150), engine: { autoRefresh: true },
			server: (method, url, body) => {
				if (method === 'GET' && url.includes('snapshot=S0')) return ok(2, 2, 150, items(101, 50), { snapshot: 'S0' });
				if (body?.action === 'start') return ok(1, 2, 151, items(1001, 100));
				if (method === 'GET') return ok(2, 2, 151, items(1101, 51));
			}
		});
		h.setNow(T0 + FRESH_MS);
		await h.engine.run();
		expect(h.engine.state.items).toHaveLength(151);
		expect(h.engine.state.profile).toEqual(profile);
	});
	it('reads the JSON body whatever the HTTP status', async () => {
		const h = harness({
			engine: { deps: {
				fetchFn: (async () => new Response(JSON.stringify({ status: 'error', code: 'PRIVATE', message: 'p' }), { status: 403 })) as any,
				sleep: async () => {}, now: () => T0, token: () => TOKEN
			} }
		});
		await h.engine.run();
		expect(h.engine.state.error).toEqual({ code: 'PRIVATE', message: 'p' });
	});
});

describe('Discogs is busy', () => {
	it('a 429 or an unreadable failure: waits 30 s, then 60 s, retries the same call, and keeps what is on screen', async () => {
		let failures = 0;
		const codes = ['RATE_LIMITED', 'UNREACHABLE', 'UNREACHABLE'];
		const h = harness({
			total: 150,
			onDiscogs: (call) => { if (call === 'page 2' && failures < 3) throw err(codes[failures++], 0); }
		});
		await h.engine.run();
		expect(h.sleeps).toEqual([DEFAULT_RETRY_AFTER_MS, MAX_WAIT_MS, MAX_WAIT_MS]);
		expect(DEFAULT_RETRY_AFTER_MS).toBe(30_000);
		const waiting = h.states.find((s) => s.phase === 'waiting')!;
		expect(waiting.resumeAt).toBe(T0 + DEFAULT_RETRY_AFTER_MS);
		expect(waiting.items).toHaveLength(100);
		expect(h.states[h.states.indexOf(waiting) + 1]).toMatchObject({ phase: 'loading', resumeAt: null });
		expect(h.discogsCalls.filter((c) => c === 'page 2')).toHaveLength(4);
		expect(h.engine.state).toMatchObject({ phase: 'done', error: null });
		expect(h.engine.state.items).toHaveLength(150);
	});
	it('never gives up on its own', async () => {
		let failures = 0;
		const h = harness({ total: 40, onDiscogs: (call) => { if (call === 'probe' && failures++ < 25) throw err('UNREACHABLE', 0); } });
		await h.engine.run();
		expect(h.sleeps.slice(0, 25)).toEqual([DEFAULT_RETRY_AFTER_MS, ...Array(24).fill(MAX_WAIT_MS)]);
		expect(h.engine.state.phase).toBe('done');
	});
	it('a busy public check drops nothing', async () => {
		let failures = 0;
		const h = harness({ total: 40, onDiscogs: (call) => { if (call === 'probe' && failures++ < 1) throw err('RATE_LIMITED', 429); } });
		await h.engine.run();
		expect(h.serverCalls()).not.toContain('drop');
		expect(h.serverCalls()).toContain('complete');
	});
	it('a rejected token ends the load as BAD_TOKEN', async () => {
		const h = harness({ onDiscogs: (call) => { if (call === 'page 1') throw err('BAD_TOKEN', 401); } });
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'BAD_TOKEN' } });
		expect(h.serverCalls()).toEqual(['start']);
	});
	it('any other Discogs failure is retried after 2 s, 4 s, 8 s, then reported as UPSTREAM with what is on screen kept', async () => {
		const h = harness({ total: 150, onDiscogs: (call) => { if (call === 'page 2') throw err('UPSTREAM_ERROR', 502); } });
		await h.engine.run();
		expect(h.sleeps).toEqual([2000, 4000, 8000]);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'UPSTREAM' } });
		expect(h.engine.state.items).toHaveLength(100);
	});
});

describe('server failures', () => {
	it('SNAPSHOT_EXPIRED on a handover restarts with start, at most twice, then errors', async () => {
		const h = harness({ server: (_m, _u, body) => body?.action === 'page' && body.page === 2 ? { status: 'error', code: 'SNAPSHOT_EXPIRED', message: 'x' } : undefined });
		await h.engine.run();
		expect(h.serverCalls().filter((c) => c === 'start')).toHaveLength(3);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'SNAPSHOT_EXPIRED' } });
	});
	it('incomplete: looks in the store for the missing pages, takes from Discogs what is not there, pauses, completes again', async () => {
		let completes = 0;
		let sleepsAtSecondComplete: number[] | null = null;
		const h: ReturnType<typeof harness> = harness({
			total: 250,
			server: (method, url, body) => {
				if (method === 'GET' && pageOfUrl(url) === 2) return ok(2, 3, 250, items(101, 100));
				if (body?.action !== 'complete') return undefined;
				if (completes++ === 0) return { status: 'incomplete', missing: [2, 3] };
				sleepsAtSecondComplete = [...h.sleeps];
				return { status: 'complete', snapshot: 'S1', completedAt: T0 + 5 };
			}
		});
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['start', 'page 1', 'page 2', 'page 3', 'complete', 'GET 2', 'GET 3', 'page 3', 'complete']);
		expect(sleepsAtSecondComplete).toEqual([COMPLETE_RETRY_MS]);
		expect(COMPLETE_RETRY_MS).toBe(2000);
		expect(h.engine.state).toMatchObject({ phase: 'done', asOf: T0 + 5 });
	});
	it('NOT_FOUND from the server: error, no items', async () => {
		const h = harness({ server: () => ({ status: 'error', code: 'NOT_FOUND', message: 'nope' }) });
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NOT_FOUND', message: 'nope' }, items: [] });
		expect(h.calls).toHaveLength(1);
	});
	it('network failure: retries after 2 s, 4 s, 8 s, then errors as NETWORK keeping what is on screen', async () => {
		const h = harness({ initial: stored(2, 150), server: () => { throw new Error('offline'); } });
		await h.engine.run();
		expect(h.sleeps).toEqual([2000, 4000, 8000]);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NETWORK' } });
		expect(h.engine.state.items).toHaveLength(100);
	});
	it('a body with no recognised status is retried like a network failure', async () => {
		const h = harness({ server: () => ({ message: 'Internal Error' }) });
		await h.engine.run();
		expect(h.sleeps).toEqual([2000, 4000, 8000]);
		expect(h.calls).toHaveLength(4);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NETWORK' } });
	});
	it('UPSTREAM is retried, then reported as UPSTREAM', async () => {
		const h = harness({ server: () => ({ status: 'error', code: 'UPSTREAM', message: 'down' }) });
		await h.engine.run();
		expect(h.sleeps).toEqual([2000, 4000, 8000]);
		expect(h.engine.state.error).toEqual({ code: 'UPSTREAM', message: 'down' });
	});
	it('stop() halts further calls', async () => {
		const h = harness({ total: 500 });
		const p = h.engine.run();
		h.engine.stop();
		await p;
		expect(h.calls.length + h.discogsCalls.length).toBeLessThanOrEqual(2);
	});
	it('an unexpected exception ends the flow as a NETWORK error and is logged once', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const h = harness({ server: (_m, _u, body) => body?.action === 'start' ? { status: 'ok' } : undefined });
			await expect(h.engine.run()).resolves.toBeUndefined();
			expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NETWORK' }, background: false });
			expect(log).toHaveBeenCalledTimes(1);
		} finally {
			log.mockRestore();
		}
	});
});

describe('refreshing', () => {
	/** S0 is the copy on screen; a re-sync opens S1 and fills it from a Discogs list of 151 newer records. */
	const copyS0: Server = (method, url, body) => {
		if (method === 'GET' && url.includes('snapshot=S0')) return ok(2, 2, 150, items(101, 50), { snapshot: 'S0' });
		if (body?.action === 'complete') return { status: 'complete', snapshot: 'S1', completedAt: T0 + FRESH_MS + 7 };
	};
	const refreshing = (o: Options = {}) => harness({ initial: stored(2, 150), total: 151, base: 1000, server: copyS0, engine: { autoRefresh: true }, ...o });

	it('a copy 6 h old is shown, then re-synced from Discogs in the background and swapped in', async () => {
		const h = refreshing();
		h.setNow(T0 + FRESH_MS);
		await h.engine.run();
		const during = h.states.find((s) => s.phase === 'refreshing')!;
		expect(during).toMatchObject({ background: true, asOf: T0 });
		expect(during.items.every((i) => i.instance_id < 1000)).toBe(true);
		expect(h.engine.state).toMatchObject({ phase: 'done', background: false, asOf: T0 + FRESH_MS + 7, totalItems: 151 });
		expect(h.engine.state.items).toHaveLength(151);
		expect(h.engine.state.items[0].instance_id).toBe(1001);
		expect(h.calls.find((c) => c.body?.action === 'start')).toMatchObject({ body: { action: 'start', force: false } });
		expect(h.serverCalls()).toEqual(['GET 2', 'start', 'page 1', 'page 2', 'complete']);
	});
	it('a copy under 6 h old is not re-synced', async () => {
		const h = refreshing();
		h.setNow(T0 + FRESH_MS - 1);
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['GET 2']);
		expect(h.discogsCalls).toEqual([]);
	});
	it('the server answering fresh wins over the browser clock', async () => {
		const h = refreshing({ server: (method, url, body) => body?.action === 'start' ? { status: 'fresh', snapshot: 'S0' } : copyS0(method, url, body) });
		h.setNow(T0 + 30 * 24 * 60 * 60_000);
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'done', asOf: T0, background: false });
		expect(h.engine.state.items).toHaveLength(150);
		expect(h.serverCalls().filter((c) => c === 'start')).toHaveLength(1);
		expect(h.discogsCalls).toEqual([]);
	});
	it('autoRefresh false: no re-sync until refreshIfStale() is called', async () => {
		const h = refreshing({ engine: { autoRefresh: false } });
		h.setNow(T0 + FRESH_MS);
		await h.engine.run();
		expect(h.serverCalls()).toEqual(['GET 2']);
		await h.engine.refreshIfStale();
		expect(h.engine.state.items).toHaveLength(151);
	});
	it('refresh() sends force and records a cooldown without changing the copy', async () => {
		const h = refreshing({ engine: { autoRefresh: false }, server: (method, url, body) => body?.action === 'start' ? { status: 'cooldown', retryAfterMs: 240_000 } : copyS0(method, url, body) });
		await h.engine.run();
		await h.engine.refresh();
		expect(h.calls.at(-1)!.body).toEqual({ action: 'start', force: true });
		expect(h.engine.state).toMatchObject({ phase: 'done', cooldownUntil: T0 + 240_000, asOf: T0 });
		expect(h.discogsCalls).toEqual([]);
	});
	it('refresh() outside the cooldown re-syncs from Discogs', async () => {
		const h = refreshing({ engine: { autoRefresh: false } });
		await h.engine.run();
		await h.engine.refresh();
		expect(h.calls.find((c) => c.body?.action === 'start')!.body).toEqual({ action: 'start', force: true });
		expect(h.engine.state).toMatchObject({ phase: 'done', totalItems: 151, asOf: T0 + FRESH_MS + 7 });
	});
	it('fresh answering refresh() changes nothing', async () => {
		const h = refreshing({ engine: { autoRefresh: false }, server: (method, url, body) => body?.action === 'start' ? { status: 'fresh', snapshot: 'S0' } : copyS0(method, url, body) });
		await h.engine.run();
		const before = h.engine.state;
		await h.engine.refresh();
		expect(h.engine.state).toBe(before);
	});
	it('refresh() does nothing while a pass runs; run() after an error starts a clean pass', async () => {
		let down = true;
		const h = refreshing({
			engine: { autoRefresh: false },
			server: (method, url, body) => {
				if (down) throw new Error('offline');
				return copyS0(method, url, body);
			}
		});
		const first = h.engine.run();
		await h.engine.refresh();
		await first;
		expect(h.calls.some((c) => c.method === 'POST')).toBe(false);
		expect(h.engine.state.phase).toBe('error');
		down = false;
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'done', error: null });
		expect(ids(h.engine.state.items)).toEqual(ids(items(1, 150)));
	});
});
