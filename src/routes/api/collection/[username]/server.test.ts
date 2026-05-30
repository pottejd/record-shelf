import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnv } = vi.hoisted(() => ({
	mockEnv: {} as Record<string, string>
}));

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: ResponseInit) =>
		new Response(JSON.stringify(data), {
			status: (init as any)?.status ?? 200,
			headers: { 'content-type': 'application/json' }
		}),
	error: (status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
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
	return {
		fetchFullUserCollection: vi.fn(),
		fetchCollectionPage: vi.fn(),
		DiscogsAPIError
	};
});

vi.mock('$lib/server/cache', () => ({
	readCache: vi.fn(),
	writeCache: vi.fn(),
	invalidateCache: vi.fn()
}));

import { GET, DELETE } from './+server';
import { fetchFullUserCollection, fetchCollectionPage, DiscogsAPIError } from '$lib/api/discogs';
import { readCache, writeCache, invalidateCache } from '$lib/server/cache';

const mockCollection = {
	profile: { username: 'testuser' },
	items: [],
	stats: { totalItems: 0 },
	fetchedAt: Date.now(),
	totalDiscogsItems: 0
};

function makeGetEvent(overrides: {
	username?: string;
	page?: string;
	token?: string;
	envToken?: string;
} = {}) {
	const { username = 'testuser', page, token = 'cookie-token', envToken } = overrides;
	if (envToken) mockEnv.DISCOGS_TOKEN = envToken;

	const url = new URL(`http://localhost/api/collection/${username}`);
	if (page) url.searchParams.set('page', page);

	return {
		params: { username },
		platform: { env: { COLLECTION_CACHE: {} } },
		cookies: { get: vi.fn((name: string) => name === 'discogs_token' ? token : null) },
		url
	} as any;
}

function makeDeleteEvent(token?: string) {
	return {
		params: { username: 'testuser' },
		platform: { env: { COLLECTION_CACHE: {} } },
		cookies: { get: vi.fn((name: string) => name === 'discogs_token' ? (token ?? null) : null) }
	} as any;
}

describe('collection endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.DISCOGS_TOKEN = '';
	});

	describe('GET', () => {
		it('returns cached data when available', async () => {
			vi.mocked(readCache).mockResolvedValue({
				data: mockCollection as any,
				cachedAt: Date.now(),
				stale: false
			});

			const response = await GET(makeGetEvent());
			const data = await response.json();

			expect(data.cached).toBe(true);
			expect(readCache).toHaveBeenCalled();
			expect(fetchFullUserCollection).not.toHaveBeenCalled();
		});

		it('calls fetchCollectionPage when page param provided', async () => {
			const pageResult = {
				items: [{ id: 1 }],
				pagination: { page: 2, pages: 5, per_page: 100, items: 500, urls: {} }
			};
			vi.mocked(fetchCollectionPage).mockResolvedValue(pageResult as any);

			const response = await GET(makeGetEvent({ page: '2' }));
			const data = await response.json();

			expect(fetchCollectionPage).toHaveBeenCalledWith('testuser', 2, expect.objectContaining({ token: 'cookie-token' }));
			expect(data.items).toEqual([{ id: 1 }]);
		});

		it('returns 400 for invalid page number', async () => {
			await expect(GET(makeGetEvent({ page: 'abc' }))).rejects.toMatchObject({ status: 400 });
		});

		it('returns 400 for page number less than 1', async () => {
			await expect(GET(makeGetEvent({ page: '0' }))).rejects.toMatchObject({ status: 400 });
		});

		it('fetches full collection and writes cache when not cached', async () => {
			vi.mocked(readCache).mockResolvedValue(null);
			vi.mocked(fetchFullUserCollection).mockResolvedValue(mockCollection as any);

			const response = await GET(makeGetEvent());
			const data = await response.json();

			expect(fetchFullUserCollection).toHaveBeenCalled();
			expect(writeCache).toHaveBeenCalled();
			expect(data.cached).toBe(false);
		});

		it('returns 401 when no token available', async () => {
			await expect(GET(makeGetEvent({ token: '' }))).rejects.toMatchObject({ status: 401 });
		});

		it('maps NOT_FOUND to 404', async () => {
			vi.mocked(readCache).mockResolvedValue(null);
			vi.mocked(fetchFullUserCollection).mockRejectedValue(
				new DiscogsAPIError('Not found', 404, 'NOT_FOUND')
			);

			await expect(GET(makeGetEvent())).rejects.toMatchObject({ status: 404 });
		});

		it('maps PRIVATE to 403', async () => {
			vi.mocked(readCache).mockResolvedValue(null);
			vi.mocked(fetchFullUserCollection).mockRejectedValue(
				new DiscogsAPIError('Private', 403, 'PRIVATE')
			);

			await expect(GET(makeGetEvent())).rejects.toMatchObject({ status: 403 });
		});

		it('maps RATE_LIMITED to 429', async () => {
			vi.mocked(readCache).mockResolvedValue(null);
			vi.mocked(fetchFullUserCollection).mockRejectedValue(
				new DiscogsAPIError('Rate limited', 429, 'RATE_LIMITED')
			);

			await expect(GET(makeGetEvent())).rejects.toMatchObject({ status: 429 });
		});

		it('maps page fetch RATE_LIMITED to 429', async () => {
			vi.mocked(fetchCollectionPage).mockRejectedValue(
				new DiscogsAPIError('Rate limited', 429, 'RATE_LIMITED')
			);

			await expect(GET(makeGetEvent({ page: '1' }))).rejects.toMatchObject({ status: 429 });
		});
	});

	describe('DELETE', () => {
		it('returns 401 when no token', async () => {
			await expect(DELETE(makeDeleteEvent())).rejects.toMatchObject({ status: 401 });
		});

		it('invalidates cache with valid token', async () => {
			const response = await DELETE(makeDeleteEvent('my-token'));
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(invalidateCache).toHaveBeenCalled();
		});

		it('uses env token as fallback', async () => {
			mockEnv.DISCOGS_TOKEN = 'env-token';

			const response = await DELETE(makeDeleteEvent());
			const data = await response.json();

			expect(data.success).toBe(true);
		});
	});
});
