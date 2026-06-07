import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnv, kvStore } = vi.hoisted(() => ({
	mockEnv: {} as Record<string, string>,
	kvStore: new Map<string, unknown>()
}));

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

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

vi.mock('$lib/server/cache', () => ({
	kvGetJSON: vi.fn(async (_platform: unknown, key: string) => kvStore.get(key) ?? null),
	kvPutJSON: vi.fn(async (_platform: unknown, key: string, value: unknown) => {
		kvStore.set(key, value);
	})
}));

import { GET, POST } from './+server';

const KEY = 'value-history:testuser';

function event(opts: { token?: string; body?: unknown } = {}) {
	const cookies = { get: (n: string) => (n === 'discogs_token' ? opts.token : undefined) };
	const base: any = { params: { username: 'testuser' }, platform: {}, cookies };
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
	beforeEach(() => {
		kvStore.clear();
		mockEnv.DISCOGS_TOKEN = '';
	});

	it('GET requires a token', async () => {
		await expect(GET(event())).rejects.toMatchObject({ status: 401 });
	});

	it('GET returns an empty history when nothing is stored', async () => {
		const res = await GET(event({ token: 'tok' }));
		expect(await res.json()).toEqual({ history: [] });
	});

	it('GET tolerates a non-array stored payload by returning empty', async () => {
		kvStore.set(KEY, { not: 'an array' });
		const res = await GET(event({ token: 'tok' }));
		expect(await res.json()).toEqual({ history: [] });
	});

	it('GET falls back to the env token', async () => {
		mockEnv.DISCOGS_TOKEN = 'env-token';
		const res = await GET(event());
		expect(res.status).toBe(200);
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
		kvStore.set(KEY, seeded);

		const res = await POST(event({ token: 'tok', body: { value: 999, currency: 'USD' } }));
		const data = await res.json();
		expect(data.history).toHaveLength(52);
		expect(data.history[data.history.length - 1].value).toBe(999);
	});
});
