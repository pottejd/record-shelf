import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sync', () => ({
	startSync: vi.fn(), getPage: vi.fn(), completeSync: vi.fn(), discogsPort: { marker: true }
}));
vi.mock('./store', () => ({ getStore: vi.fn(() => ({ backend: 'memory' })) }));

import { makeSyncHandlers, httpStatusFor } from './syncRoute';
import { startSync, getPage, completeSync } from './sync';

const { GET, POST } = makeSyncHandlers('collection');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const event = (o: { token?: string; search?: string; body?: unknown } = {}): any => ({
	params: { username: 'TestUser' },
	platform: undefined,
	cookies: { get: (n: string) => (n === 'discogs_token' ? o.token : undefined) },
	url: new URL(`http://x/api/collection/TestUser${o.search ?? ''}`),
	request: new Request('http://x', { method: 'POST', body: o.body === undefined ? undefined : JSON.stringify(o.body) })
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
beforeEach(() => { vi.clearAllMocks(); (globalThis as any).process.env.DISCOGS_TOKEN = 'server-token-must-be-ignored'; });

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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const s = (code: any) => httpStatusFor({ status: 'error', code });
		expect([s('TOKEN_REQUIRED'), s('BAD_TOKEN'), s('PRIVATE'), s('NOT_FOUND'), s('SNAPSHOT_EXPIRED'), s('BAD_REQUEST'), s('UPSTREAM')])
			.toEqual([401, 401, 403, 404, 409, 400, 502]);
		expect(httpStatusFor({ status: 'wait' })).toBe(200);
	});
});
