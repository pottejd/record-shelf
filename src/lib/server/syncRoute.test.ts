import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sync', () => ({
	startSync: vi.fn(), getPage: vi.fn(), completeSync: vi.fn(), storePage: vi.fn(), dropStored: vi.fn()
}));
vi.mock('./store', () => ({ getStore: vi.fn(() => ({ backend: 'memory' })) }));
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import { makeSyncHandlers, httpStatusFor } from './syncRoute';
import { startSync, getPage, completeSync, storePage, dropStored } from './sync';
import { MAX_HANDOVER_CHARS } from '$lib/sync/types';
import { fingerprint, resetWritersWarningForTests } from './writers';

const { GET, POST } = makeSyncHandlers('collection');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const event = (o: { token?: string; search?: string; body?: unknown; raw?: string; headers?: Record<string, string> } = {}): any => ({
	params: { username: 'TestUser' },
	platform: undefined,
	cookies: { get: (n: string) => (n === 'discogs_token' ? o.token : undefined) },
	url: new URL(`http://x/api/collection/TestUser${o.search ?? ''}`),
	request: new Request('http://x', {
		method: 'POST',
		headers: o.headers,
		body: o.raw ?? (o.body === undefined ? undefined : JSON.stringify(o.body))
	})
});

beforeEach(async () => {
	vi.clearAllMocks();
	resetWritersWarningForTests();
	for (const k of Object.keys(mockEnv)) delete mockEnv[k];
	mockEnv.DISCOGS_TOKEN = 'server-token-must-be-ignored';
	// 'tok' is the one token allowed to write to the shared store.
	mockEnv.STORE_WRITERS = await fingerprint('tok');
});

describe('makeSyncHandlers', () => {
	it('GET without a token cookie: 401 TOKEN_REQUIRED and nothing is called, even with DISCOGS_TOKEN set', async () => {
		const res = await GET(event({ search: '?page=2&snapshot=3000000' }));
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ status: 'error', code: 'TOKEN_REQUIRED' });
		expect(getPage).not.toHaveBeenCalled();
	});
	it('POST without a token cookie: 401 and nothing is called, whatever the action', async () => {
		for (const action of ['start', 'page', 'complete', 'drop']) {
			expect((await POST(event({ body: { action, snapshot: '3000000' } }))).status).toBe(401);
		}
		for (const fn of [startSync, storePage, completeSync, dropStored]) expect(fn).not.toHaveBeenCalled();
	});
	it('GET passes kind, username, snapshot and page to getPage, never the token; responds no-store', async () => {
		vi.mocked(getPage).mockResolvedValue({ status: 'missing' });
		const res = await GET(event({ token: 'SECRET-TOKEN', search: '?page=2&snapshot=3000000' }));
		expect(vi.mocked(getPage).mock.calls[0].slice(0, 4)).toEqual(['collection', 'TestUser', '3000000', 2]);
		expect(JSON.stringify(vi.mocked(getPage).mock.calls)).not.toContain('SECRET-TOKEN');
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(await res.json()).toEqual({ status: 'missing' });
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
		expect(vi.mocked(startSync).mock.calls.map((c) => c.slice(0, 3))).toEqual([
			['collection', 'TestUser', false],
			['collection', 'TestUser', true]
		]);
	});
	it('POST page hands the body to storePage', async () => {
		vi.mocked(storePage).mockResolvedValue({ status: 'stored' });
		const body = { action: 'page', snapshot: '3000000', page: 2, totalPages: 3, totalItems: 250, items: [{ id: 1 }] };
		const res = await POST(event({ token: 'tok', body }));
		expect(vi.mocked(storePage).mock.calls[0].slice(0, 3)).toEqual(['collection', 'TestUser', body]);
		expect(await res.json()).toEqual({ status: 'stored' });
	});
	it('POST refuses a body over the size limit without parsing it', async () => {
		const big = JSON.stringify({ action: 'page', pad: 'x'.repeat(MAX_HANDOVER_CHARS) });
		expect((await POST(event({ token: 'tok', raw: big }))).status).toBe(400);
		expect((await POST(event({ token: 'tok', body: { action: 'start' }, headers: { 'content-length': String(MAX_HANDOVER_CHARS + 1) } }))).status).toBe(400);
		expect(storePage).not.toHaveBeenCalled();
		expect(startSync).not.toHaveBeenCalled();
	});
	it('POST complete passes the snapshot', async () => {
		vi.mocked(completeSync).mockResolvedValue({ status: 'incomplete', missing: [2] });
		const res = await POST(event({ token: 'tok', body: { action: 'complete', snapshot: '3000000' } }));
		expect(vi.mocked(completeSync).mock.calls[0].slice(0, 3)).toEqual(['collection', 'TestUser', '3000000']);
		expect(await res.json()).toEqual({ status: 'incomplete', missing: [2] });
	});
	it('POST drop removes the stored copy for the user in the address', async () => {
		vi.mocked(dropStored).mockResolvedValue({ status: 'dropped' });
		const res = await POST(event({ token: 'tok', body: { action: 'drop' } }));
		expect(vi.mocked(dropStored).mock.calls[0].slice(0, 2)).toEqual(['collection', 'TestUser']);
		expect(await res.json()).toEqual({ status: 'dropped' });
	});
	it('POST with an unknown action or unparseable body is 400 BAD_REQUEST', async () => {
		expect((await POST(event({ token: 'tok', body: { action: 'delete' } }))).status).toBe(400);
		expect((await POST(event({ token: 'tok' }))).status).toBe(400);
		expect((await POST(event({ token: 'tok', raw: '[1' }))).status).toBe(400);
		expect((await POST(event({ token: 'tok', body: 'start' }))).status).toBe(400);
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
		expect(httpStatusFor({ status: 'missing' })).toBe(200);
	});
});

describe('who may write', () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const writerOf = (fn: any) => fn.mock.calls.at(-1).at(-1).writer;

	it('a token whose fingerprint is listed in STORE_WRITERS is a writer, for every action', async () => {
		await POST(event({ token: 'tok', body: { action: 'start' } }));
		await POST(event({ token: 'tok', body: { action: 'page' } }));
		await POST(event({ token: 'tok', body: { action: 'drop' } }));
		expect([writerOf(startSync), writerOf(storePage), writerOf(dropStored)]).toEqual([true, true, true]);
	});
	it('any other token is not, though the request still reaches the handlers', async () => {
		await POST(event({ token: 'someone-elses-token', body: { action: 'start' } }));
		await POST(event({ token: 'someone-elses-token', body: { action: 'page' } }));
		await POST(event({ token: 'someone-elses-token', body: { action: 'drop' } }));
		expect([writerOf(startSync), writerOf(storePage), writerOf(dropStored)]).toEqual([false, false, false]);
	});
	it('with STORE_WRITERS unset nobody is a writer, not even with the DISCOGS_TOKEN value', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		delete mockEnv.STORE_WRITERS;
		await POST(event({ token: 'tok', body: { action: 'page' } }));
		await POST(event({ token: 'server-token-must-be-ignored', body: { action: 'page' } }));
		expect(vi.mocked(storePage).mock.calls.map((c) => c.at(-1))).toMatchObject([{ writer: false }, { writer: false }]);
	});
	it('the token itself is never passed on', async () => {
		await POST(event({ token: 'tok', body: { action: 'start' } }));
		await POST(event({ token: 'tok', body: { action: 'drop' } }));
		expect(JSON.stringify([vi.mocked(startSync).mock.calls, vi.mocked(dropStored).mock.calls])).not.toContain('"tok"');
	});
});
