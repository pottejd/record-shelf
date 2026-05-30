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
vi.mock('$lib/constants', () => ({ USER_AGENT: 'TestAgent/1.0' }));

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
	return { fetchFullUserCollection: vi.fn(), DiscogsAPIError };
});

vi.mock('$lib/server/cache', () => ({
	readCache: vi.fn(),
	writeCache: vi.fn()
}));

import { load } from './+page.server';
import { fetchFullUserCollection } from '$lib/api/discogs';
import { readCache, writeCache } from '$lib/server/cache';

function makeCollection(itemCount: number, totalDiscogsItems: number) {
	return {
		profile: { username: 'testuser' },
		items: new Array(itemCount).fill({ id: 1 }),
		stats: { totalItems: itemCount },
		fetchedAt: Date.now(),
		totalDiscogsItems
	} as any;
}

function makeLoadEvent(overrides: { withWaitUntil?: boolean } = {}) {
	const { withWaitUntil = true } = overrides;
	const platform: any = { env: { COLLECTION_CACHE: {} } };
	if (withWaitUntil) {
		platform.context = { waitUntil: vi.fn() };
	}
	return {
		params: { username: 'testuser' },
		platform,
		cookies: { get: vi.fn((name: string) => (name === 'discogs_token' ? 'cookie-token' : null)) }
	} as any;
}

describe('profile loader caching', () => {
	beforeEach(() => {
		// resetAllMocks (not clearAllMocks) so any unconsumed mockResolvedValueOnce
		// queue from a prior test cannot leak into the next one.
		vi.resetAllMocks();
		mockEnv.DISCOGS_TOKEN = '';
		vi.mocked(readCache).mockResolvedValue(null);
	});

	it('returns cached data without fetching when a cache entry exists', async () => {
		vi.mocked(readCache).mockResolvedValue({
			data: makeCollection(250, 250),
			cachedAt: 123,
			stale: false
		});

		const result = (await load(makeLoadEvent())) as { collection: unknown; cached: boolean };

		expect(result.cached).toBe(true);
		expect(fetchFullUserCollection).not.toHaveBeenCalled();
	});

	it('caches a complete collection synchronously', async () => {
		const complete = makeCollection(5, 5);
		vi.mocked(fetchFullUserCollection).mockResolvedValue(complete);
		const event = makeLoadEvent();

		const result = (await load(event)) as { collection: unknown; cached: boolean };

		expect(result.cached).toBe(false);
		expect(writeCache).toHaveBeenCalledWith(event.platform, 'testuser', complete);
		expect(event.platform.context.waitUntil).not.toHaveBeenCalled();
	});

	it('caches a large (>1 page) collection in the background via waitUntil', async () => {
		const firstPage = makeCollection(100, 250); // incomplete: only page 1
		const full = makeCollection(250, 250); // the background full fetch
		vi.mocked(fetchFullUserCollection)
			.mockResolvedValueOnce(firstPage)
			.mockResolvedValueOnce(full);
		const event = makeLoadEvent();

		const result = (await load(event)) as { collection: unknown; cached: boolean };

		// Fast path returns page 1 without blocking on the full fetch
		expect(result.cached).toBe(false);
		expect(result.collection).toBe(firstPage);
		// Did NOT write the incomplete page-1 collection
		expect(writeCache).not.toHaveBeenCalledWith(event.platform, 'testuser', firstPage);
		// Registered a background task
		expect(event.platform.context.waitUntil).toHaveBeenCalledTimes(1);

		// Drain the background task: it fetches the full collection and caches it
		await event.platform.context.waitUntil.mock.calls[0][0];
		expect(fetchFullUserCollection).toHaveBeenCalledTimes(2);
		expect(writeCache).toHaveBeenCalledWith(event.platform, 'testuser', full);
	});

	it('does not background-fetch a large collection when waitUntil is unavailable', async () => {
		const firstPage = makeCollection(100, 250);
		vi.mocked(fetchFullUserCollection).mockResolvedValue(firstPage);

		const result = (await load(makeLoadEvent({ withWaitUntil: false }))) as {
			collection: unknown;
			cached: boolean;
		};

		expect(result.cached).toBe(false);
		// Only the initial page-1 fetch; no background full fetch, no write
		expect(fetchFullUserCollection).toHaveBeenCalledTimes(1);
		expect(writeCache).not.toHaveBeenCalled();
	});
});
