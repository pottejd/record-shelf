import { describe, it, expect, vi } from 'vitest';
vi.mock('$app/environment', () => ({ version: '9.9.9' }));
import { GET } from './+server';

describe('status endpoint', () => {
	it('reports the store backend, version and last rate reading, and no secrets', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any).process.env.DISCOGS_TOKEN = 'must-not-appear';
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await GET({ platform: undefined } as any);
		const body = await res.json();
		expect(body).toMatchObject({ store: 'memory', version: '9.9.9' });
		expect(Object.keys(body).sort()).toEqual(['discogs', 'store', 'version']);
		expect(Object.keys(body.discogs).sort()).toEqual(['at', 'last429At', 'remaining']);
		expect(JSON.stringify(body)).not.toContain('must-not-appear');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});
	it('reports kv when the binding is present', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const res = await GET({ platform: { env: { COLLECTION_CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() } } } } as any);
		expect((await res.json()).store).toBe('kv');
	});
});
