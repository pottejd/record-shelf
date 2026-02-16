import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: ResponseInit) =>
		new Response(JSON.stringify(data), {
			status: (init as any)?.status ?? 200,
			headers: { 'content-type': 'application/json' }
		})
}));

vi.mock('$lib/constants', () => ({ USER_AGENT: 'TestAgent/1.0' }));

import { POST } from './+server';

describe('test-token endpoint', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function makeEvent(token?: string) {
		const headers: Record<string, string> = { 'content-type': 'application/json' };
		if (token) headers['X-Discogs-Token'] = token;
		return {
			request: new Request('http://localhost/api/test-token', {
				method: 'POST',
				headers
			})
		} as any;
	}

	it('returns 400 when no token provided', async () => {
		const response = await POST(makeEvent());
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('No token provided');
	});

	it('returns 401 for invalid token', async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({})
		});

		const response = await POST(makeEvent('bad-token'));
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.error).toBe('Invalid token');
	});

	it('returns 200 with username for valid token', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ username: 'testuser' })
		});

		const response = await POST(makeEvent('good-token'));
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.username).toBe('testuser');
		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.discogs.com/oauth/identity',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Discogs token=good-token' })
			})
		);
	});

	it('returns 500 on network failure', async () => {
		mockFetch.mockRejectedValue(new Error('Network error'));

		const response = await POST(makeEvent('some-token'));
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBe('Failed to connect to Discogs');
	});

	it('returns upstream status for other error codes', async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 503,
			json: async () => ({})
		});

		const response = await POST(makeEvent('some-token'));
		const data = await response.json();

		expect(response.status).toBe(503);
		expect(data.error).toBe('Failed to verify token');
	});
});
