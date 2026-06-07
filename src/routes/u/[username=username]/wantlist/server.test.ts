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
	return {
		fetchUserProfile: vi.fn(),
		fetchUserWantlist: vi.fn(),
		DiscogsAPIError
	};
});

import { load } from './+page.server';
import { fetchUserProfile, fetchUserWantlist, DiscogsAPIError } from '$lib/api/discogs';

function makeEvent(token: string | null = 'cookie-token') {
	return {
		params: { username: 'testuser' },
		cookies: { get: vi.fn(() => token) }
	} as any;
}

describe('wantlist loader', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockEnv.DISCOGS_TOKEN = '';
	});

	it('redirects to /settings (preserving the wantlist path) when no token', async () => {
		await expect(load(makeEvent(null))).rejects.toMatchObject({
			status: 303,
			location: expect.stringContaining('/wantlist')
		});
	});

	it('returns the profile and wantlist on success', async () => {
		vi.mocked(fetchUserProfile).mockResolvedValue({ username: 'testuser' } as any);
		vi.mocked(fetchUserWantlist).mockResolvedValue([{ id: 1 }] as any);

		const result: any = await load(makeEvent());

		expect(result.profile.username).toBe('testuser');
		expect(result.wantlist).toHaveLength(1);
	});

	it('maps NOT_FOUND to a 404', async () => {
		vi.mocked(fetchUserProfile).mockRejectedValue(
			new (DiscogsAPIError as any)('missing', 404, 'NOT_FOUND')
		);
		vi.mocked(fetchUserWantlist).mockRejectedValue(
			new (DiscogsAPIError as any)('missing', 404, 'NOT_FOUND')
		);
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 404 });
	});

	it('maps RATE_LIMITED to a 429', async () => {
		vi.mocked(fetchUserProfile).mockRejectedValue(
			new (DiscogsAPIError as any)('slow down', 429, 'RATE_LIMITED')
		);
		vi.mocked(fetchUserWantlist).mockRejectedValue(
			new (DiscogsAPIError as any)('slow down', 429, 'RATE_LIMITED')
		);
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 429 });
	});

	it('passes through the status of other Discogs errors', async () => {
		vi.mocked(fetchUserProfile).mockRejectedValue(
			new (DiscogsAPIError as any)('teapot', 418, 'UPSTREAM_ERROR')
		);
		vi.mocked(fetchUserWantlist).mockRejectedValue(
			new (DiscogsAPIError as any)('teapot', 418, 'UPSTREAM_ERROR')
		);
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 418 });
	});

	it('maps an unexpected (non-Discogs) error to a 500', async () => {
		vi.mocked(fetchUserProfile).mockRejectedValue(new Error('boom'));
		vi.mocked(fetchUserWantlist).mockRejectedValue(new Error('boom'));
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 500 });
	});
});
