import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnv } = vi.hoisted(() => ({
	mockEnv: {} as Record<string, string>
}));

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, body: unknown) => {
		const err = new Error(typeof body === 'string' ? body : (body as any)?.message) as Error & {
			status: number;
		};
		err.status = status;
		throw err;
	},
	redirect: (status: number, location: string) => {
		const err = new Error('redirect') as Error & { status: number; location: string };
		err.status = status;
		err.location = location;
		throw err;
	}
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

vi.mock('$lib/api/discogs', () => {
	class DiscogsAPIError extends Error {
		status: number;
		code?: string;
		constructor(message: string, status: number, code?: string) {
			super(message);
			this.name = 'DiscogsAPIError';
			this.status = status;
			this.code = code;
		}
	}
	return {
		fetchUserProfile: vi.fn(),
		fetchUserCollection: vi.fn(),
		computeCollectionStats: vi.fn(() => ({})),
		DiscogsAPIError
	};
});

vi.mock('$lib/server/cache', () => ({
	readCache: vi.fn(),
	writeCache: vi.fn()
}));

import { load } from './+page.server';
import {
	fetchUserProfile,
	fetchUserCollection,
	DiscogsAPIError
} from '$lib/api/discogs';
import { readCache, writeCache } from '$lib/server/cache';

interface ItemOverrides {
	master_id?: number;
	title?: string;
	artist?: string;
	genres?: string[];
	year?: number;
}

let instanceCounter = 0;
function item(o: ItemOverrides = {}) {
	instanceCounter += 1;
	return {
		instance_id: instanceCounter,
		basic_information: {
			id: instanceCounter,
			master_id: o.master_id ?? 0,
			title: o.title ?? 'Title',
			artists: [{ name: o.artist ?? 'Artist' }],
			genres: o.genres ?? [],
			year: o.year ?? 0
		}
	} as any;
}

function cacheEntry(username: string, items: any[]) {
	return {
		data: {
			profile: { username, avatar_url: `${username}.png` },
			items,
			stats: {},
			fetchedAt: 1,
			totalDiscogsItems: items.length
		},
		cachedAt: 1,
		stale: false
	};
}

function makeEvent(token: string | null = 'cookie-token') {
	return {
		params: { user1: 'alice', user2: 'bob' },
		platform: { env: { COLLECTION_CACHE: {} } },
		cookies: { get: vi.fn(() => token) }
	} as any;
}

describe('compare loader', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockEnv.DISCOGS_TOKEN = '';
		instanceCounter = 0;
	});

	it('redirects to /settings when no token is available', async () => {
		await expect(load(makeEvent(null))).rejects.toMatchObject({
			status: 303,
			location: expect.stringContaining('/settings')
		});
	});

	it('serves both collections from cache without hitting the API', async () => {
		vi.mocked(readCache).mockImplementation(async (_p: any, username: string) =>
			cacheEntry(username, [item({ master_id: 1 })]) as any
		);

		const result: any = await load(makeEvent());

		expect(fetchUserProfile).not.toHaveBeenCalled();
		expect(fetchUserCollection).not.toHaveBeenCalled();
		expect(result.user1.profile.username).toBe('alice');
		expect(result.user2.profile.username).toBe('bob');
	});

	it('fetches and caches a collection on a cache miss', async () => {
		vi.mocked(readCache).mockResolvedValue(null);
		vi.mocked(fetchUserProfile).mockImplementation(async (username: string) => ({
			username,
			avatar_url: `${username}.png`
		}) as any);
		vi.mocked(fetchUserCollection).mockResolvedValue({
			items: [item({ master_id: 1 })],
			totalItems: 1,
			totalPages: 1
		} as any);

		const result: any = await load(makeEvent());

		expect(fetchUserCollection).toHaveBeenCalledTimes(2);
		expect(writeCache).toHaveBeenCalledTimes(2);
		expect(result.user1.profile.username).toBe('alice');
	});

	it('computes overlap, unique sets, and similarity from master_id keys', async () => {
		const shared = { master_id: 1 };
		const collections: Record<string, any[]> = {
			alice: [item(shared), item({ master_id: 2 }), item({ master_id: 3 })],
			bob: [item(shared), item({ master_id: 4 })]
		};
		vi.mocked(readCache).mockImplementation(async (_p: any, username: string) =>
			cacheEntry(username, collections[username]) as any
		);

		const result: any = await load(makeEvent());
		const c = result.comparison;

		expect(c.overlapCount).toBe(1);
		expect(c.uniqueTo1).toHaveLength(2);
		expect(c.uniqueTo2).toHaveLength(1);
		// Jaccard: 1 shared / 4 unique albums = 25%
		expect(c.similarityScore).toBe(25);
	});

	it('falls back to title:artist keys when master_id is absent', async () => {
		const collections: Record<string, any[]> = {
			alice: [item({ master_id: 0, title: 'Kind of Blue', artist: 'Miles Davis' })],
			bob: [item({ master_id: 0, title: 'Kind of Blue', artist: 'Miles Davis' })]
		};
		vi.mocked(readCache).mockImplementation(async (_p: any, username: string) =>
			cacheEntry(username, collections[username]) as any
		);

		const result: any = await load(makeEvent());
		expect(result.comparison.overlapCount).toBe(1);
		expect(result.comparison.similarityScore).toBe(100);
	});

	it('computes shared artists, genre overlap, and decades', async () => {
		const collections: Record<string, any[]> = {
			alice: [item({ master_id: 1, artist: 'Pink Floyd', genres: ['Rock'], year: 1973 })],
			bob: [item({ master_id: 2, artist: 'Pink Floyd', genres: ['Rock'], year: 1979 })]
		};
		vi.mocked(readCache).mockImplementation(async (_p: any, username: string) =>
			cacheEntry(username, collections[username]) as any
		);

		const result: any = await load(makeEvent());
		const c = result.comparison;

		expect(c.sharedArtistsCount).toBe(1);
		expect(c.sharedArtists).toContain('Pink Floyd');
		expect(c.sharedGenres).toContain('Rock');
		expect(c.decades1['1970s']).toBe(1);
		expect(c.decades2['1970s']).toBe(1);
	});

	it('maps Discogs error codes to HTTP statuses', async () => {
		vi.mocked(readCache).mockResolvedValue(null);
		vi.mocked(fetchUserProfile).mockRejectedValue(
			new (DiscogsAPIError as any)('nope', 404, 'NOT_FOUND')
		);
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 404 });

		vi.mocked(fetchUserProfile).mockRejectedValue(
			new (DiscogsAPIError as any)('private', 403, 'PRIVATE')
		);
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 403 });

		vi.mocked(fetchUserProfile).mockRejectedValue(
			new (DiscogsAPIError as any)('slow', 429, 'RATE_LIMITED')
		);
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 429 });
	});

	it('redirects to /settings on a BAD_TOKEN error', async () => {
		vi.mocked(readCache).mockResolvedValue(null);
		vi.mocked(fetchUserProfile).mockRejectedValue(
			new (DiscogsAPIError as any)('bad', 401, 'BAD_TOKEN')
		);
		await expect(load(makeEvent())).rejects.toMatchObject({
			status: 303,
			location: expect.stringContaining('/settings')
		});
	});

	it('maps an unexpected (non-Discogs) error to a 500', async () => {
		vi.mocked(readCache).mockResolvedValue(null);
		vi.mocked(fetchUserProfile).mockRejectedValue(new Error('network down'));
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 500 });
	});
});
