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
	params: { username: 'TestUser' }, platform: undefined,
	cookies: { get: (n: string) => (n === 'discogs_token' ? token : undefined) }
}) as any;

beforeEach(() => { vi.clearAllMocks(); (globalThis as any).process.env.DISCOGS_TOKEN = 'server-token-must-be-ignored'; });

describe('profile load', () => {
	it('redirects to settings without a token cookie, even when DISCOGS_TOKEN is set, and reads nothing', async () => {
		await expect(load(event())).rejects.toMatchObject({ status: 303, location: '/settings?redirect=/u/TestUser' });
		expect(readStored).not.toHaveBeenCalled();
	});
	it('returns the stored copy and never calls Discogs', async () => {
		const stored = { snapshot: 'S0', complete: true, firstPage: [] };
		vi.mocked(readStored).mockResolvedValue(stored as any);
		expect(await load(event('tok'))).toEqual({ username: 'TestUser', stored });
		expect(vi.mocked(readStored).mock.calls[0].slice(0, 2)).toEqual(['collection', 'TestUser']);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
	it('returns stored: null when nothing is stored', async () => {
		vi.mocked(readStored).mockResolvedValue(null);
		expect(await load(event('tok'))).toEqual({ username: 'TestUser', stored: null });
	});
});
