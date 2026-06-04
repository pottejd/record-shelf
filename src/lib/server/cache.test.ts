import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readCache, writeCache, invalidateCache, kvGetJSON, kvPutJSON } from './cache';
import type { UserCollection } from '$lib/types/discogs';

// Mock constants — soft TTL 1h, stale window 24h
vi.mock('$lib/constants', () => ({
	CACHE_TTL_MS: 3600000,
	CACHE_STALE_TTL_MS: 86400000,
	CACHE_STALE_TTL_SECONDS: 86400
}));

function createMockKV() {
	const store = new Map<string, string>();
	return {
		get: vi.fn(async (key: string) => {
			const val = store.get(key);
			return val ? JSON.parse(val) : null;
		}),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
		delete: vi.fn(async (key: string) => {
			store.delete(key);
		}),
		_store: store
	};
}

function createPlatform(kv: ReturnType<typeof createMockKV>) {
	return {
		env: { COLLECTION_CACHE: kv }
	} as unknown as App.Platform;
}

const mockCollection: UserCollection = {
	profile: {
		id: 1,
		username: 'testuser',
		name: 'Test User',
		avatar_url: '',
		resource_url: '',
		inventory_url: '',
		collection_folders_url: '',
		collection_fields_url: '',
		wantlist_url: '',
		num_collection: 0,
		num_wantlist: 0,
		num_pending: 0,
		num_for_sale: 0,
		num_lists: 0,
		location: '',
		profile: '',
		registered: '',
		releases_contributed: 0,
		releases_rated: 0,
		rating_avg: 0
	},
	items: [],
	stats: {
		totalItems: 0,
		totalArtists: 0,
		totalLabels: 0,
		formatBreakdown: {},
		formatDetailBreakdown: {},
		genreBreakdown: {},
		styleBreakdown: {},
		decadeBreakdown: {},
		yearBreakdown: {},
		topArtists: [],
		topLabels: [],
		topStyles: [],
		recentlyAdded: [],
		addedByMonth: [],
		oldestRelease: null,
		newestRelease: null,
		averageYear: 0,
		medianYear: 0,
		uniqueArtistRatio: 0,
		collectionSpan: 0,
		dominantDecade: '',
		dominantGenre: '',
		ratingBreakdown: {},
		averageRating: 0,
		ratedCount: 0,
		topRatedItems: []
	},
	fetchedAt: Date.now(),
	totalDiscogsItems: 0
};

