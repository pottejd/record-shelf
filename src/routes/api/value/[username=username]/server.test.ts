import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { POST } from './+server';
import { getStore, resetMemoryStoreForTests } from '$lib/server/store';

describe('value endpoint', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetMemoryStoreForTests();
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		delete (globalThis as any).process.env.DISCOGS_TOKEN;
	});

	function makeEvent(opts: {
		releaseIds: unknown;
		cookieToken?: string;
		headers?: Record<string, string>;
		body?: string;
	}) {
		return {
			params: { username: 'testuser' },
			cookies: { get: (n: string) => (n === 'discogs_token' ? opts.cookieToken : undefined) },
			request: new Request('http://localhost/api/value/testuser', {
				method: 'POST',
				body: opts.body ?? JSON.stringify({ releaseIds: opts.releaseIds }),
				headers: { 'content-type': 'application/json', ...opts.headers }
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
		return new Response(JSON.stringify(data));
	}

	it('returns 401 when no token provided', async () => {
		await expect(POST(makeEvent({ releaseIds: [1] }))).rejects.toMatchObject({ status: 401 });
	});

	it('401 without a token cookie even when DISCOGS_TOKEN and an x-discogs-token header are present', async () => {
		(globalThis as any).process.env.DISCOGS_TOKEN = 'server';
		await expect(POST(makeEvent({ cookieToken: undefined, headers: { 'x-discogs-token': 'hdr' }, releaseIds: [1] }))).rejects.toMatchObject({ status: 401 });
		expect(fetch).not.toHaveBeenCalled();
	});

	it('sends the cookie token to Discogs', async () => {
		vi.mocked(fetch).mockResolvedValue(makePriceResponse({ value: 10, currency: 'USD' }));

		const promise = POST(makeEvent({ releaseIds: [1], cookieToken: 'cookie-token' }));
		await vi.runAllTimersAsync();
		await promise;

		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('price_suggestions/1'),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Discogs token=cookie-token' })
			})
		);
	});

	it('returns 400 when releaseIds is missing', async () => {
		await expect(
			POST(makeEvent({ releaseIds: undefined, cookieToken: 'tok', body: JSON.stringify({}) }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when releaseIds is empty array', async () => {
		await expect(POST(makeEvent({ releaseIds: [], cookieToken: 'tok' }))).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when releaseIds is not an array', async () => {
		await expect(POST(makeEvent({ releaseIds: 'notarray', cookieToken: 'tok' }))).rejects.toMatchObject({ status: 400 });
	});

	it('caps releaseIds at 20 items', async () => {
		const ids = Array.from({ length: 60 }, (_, i) => i + 1);
		vi.mocked(fetch).mockImplementation(async () => makePriceResponse({ value: 5, currency: 'USD' }));

		const promise = POST(makeEvent({ releaseIds: ids, cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		expect(data.totalRequested).toBe(20);
		expect(fetch).toHaveBeenCalledTimes(20);
	});

	it('prefers NearMint over VG+', async () => {
		vi.mocked(fetch).mockResolvedValue(
			makePriceResponse({ value: 25, currency: 'USD' }, { value: 15, currency: 'USD' })
		);

		const promise = POST(makeEvent({ releaseIds: [1], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		expect(data.results[0].lowestPrice).toBe(25);
	});

	it('falls back to VG+ when NearMint missing', async () => {
		vi.mocked(fetch).mockResolvedValue(makePriceResponse(undefined, { value: 15, currency: 'EUR' }));

		const promise = POST(makeEvent({ releaseIds: [1], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		expect(data.results[0].lowestPrice).toBe(15);
		expect(data.results[0].currency).toBe('EUR');
	});

	it('returns null price when no conditions available', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response('{}'));

		const promise = POST(makeEvent({ releaseIds: [1], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		expect(data.results[0].lowestPrice).toBeNull();
		expect(data.results[0].currency).toBe('USD');
	});

	it('aggregates totalValue and pricedCount', async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(makePriceResponse({ value: 10, currency: 'USD' }))
			.mockResolvedValueOnce(makePriceResponse({ value: 20, currency: 'USD' }))
			.mockResolvedValueOnce(new Response('{}'));

		const promise = POST(makeEvent({ releaseIds: [1, 2, 3], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		expect(data.totalValue).toBe(30);
		expect(data.pricedCount).toBe(2);
		expect(data.totalRequested).toBe(3);
	});

	it('sums only the dominant currency when results are mixed (no FX mixing)', async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(makePriceResponse({ value: 10, currency: 'USD' }))
			.mockResolvedValueOnce(makePriceResponse({ value: 100, currency: 'EUR' }));

		const promise = POST(makeEvent({ releaseIds: [1, 2], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		// Display currency is the first priced result's; the EUR item is excluded
		// from the total rather than added as if it were USD.
		expect(data.currency).toBe('USD');
		expect(data.totalValue).toBe(10);
		expect(data.pricedCount).toBe(1);
	});

	it('returns null price on fetch failure', async () => {
		vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

		const promise = POST(makeEvent({ releaseIds: [1], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		expect(data.results[0].lowestPrice).toBeNull();
		expect(data.failedCount).toBe(1);
		expect(data.totalValue).toBe(0);
	});

	it('returns null price on non-ok response', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 404 }));

		const promise = POST(makeEvent({ releaseIds: [1], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		expect(data.results[0].lowestPrice).toBeNull();
		expect(data.failedCount).toBe(1);
	});

	it('returns cached data without fetching again', async () => {
		vi.mocked(fetch).mockResolvedValue(makePriceResponse({ value: 42, currency: 'USD' }));

		const promise1 = POST(makeEvent({ releaseIds: [100], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		await promise1;

		expect(fetch).toHaveBeenCalledTimes(1);

		const promise2 = POST(makeEvent({ releaseIds: [100], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise2).json();

		expect(fetch).toHaveBeenCalledTimes(1); // no additional fetch
		expect(data.results[0].lowestPrice).toBe(42);
	});

	it('refetches after the price has expired', async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(makePriceResponse({ value: 10, currency: 'USD' }))
			.mockResolvedValueOnce(makePriceResponse({ value: 20, currency: 'USD' }));

		const promise1 = POST(makeEvent({ releaseIds: [200], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		await promise1;

		// Advance past the 6-hour TTL
		await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000 + 1000);

		const promise2 = POST(makeEvent({ releaseIds: [200], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise2).json();

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(data.results[0].lowestPrice).toBe(20);
	});

	it('returns 400 on a malformed JSON body', async () => {
		await expect(
			POST(makeEvent({ releaseIds: undefined, cookieToken: 'tok', body: 'not-json{' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 on a literal null JSON body (not a 500)', async () => {
		await expect(
			POST(makeEvent({ releaseIds: undefined, cookieToken: 'tok', body: 'null' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when no valid positive integer ids remain', async () => {
		await expect(
			POST(makeEvent({ releaseIds: ['x', -1, 0, 2.5], cookieToken: 'tok' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('filters out non-integer ids and queries only the valid ones', async () => {
		vi.mocked(fetch).mockImplementation(async () => makePriceResponse({ value: 5, currency: 'USD' }));

		const promise = POST(makeEvent({ releaseIds: [1, 'x', -2, 3.5, 2], cookieToken: 'tok' }));
		await vi.runAllTimersAsync();
		const data = await (await promise).json();

		expect(data.totalRequested).toBe(2);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('stops at the first 429 and returns the partial result with retryAfterMs', async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(new Response(JSON.stringify({ 'Near Mint (NM or M-)': { currency: 'USD', value: 10 } })))
			.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '9' } }));
		const p = POST(makeEvent({ cookieToken: 'tok', releaseIds: [1, 2, 3] }));
		await vi.runAllTimersAsync();
		const body = await (await p).json();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(body).toMatchObject({ retryAfterMs: 9000, totalRequested: 3, pricedCount: 1, totalValue: 10 });
		expect(body.results.map((r: any) => r.releaseId)).toEqual([1]);
	});

	it('a rejected token (401) stops at once with a 401, after a single Discogs call', async () => {
		vi.mocked(fetch).mockImplementation(async () => new Response('{}', { status: 401 }));
		const p = POST(makeEvent({ cookieToken: 'bad', releaseIds: [1, 2, 3] }));
		const rejected = expect(p).rejects.toMatchObject({ status: 401 });
		await vi.runAllTimersAsync();
		await rejected;
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('uses a price stored within 6 hours without fetching, and refetches one older than 6 hours', async () => {
		const store = getStore(undefined);
		await store.putJSON('price:1', { lowestPrice: 5, currency: 'USD', timestamp: Date.now() - (6 * 3_600_000 - 1000) }, 99999);
		await store.putJSON('price:2', { lowestPrice: 5, currency: 'USD', timestamp: Date.now() - 6 * 3_600_000 }, 99999);
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ 'Near Mint (NM or M-)': { currency: 'USD', value: 8 } })));
		const p = POST(makeEvent({ cookieToken: 'tok', releaseIds: [1, 2] }));
		await vi.runAllTimersAsync();
		const body = await (await p).json();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(body.totalValue).toBe(13);
	});
});
