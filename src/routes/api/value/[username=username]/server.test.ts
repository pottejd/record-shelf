import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('value endpoint', () => {
	let POST: typeof import('./+server').POST;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.resetModules();
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
		mockEnv.DISCOGS_TOKEN = '';

		const mod = await import('./+server');
		POST = mod.POST;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		delete mockEnv.DISCOGS_TOKEN;
	});

	function makeEvent(releaseIds: unknown, token?: string) {
		const headers: Record<string, string> = { 'content-type': 'application/json' };
		if (token) headers['x-discogs-token'] = token;
		return {
			params: { username: 'testuser' },
			request: new Request('http://localhost/api/value/testuser', {
				method: 'POST',
				body: JSON.stringify({ releaseIds }),
				headers
			})
		} as any;
	}

	function makePriceResponse(
		nearMint?: { value: number; currency: string },
		vgPlus?: { value: number; currency: string }
	) {
		const data: Record<string, { value: number; currency: string }> = {};
		if (nearMint) data['Near Mint (NM or M-)'] = nearMint;
		if (vgPlus) data['Very Good Plus (VG+)'] = vgPlus;
		return { ok: true, json: async () => data };
	}

	it('returns 401 when no token provided', async () => {
		await expect(POST(makeEvent([1]))).rejects.toMatchObject({ status: 401 });
	});

	it('uses env DISCOGS_TOKEN as fallback', async () => {
		mockEnv.DISCOGS_TOKEN = 'env-token';
		mockFetch.mockResolvedValue(makePriceResponse({ value: 10, currency: 'USD' }));

		const promise = POST(makeEvent([1]));
		await vi.advanceTimersByTimeAsync(1200);
		const response = await promise;

		expect(response.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('price_suggestions/1'),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Discogs token=env-token' })
			})
		);
	});

	it('returns 400 when releaseIds is missing', async () => {
		const event = {
			params: { username: 'testuser' },
			request: new Request('http://localhost/api/value/testuser', {
				method: 'POST',
				body: JSON.stringify({}),
				headers: { 'content-type': 'application/json', 'x-discogs-token': 'tok' }
			})
		} as any;
		await expect(POST(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when releaseIds is empty array', async () => {
		await expect(POST(makeEvent([], 'tok'))).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when releaseIds is not an array', async () => {
		await expect(POST(makeEvent('notarray', 'tok'))).rejects.toMatchObject({ status: 400 });
	});

	it('caps releaseIds at 50 items', async () => {
		const ids = Array.from({ length: 60 }, (_, i) => i + 1);
		mockFetch.mockResolvedValue(makePriceResponse({ value: 5, currency: 'USD' }));

		const promise = POST(makeEvent(ids, 'tok'));
		await vi.advanceTimersByTimeAsync(60 * 1200);
		const response = await promise;
		const data = await response.json();

		expect(data.totalRequested).toBe(50);
		expect(mockFetch).toHaveBeenCalledTimes(50);
	});

	it('prefers NearMint over VG+', async () => {
		mockFetch.mockResolvedValue(
			makePriceResponse(
				{ value: 25, currency: 'USD' },
				{ value: 15, currency: 'USD' }
			)
		);

		const promise = POST(makeEvent([1], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		const response = await promise;
		const data = await response.json();

		expect(data.results[0].lowestPrice).toBe(25);
	});

	it('falls back to VG+ when NearMint missing', async () => {
		mockFetch.mockResolvedValue(
			makePriceResponse(undefined, { value: 15, currency: 'EUR' })
		);

		const promise = POST(makeEvent([1], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		const response = await promise;
		const data = await response.json();

		expect(data.results[0].lowestPrice).toBe(15);
		expect(data.results[0].currency).toBe('EUR');
	});

	it('returns null price when no conditions available', async () => {
		mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

		const promise = POST(makeEvent([1], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		const response = await promise;
		const data = await response.json();

		expect(data.results[0].lowestPrice).toBeNull();
		expect(data.results[0].currency).toBe('USD');
	});

	it('aggregates totalValue and pricedCount', async () => {
		mockFetch
			.mockResolvedValueOnce(makePriceResponse({ value: 10, currency: 'USD' }))
			.mockResolvedValueOnce(makePriceResponse({ value: 20, currency: 'USD' }))
			.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

		const promise = POST(makeEvent([1, 2, 3], 'tok'));
		await vi.advanceTimersByTimeAsync(4 * 1200);
		const response = await promise;
		const data = await response.json();

		expect(data.totalValue).toBe(30);
		expect(data.pricedCount).toBe(2);
		expect(data.totalRequested).toBe(3);
	});

	it('returns null price on fetch failure', async () => {
		mockFetch.mockRejectedValue(new Error('Network error'));

		const promise = POST(makeEvent([1], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		const response = await promise;
		const data = await response.json();

		expect(data.results[0].lowestPrice).toBeNull();
		expect(data.totalValue).toBe(0);
	});

	it('returns null price on non-ok response', async () => {
		mockFetch.mockResolvedValue({ ok: false, status: 404 });

		const promise = POST(makeEvent([1], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		const response = await promise;
		const data = await response.json();

		expect(data.results[0].lowestPrice).toBeNull();
	});

	it('returns cached data without fetching again', async () => {
		mockFetch.mockResolvedValue(makePriceResponse({ value: 42, currency: 'USD' }));

		// First call populates cache
		const promise1 = POST(makeEvent([100], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		await promise1;

		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Second call should use cache
		const promise2 = POST(makeEvent([100], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		const response2 = await promise2;
		const data = await response2.json();

		expect(mockFetch).toHaveBeenCalledTimes(1); // no additional fetch
		expect(data.results[0].lowestPrice).toBe(42);
	});

	it('refetches after cache TTL expires', async () => {
		mockFetch
			.mockResolvedValueOnce(makePriceResponse({ value: 10, currency: 'USD' }))
			.mockResolvedValueOnce(makePriceResponse({ value: 20, currency: 'USD' }));

		// First call populates cache
		const promise1 = POST(makeEvent([200], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		await promise1;

		// Advance past TTL (1 hour)
		await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1000);

		// Second call should refetch (cache expired)
		const promise2 = POST(makeEvent([200], 'tok'));
		await vi.advanceTimersByTimeAsync(1200);
		const response2 = await promise2;
		const data = await response2.json();

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(data.results[0].lowestPrice).toBe(20);
	});

	it('returns 400 on a malformed JSON body', async () => {
		const event = {
			params: { username: 'testuser' },
			request: new Request('http://localhost/api/value/testuser', {
				method: 'POST',
				body: 'not-json{',
				headers: { 'content-type': 'application/json', 'x-discogs-token': 'tok' }
			})
		} as any;
		await expect(POST(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 on a literal null JSON body (not a 500)', async () => {
		const event = {
			params: { username: 'testuser' },
			request: new Request('http://localhost/api/value/testuser', {
				method: 'POST',
				body: 'null',
				headers: { 'content-type': 'application/json', 'x-discogs-token': 'tok' }
			})
		} as any;
		await expect(POST(event)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when no valid positive integer ids remain', async () => {
		await expect(POST(makeEvent(['x', -1, 0, 2.5], 'tok'))).rejects.toMatchObject({ status: 400 });
	});

	it('filters out non-integer ids and queries only the valid ones', async () => {
		mockFetch.mockResolvedValue(makePriceResponse({ value: 5, currency: 'USD' }));

		const promise = POST(makeEvent([1, 'x', -2, 3.5, 2], 'tok'));
		await vi.advanceTimersByTimeAsync(3 * 1200);
		const response = await promise;
		const data = await response.json();

		expect(data.totalRequested).toBe(2);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('prefers the discogs_token cookie over the env token', async () => {
		mockEnv.DISCOGS_TOKEN = 'env-token';
		mockFetch.mockResolvedValue(makePriceResponse({ value: 10, currency: 'USD' }));

		const event = {
			params: { username: 'testuser' },
			cookies: { get: (n: string) => (n === 'discogs_token' ? 'cookie-token' : undefined) },
			request: new Request('http://localhost/api/value/testuser', {
				method: 'POST',
				body: JSON.stringify({ releaseIds: [1] }),
				headers: { 'content-type': 'application/json' }
			})
		} as any;

		const promise = POST(event);
		await vi.advanceTimersByTimeAsync(1200);
		await promise;

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('price_suggestions/1'),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Discogs token=cookie-token' })
			})
		);
	});
});
