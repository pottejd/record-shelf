import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('$app/environment', () => ({ version: '9.9.9' }));
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));
import { GET } from './+server';
import { fingerprint } from '$lib/server/writers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const event = (token?: string, platform?: unknown): any => ({
	platform,
	cookies: { get: (n: string) => (n === 'discogs_token' ? token : undefined) }
});

beforeEach(() => {
	for (const k of Object.keys(mockEnv)) delete mockEnv[k];
	mockEnv.DISCOGS_TOKEN = 'must-not-appear';
});

describe('status endpoint', () => {
	it('reports the store backend, version and writer count, and no secrets', async () => {
		const res = await GET(event());
		const body = await res.json();
		expect(body).toEqual({ store: 'memory', version: '9.9.9', writers: 0, writer: false, fingerprint: null });
		expect(JSON.stringify(body)).not.toContain('must-not-appear');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});
	it('reports kv when the binding is present', async () => {
		const res = await GET(event(undefined, { env: { COLLECTION_CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() } } }));
		expect((await res.json()).store).toBe('kv');
	});
	it('shows a visitor the fingerprint of their own token, never the token, and whether it may write', async () => {
		const mine = await fingerprint('VISITOR-TOKEN');
		const before = await (await GET(event('VISITOR-TOKEN'))).json();
		expect(before).toMatchObject({ writers: 0, writer: false, fingerprint: mine });
		expect(JSON.stringify(before)).not.toContain('VISITOR-TOKEN');

		mockEnv.STORE_WRITERS = `${await fingerprint('someone-else')} ${mine}`;
		expect(await (await GET(event('VISITOR-TOKEN'))).json()).toMatchObject({ writers: 2, writer: true, fingerprint: mine });
		expect(await (await GET(event('another-token'))).json()).toMatchObject({ writers: 2, writer: false });
		// The listed fingerprints themselves are not given out.
		expect(JSON.stringify(await (await GET(event('another-token'))).json())).not.toContain(mine);
	});
});
