import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStore, resetMemoryStoreForTests } from './store';

function fakeKV(overrides: Record<string, unknown> = {}) {
	return {
		get: vi.fn(async () => null),
		put: vi.fn(async () => undefined),
		delete: vi.fn(async () => undefined),
		list: vi.fn(async () => ({ keys: [], list_complete: true })),
		...overrides
	};
}
const cf = (kv?: unknown) => ({ env: kv ? { COLLECTION_CACHE: kv } : {} }) as any;

beforeEach(() => {
	resetMemoryStoreForTests();
	vi.restoreAllMocks();
});

describe('getStore', () => {
	it('uses KV when COLLECTION_CACHE is bound', () => {
		expect(getStore(cf(fakeKV())).backend).toBe('kv');
	});
	it('uses memory with no platform (adapter-node, tests)', () => {
		expect(getStore(undefined).backend).toBe('memory');
	});
	it('on Cloudflare without the binding: memory, and logs an error once per isolate', () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(getStore(cf()).backend).toBe('memory');
		getStore(cf());
		expect(err).toHaveBeenCalledTimes(1);
		expect(err.mock.calls[0][0]).toContain('COLLECTION_CACHE');
	});
});

describe('kv backend', () => {
	it('putJSON stringifies with expirationTtl and resolves true', async () => {
		const kv = fakeKV();
		expect(await getStore(cf(kv)).putJSON('k', { a: 1 }, 60)).toBe(true);
		expect(kv.put).toHaveBeenCalledWith('k', '{"a":1}', { expirationTtl: 60 });
	});
	it('putJSON resolves false and logs when KV throws', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = fakeKV({ put: vi.fn(async () => { throw new Error('quota'); }) });
		expect(await getStore(cf(kv)).putJSON('k', 1, 60)).toBe(false);
		expect(err).toHaveBeenCalled();
	});
	it('getJSON resolves null when KV throws', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = fakeKV({ get: vi.fn(async () => { throw new Error('x'); }) });
		expect(await getStore(cf(kv)).getJSON('k')).toBeNull();
	});
	it('listKeys follows the cursor until list_complete', async () => {
		const list = vi.fn()
			.mockResolvedValueOnce({ keys: [{ name: 'p:1' }], list_complete: false, cursor: 'c1' })
			.mockResolvedValueOnce({ keys: [{ name: 'p:2' }], list_complete: true });
		expect(await getStore(cf(fakeKV({ list }))).listKeys('p:')).toEqual(['p:1', 'p:2']);
		expect(list).toHaveBeenLastCalledWith({ prefix: 'p:', cursor: 'c1' });
	});
});

describe('memory backend', () => {
	it('round-trips JSON, lists by prefix and deletes', async () => {
		const s = getStore(undefined);
		await s.putJSON('a:1', { n: 1 }, 60);
		await s.putJSON('a:2', { n: 2 }, 60);
		await s.putJSON('b:1', { n: 3 }, 60);
		expect(await s.getJSON('a:1')).toEqual({ n: 1 });
		expect((await s.listKeys('a:')).sort()).toEqual(['a:1', 'a:2']);
		await s.delete('a:1');
		expect(await s.getJSON('a:1')).toBeNull();
	});
	it('expires entries after ttlSeconds', async () => {
		vi.useFakeTimers();
		const s = getStore(undefined);
		await s.putJSON('k', 1, 60);
		vi.advanceTimersByTime(61_000);
		expect(await s.getJSON('k')).toBeNull();
		expect(await s.listKeys('k')).toEqual([]);
		vi.useRealTimers();
	});
	it('is shared between getStore calls', async () => {
		await getStore(undefined).putJSON('k', 1, 60);
		expect(await getStore(undefined).getJSON('k')).toBe(1);
	});
});
