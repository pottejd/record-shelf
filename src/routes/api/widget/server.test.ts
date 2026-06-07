import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnv, kvStore } = vi.hoisted(() => ({
	mockEnv: {} as Record<string, string>,
	kvStore: new Map<string, unknown>()
}));

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: ResponseInit) =>
		new Response(JSON.stringify(data), {
			status: (init as any)?.status ?? 200,
			headers: { 'content-type': 'application/json', ...((init as any)?.headers ?? {}) }
		})
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
		fetchUserProfile: vi.fn(),
		fetchCollectionPage: vi.fn(),
		DiscogsAPIError
	};
});

vi.mock('$lib/server/cache', () => ({
	kvGetJSON: vi.fn(async (_platform: unknown, key: string) => kvStore.get(key) ?? null),
	kvPutJSON: vi.fn(async (_platform: unknown, key: string, value: unknown) => {
		kvStore.set(key, value);
	})
}));

import { GET } from './+server';
import { fetchUserProfile, fetchCollectionPage, DiscogsAPIError } from '$lib/api/discogs';

function event() {
	return { platform: {} } as any;
}

describe('widget endpoint', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		kvStore.clear();
		mockEnv.WIDGET_USERNAME = 'pottejd';
		mockEnv.DISCOGS_TOKEN = '';
	});

	it('returns the cached payload without fetching when KV has one', async () => {
		const cached = { appName: 'Record Shelf', items: [{ label: 'x', value: 'y', type: 'z' }] };
		kvStore.set('widget:pottejd', cached);

		const res = await GET(event());
		const data = await res.json();

		expect(data).toEqual(cached);
		expect(fetchUserProfile).not.toHaveBeenCalled();
		expect(res.headers.get('access-control-allow-origin')).toBe('*');
	});

	it('returns a "Token not configured" fallback when no token is set', async () => {
		const res = await GET(event());
		const data = await res.json();

		expect(data.appName).toBe('Record Shelf');
		expect(data.items[0].value).toBe('Token not configured');
		expect(fetchCollectionPage).not.toHaveBeenCalled();
	});

	it('builds a collection count plus recent items and caches the result', async () => {
		mockEnv.DISCOGS_TOKEN = 'server-token';
		vi.mocked(fetchUserProfile).mockResolvedValue({ num_collection: 1234 } as any);
		vi.mocked(fetchCollectionPage).mockResolvedValue({
			items: [
				{ basic_information: { artists: [{ name: 'Radiohead' }], title: 'OK Computer' } },
				{ basic_information: { artists: [{ name: 'Portishead' }], title: 'Dummy' } }
			],
			pagination: {}
		} as any);

		const res = await GET(event());
		const data = await res.json();

		expect(data.items[0]).toMatchObject({ label: 'Collection', value: '1234 records' });
		expect(data.items.some((i: any) => i.value.includes('OK Computer'))).toBe(true);
		expect(kvStore.get('widget:pottejd')).toBeTruthy();
	});

	it('falls back to "0 records" when the profile has no collection count', async () => {
		mockEnv.DISCOGS_TOKEN = 'server-token';
		vi.mocked(fetchUserProfile).mockResolvedValue({} as any);
		vi.mocked(fetchCollectionPage).mockResolvedValue({ items: [], pagination: {} } as any);

		const res = await GET(event());
		const data = await res.json();
		expect(data.items[0].value).toBe('0 records');
	});

	it('returns the Discogs error message in a fallback on failure', async () => {
		mockEnv.DISCOGS_TOKEN = 'server-token';
		vi.mocked(fetchUserProfile).mockRejectedValue(
			new (DiscogsAPIError as any)('User not found', 404, 'NOT_FOUND')
		);
		vi.mocked(fetchCollectionPage).mockRejectedValue(
			new (DiscogsAPIError as any)('User not found', 404, 'NOT_FOUND')
		);

		const res = await GET(event());
		const data = await res.json();
		expect(data.items[0].value).toBe('User not found');
	});
});
