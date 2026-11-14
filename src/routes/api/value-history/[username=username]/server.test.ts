import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: ResponseInit) =>
		new Response(JSON.stringify(data), {
			status: (init as any)?.status ?? 200,
			headers: { 'content-type': 'application/json' }
		}),
	error: (status: number, message: unknown) => {
		const err = new Error(typeof message === 'string' ? message : (message as any)?.message) as Error & {
			status: number;
		};
		err.status = status;
		throw err;
	}
}));

const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import { GET, POST } from './+server';
import { fingerprint, resetWritersWarningForTests } from '$lib/server/writers';
import { getStore, resetMemoryStoreForTests } from '$lib/server/store';

const KEY = 'value-history:testuser';

function event(opts: { token?: string; body?: unknown } = {}) {
	const cookies = { get: (n: string) => (n === 'discogs_token' ? opts.token : undefined) };
	const base: any = { params: { username: 'testuser' }, platform: undefined, cookies };
	if (opts.body !== undefined) {
		base.request = new Request('http://localhost/api/value-history/testuser', {
			method: 'POST',
			body: typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
			headers: { 'content-type': 'application/json' }
		});
	}
	return base;
}

describe('value-history endpoint', () => {
	beforeEach(async () => {
		resetWritersWarningForTests();
		for (const k of Object.keys(mockEnv)) delete mockEnv[k];
		// 'tok' is the one token allowed to write to the shared store.
		mockEnv.STORE_WRITERS = await fingerprint('tok');
		resetMemoryStoreForTests();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (globalThis as any).process.env.DISCOGS_TOKEN;
	});

	it('GET requires a token', async () => {
		await expect(GET(event())).rejects.toMatchObject({ status: 401 });
	});

	it('GET returns an empty history when nothing is stored', async () => {
		const res = await GET(event({ token: 'tok' }));
		expect(await res.json()).toEqual({ history: [] });
	});

	it('GET tolerates a non-array stored payload by returning empty', async () => {
		await getStore(undefined).putJSON(KEY, { not: 'an array' }, 1000);
		const res = await GET(event({ token: 'tok' }));
		expect(await res.json()).toEqual({ history: [] });
	});

	it('401 on GET and POST when only DISCOGS_TOKEN is set (no cookie)', async () => {
		(globalThis as any).process.env.DISCOGS_TOKEN = 'env-token';
		await expect(GET(event())).rejects.toMatchObject({ status: 401 });
		await expect(POST(event({ body: { value: 100 } }))).rejects.toMatchObject({ status: 401 });
	});

	it('POST requires a token', async () => {
		await expect(POST(event({ body: { value: 100 } }))).rejects.toMatchObject({ status: 401 });
	});

	it('POST stores a snapshot and returns the series', async () => {
		const res = await POST(event({ token: 'tok', body: { value: 250, currency: 'USD' } }));
		const data = await res.json();
		expect(data.history).toHaveLength(1);
		expect(data.history[0]).toMatchObject({ value: 250, currency: 'USD' });
		expect(data.history[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('POST from a visitor who may not write records nothing and returns the series as it stands', async () => {
		await POST(event({ token: 'tok', body: { value: 250, currency: 'USD' } }));
		const put = vi.spyOn(getStore(undefined), 'putJSON');
		const res = await POST(event({ token: 'someone-elses-token', body: { value: 999_999, currency: 'USD' } }));
		const data = await res.json();
		expect(data.recorded).toBe(false);
		expect(data.history).toHaveLength(1);
		expect(data.history[0].value).toBe(250);
		expect(put).not.toHaveBeenCalled();
		// Reading stays open to any visitor with a token.
		expect((await (await GET(event({ token: 'someone-elses-token' }))).json()).history).toHaveLength(1);
	});

	it('POST records nothing for anyone when no writer is configured', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		delete mockEnv.STORE_WRITERS;
		const res = await POST(event({ token: 'tok', body: { value: 250, currency: 'USD' } }));
		expect(await res.json()).toEqual({ history: [], recorded: false });
		expect(await getStore(undefined).getJSON(KEY)).toBeNull();
	});

	it('POST fails with a 5xx when the history cannot be written', async () => {
		vi.spyOn(getStore(undefined), 'putJSON').mockResolvedValue(false);
		await expect(
			POST(event({ token: 'tok', body: { value: 250, currency: 'USD' } }))
		).rejects.toMatchObject({ status: 500 });
	});

	it('POST rejects a non-numeric value', async () => {
		await expect(
			POST(event({ token: 'tok', body: { value: 'lots' } }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('POST rejects a negative value or one above the cap', async () => {
		await expect(POST(event({ token: 'tok', body: { value: -1 } }))).rejects.toMatchObject({
			status: 400
		});
		await expect(
			POST(event({ token: 'tok', body: { value: 2_000_000_000 } }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('POST coerces an invalid currency to USD', async () => {
		const res = await POST(event({ token: 'tok', body: { value: 10, currency: 'dollars' } }));
		const data = await res.json();
		expect(data.history[0].currency).toBe('USD');
	});

	it('POST keeps one snapshot per day, replacing the same-day value', async () => {
		await POST(event({ token: 'tok', body: { value: 100, currency: 'USD' } }));
		const res = await POST(event({ token: 'tok', body: { value: 200, currency: 'USD' } }));
		const data = await res.json();
		expect(data.history).toHaveLength(1);
		expect(data.history[0].value).toBe(200);
	});

	it('POST rejects a malformed JSON body', async () => {
		await expect(
			POST(event({ token: 'tok', body: 'not json{' }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('POST trims the series to the most recent 52 snapshots', async () => {
		const seeded = Array.from({ length: 60 }, (_, i) => ({
			date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}-seed${i}`,
			value: i,
			currency: 'USD'
		}));
		await getStore(undefined).putJSON(KEY, seeded, 1000);

		const res = await POST(event({ token: 'tok', body: { value: 999, currency: 'USD' } }));
		const data = await res.json();
		expect(data.history).toHaveLength(52);
		expect(data.history[data.history.length - 1].value).toBe(999);
	});
});
