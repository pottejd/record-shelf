import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readCache, writeCache, invalidateCache } from './cache';
import type { UserCollection } from '$lib/types/discogs';

// Mock constants
vi.mock('$lib/constants', () => ({
	CACHE_TTL_MS: 3600000,
	CACHE_TTL_SECONDS: 3600
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
	fetchedAt: Date.now()
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

		it('returns cached data when valid', async () => {
			const cached = {
				data: mockCollection,
				cachedAt: Date.now(),
				expiresAt: Date.now() + 3600000
			};
			kv._store.set('collection:testuser', JSON.stringify(cached));

			const result = await readCache(platform, 'testuser');
			expect(result).not.toBeNull();
			expect(result!.data).toEqual(mockCollection);
		});

		it('returns null when cache is expired', async () => {
			const cached = {
				data: mockCollection,
				cachedAt: Date.now() - 7200000,
				expiresAt: Date.now() - 3600000 // expired 1 hour ago
			};
			kv._store.set('collection:testuser', JSON.stringify(cached));

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

		it('writes data to KV store', async () => {
			await writeCache(platform, 'testuser', mockCollection);
			expect(kv.put).toHaveBeenCalledTimes(1);
			expect(kv.put).toHaveBeenCalledWith(
				'collection:testuser',
				expect.any(String),
				{ expirationTtl: 3600 }
			);
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
});
