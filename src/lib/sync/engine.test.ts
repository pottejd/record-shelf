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

describe('controller decisions', () => {
	it('a body with no recognised status is retried like a network failure', async () => {
		const h = harness(() => ({ message: 'Internal Error' }), null, { autoRefresh: false });
		await h.engine.run();
		expect(h.sleeps).toEqual([2000, 4000, 8000]);
		expect(h.calls).toHaveLength(4);
		expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NETWORK' } });
	});
	it('UPSTREAM is retried, then reported as UPSTREAM', async () => {
		const h = harness(() => ({ status: 'error', code: 'UPSTREAM', message: 'down' }), null, { autoRefresh: false });
		await h.engine.run();
		expect(h.sleeps).toEqual([2000, 4000, 8000]);
		expect(h.engine.state.error).toEqual({ code: 'UPSTREAM', message: 'down' });
	});
	it('a start without a profile keeps the profile already known', async () => {
		const h = harness((method, url, body) => {
			if (method === 'GET') return url.includes('snapshot=S0')
				? ok(2, 2, 150, items(101, 50), { snapshot: 'S0', source: 'store', nextDelayMs: 0 })
				: ok(2, 2, 151, items(1101, 51));
			return body.action === 'start' ? ok(1, 2, 151, items(1001, 100)) : { status: 'complete', snapshot: 'S1', completedAt: T0 + FRESH_MS };
		}, stored(2, 150));
		h.setNow(T0 + FRESH_MS);
		await h.engine.run();
		expect(h.engine.state.items).toHaveLength(151);
		expect(h.engine.state.profile).toBe(profile);
	});
	it('fresh answering refresh() changes nothing', async () => {
		const h = harness((method) => method === 'POST'
			? { status: 'fresh', snapshot: 'S0' }
			: ok(2, 2, 150, items(101, 50), { snapshot: 'S0', source: 'store', nextDelayMs: 0 }), stored(2, 150), { autoRefresh: false });
		await h.engine.run();
		const before = h.engine.state;
		await h.engine.refresh();
		expect(h.engine.state).toBe(before);
	});
	it('refresh() does nothing while a pass runs; run() after an error starts a clean pass', async () => {
		let down = true;
		const h = harness((method, url) => {
			if (down) throw new Error('offline');
			return method === 'POST' ? ok(1, 2, 150, items(1, 100), { profile }) : ok(pageOfUrl(url), 2, 150, items(101, 50), { snapshot: 'S0' });
		}, stored(2, 150), { autoRefresh: false });
		const first = h.engine.run();
		await h.engine.refresh();
		await first;
		expect(h.calls.some((c) => c.method === 'POST')).toBe(false);
		expect(h.engine.state.phase).toBe('error');
		down = false;
		await h.engine.run();
		expect(h.engine.state).toMatchObject({ phase: 'done', error: null });
		expect(h.engine.state.items.map((i) => i.instance_id)).toEqual(items(1, 150).map((i) => i.instance_id));
	});
});

describe('review fixes', () => {
	it('shows page 1 as soon as start answers, before page 2 is requested', async () => {
		const seen: EngineState<Item>[] = [];
		let seenAtGet2: EngineState<Item>[] = [];
		const h = harness((method, url, body) => {
			if (method === 'GET' && pageOfUrl(url) === 2 && !seenAtGet2.length) seenAtGet2 = seen.slice();
			if (method === 'POST') return body.action === 'start' ? ok(1, 3, 250, items(1, 100), { profile }) : { status: 'complete', snapshot: 'S1', completedAt: T0 };
			return ok(pageOfUrl(url), 3, 250, items((pageOfUrl(url) - 1) * 100 + 1, pageOfUrl(url) === 3 ? 50 : 100));
		}, null, { autoRefresh: false, onChange: (s: EngineState<Item>) => seen.push(s) });
		await h.engine.run();
		expect(seenAtGet2.some((s) => s.items.length === 100)).toBe(true);
		expect(h.engine.state.items).toHaveLength(250);
	});
	it('a complete copy switches to paced fetching once a page is answered from Discogs', async () => {
		const order: string[] = [];
		let paced = false;
		let inFlight = 0;
		let maxInFlightWhenPaced = 0;
		const fetchFn = (async (url: string) => {
			const page = pageOfUrl(url);
			order.push(`GET${page}`);
			inFlight++;
			if (paced) maxInFlightWhenPaced = Math.max(maxInFlightWhenPaced, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 0));
			inFlight--;
			const extra = page === 2 ? { snapshot: 'S0', source: 'store', nextDelayMs: 0 } : { snapshot: 'S0' };
			return new Response(JSON.stringify(ok(page, 8, 800, items((page - 1) * 100 + 1, 100), extra)));
		}) as any;
		const engine = createEngine<Item>({
			kind: 'collection', username: 'u', initial: stored(8, 800) as any, keyOf: (i) => i.instance_id, autoRefresh: false,
			deps: { fetchFn, sleep: async (ms) => { paced = true; order.push(`sleep${ms}`); }, now: () => T0 },
			onChange: () => {}
		});
		await engine.run();
		const firstSleep = order.indexOf('sleep1100');
		expect(firstSleep).toBeGreaterThan(0);
		const after = order.slice(firstSleep);
		expect(after.length).toBeGreaterThanOrEqual(2);
		after.forEach((entry, i) => expect(entry.startsWith(i % 2 === 0 ? 'sleep1100' : 'GET')).toBe(true));
		expect(maxInFlightWhenPaced).toBe(1);
		expect(order.filter((e) => e.startsWith('GET')).sort()).toEqual(['GET2', 'GET3', 'GET4', 'GET5', 'GET6', 'GET7', 'GET8']);
		expect(engine.state.phase).toBe('done');
		expect(engine.state.items.map((i) => i.instance_id)).toEqual(items(1, 800).map((i) => i.instance_id));
	});
	it('an unexpected exception ends the flow as a NETWORK error and is logged once', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const h = harness(() => ({ status: 'ok' }), null, { autoRefresh: false });
			await expect(h.engine.run()).resolves.toBeUndefined();
			expect(h.engine.state).toMatchObject({ phase: 'error', error: { code: 'NETWORK' }, background: false });
			expect(log).toHaveBeenCalledTimes(1);
		} finally {
			log.mockRestore();
		}
	});
});