describe('cache utility', () => {
	let kv: ReturnType<typeof createMockKV>;
	let platform: App.Platform;

	beforeEach(() => {
		kv = createMockKV();
		platform = createPlatform(kv);
	});

	describe('readCache', () => {
		it('returns null when no platform is provided', async () => {
			const result = await readCache(undefined, 'testuser');
			expect(result).toBeNull();
		});

		it('returns null when cache is empty', async () => {
			const result = await readCache(platform, 'testuser');
			expect(result).toBeNull();
			expect(kv.get).toHaveBeenCalledWith('collection:testuser', 'json');
		});

		it('returns fresh cached data with stale=false', async () => {
			const cached = {
				data: mockCollection,
				cachedAt: Date.now(),
				expiresAt: Date.now() + 3600000
			};
			kv._store.set('collection:testuser', JSON.stringify(cached));

			const result = await readCache(platform, 'testuser');
			expect(result).not.toBeNull();
			expect(result!.data).toEqual(mockCollection);
			expect(result!.stale).toBe(false);
		});

		it('returns soft-expired data with stale=true while within the stale window', async () => {
			const now = Date.now();
			const cached = {
				data: mockCollection,
				cachedAt: now - 7200000,
				expiresAt: now - 3600000, // soft-expired 1h ago
				staleUntil: now + 3600000 // but still serveable for another hour
			};
			kv._store.set('collection:testuser', JSON.stringify(cached));

			const result = await readCache(platform, 'testuser');
			expect(result).not.toBeNull();
			expect(result!.data).toEqual(mockCollection);
			expect(result!.stale).toBe(true);
		});

		it('returns null once past the hard staleUntil limit', async () => {
			const now = Date.now();
			const cached = {
				data: mockCollection,
				cachedAt: now - 172800000,
				expiresAt: now - 90000000,
				staleUntil: now - 3600000 // hard-expired 1h ago
			};
			kv._store.set('collection:testuser', JSON.stringify(cached));

			const result = await readCache(platform, 'testuser');
			expect(result).toBeNull();
		});

		it('treats a legacy entry without staleUntil as hard-expired at expiresAt', async () => {
			const cached = {
				data: mockCollection,
				cachedAt: Date.now() - 7200000,
				expiresAt: Date.now() - 3600000 // expired 1 hour ago, no staleUntil
			};
			kv._store.set('collection:testuser', JSON.stringify(cached));

			const result = await readCache(platform, 'testuser');
			expect(result).toBeNull();
		});

		it('treats a malformed cached entry as a miss', async () => {
			// missing data.items / numeric fields
			kv._store.set('collection:testuser', JSON.stringify({ data: { profile: {} }, foo: 'bar' }));

			const result = await readCache(platform, 'testuser');
			expect(result).toBeNull();
		});

		it('normalizes username to lowercase for cache key', async () => {
			await readCache(platform, 'TestUser');
			expect(kv.get).toHaveBeenCalledWith('collection:testuser', 'json');
		});
	});

	describe('writeCache', () => {
		it('does nothing when no platform is provided', async () => {
			await writeCache(undefined, 'testuser', mockCollection);
			// No error thrown
		});

		it('writes data to KV store with the stale-window TTL', async () => {
			await writeCache(platform, 'testuser', mockCollection);
			expect(kv.put).toHaveBeenCalledTimes(1);
			expect(kv.put).toHaveBeenCalledWith(
				'collection:testuser',
				expect.any(String),
				{ expirationTtl: 86400 }
			);
		});

		it('persists a staleUntil beyond expiresAt so entries can be served stale', async () => {
			await writeCache(platform, 'testuser', mockCollection);
			const written = JSON.parse(kv._store.get('collection:testuser')!);
			expect(written.staleUntil).toBeGreaterThan(written.expiresAt);
		});

		it('normalizes username to lowercase', async () => {
			await writeCache(platform, 'TestUser', mockCollection);
			expect(kv.put).toHaveBeenCalledWith(
				'collection:testuser',
				expect.any(String),
				expect.any(Object)
			);
		});
	});

	describe('invalidateCache', () => {
		it('does nothing when no platform is provided', async () => {
			await invalidateCache(undefined, 'testuser');
			// No error thrown
		});

		it('deletes the cache key', async () => {
			await invalidateCache(platform, 'testuser');
			expect(kv.delete).toHaveBeenCalledWith('collection:testuser');
		});

		it('normalizes username to lowercase', async () => {
			await invalidateCache(platform, 'TestUser');
			expect(kv.delete).toHaveBeenCalledWith('collection:testuser');
		});
	});

	describe('kvGetJSON', () => {
		it('returns null when no platform is provided', async () => {
			const result = await kvGetJSON(undefined, 'price:123');
			expect(result).toBeNull();
		});

		it('returns the parsed JSON value on a hit', async () => {
			kv._store.set('price:123', JSON.stringify({ lowestPrice: 9.99 }));
			const result = await kvGetJSON<{ lowestPrice: number }>(platform, 'price:123');
			expect(result).toEqual({ lowestPrice: 9.99 });
			expect(kv.get).toHaveBeenCalledWith('price:123', 'json');
		});

		it('returns null on a miss', async () => {
			const result = await kvGetJSON(platform, 'price:missing');
			expect(result).toBeNull();
		});

		it('returns null (does not throw) when the store errors', async () => {
			kv.get.mockRejectedValueOnce(new Error('kv down'));
			const result = await kvGetJSON(platform, 'price:123');
			expect(result).toBeNull();
		});
	});

	describe('kvPutJSON', () => {
		it('does nothing when no platform is provided', async () => {
			await kvPutJSON(undefined, 'price:123', { lowestPrice: 1 }, 300);
			// no throw
		});

		it('stringifies the value and writes it with the given TTL', async () => {
			await kvPutJSON(platform, 'price:123', { lowestPrice: 9.99 }, 300);
			expect(kv.put).toHaveBeenCalledWith(
				'price:123',
				JSON.stringify({ lowestPrice: 9.99 }),
				{ expirationTtl: 300 }
			);
		});
	});
});
