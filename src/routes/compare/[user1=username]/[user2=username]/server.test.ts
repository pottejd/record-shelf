import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const err = new Error('redirect') as Error & { status: number; location: string };
		err.status = status; err.location = location; throw err;
	}
}));
vi.mock('$lib/server/sync', () => ({ readStored: vi.fn() }));
vi.mock('$lib/server/store', () => ({ getStore: vi.fn(() => ({ backend: 'memory' })) }));
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import { load } from './+page.server';
import { readStored } from '$lib/server/sync';

const event = (token?: string) => ({
	params: { user1: 'UserA', user2: 'UserB' }, platform: undefined,
	cookies: { get: (n: string) => (n === 'discogs_token' ? token : undefined) }
}) as any;

beforeEach(() => { vi.clearAllMocks(); (globalThis as any).process.env.DISCOGS_TOKEN = 'server-token-must-be-ignored'; });

describe('compare load', () => {
	it('redirects to settings without a token cookie and reads nothing', async () => {
		await expect(load(event())).rejects.toMatchObject({ status: 303, location: '/settings?redirect=/compare/UserA/UserB' });
		expect(readStored).not.toHaveBeenCalled();
	});
	it('returns both stored copies and never calls Discogs', async () => {
		vi.mocked(readStored).mockImplementation(async (_kind, username) => ({ snapshot: `S-${username}` }) as any);
		expect(await load(event('tok'))).toEqual({
			user1: { username: 'UserA', stored: { snapshot: 'S-UserA' } },
			user2: { username: 'UserB', stored: { snapshot: 'S-UserB' } }
		});
		expect(vi.mocked(readStored).mock.calls.map((c) => c.slice(0, 2))).toEqual([['collection', 'UserA'], ['collection', 'UserB']]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
	it('passes null through for a user with nothing stored', async () => {
		vi.mocked(readStored).mockResolvedValue(null);
		expect(await load(event('tok'))).toEqual({ user1: { username: 'UserA', stored: null }, user2: { username: 'UserB', stored: null } });
	});
});
