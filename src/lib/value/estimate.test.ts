import { describe, it, expect, vi } from 'vitest';
import { estimateValue, MAX_RELEASE_IDS, PRICE_STORAGE_KEY } from './estimate';
import { DiscogsAPIError } from '$lib/api/discogs';
import { PRICE_TTL_MS } from '$lib/sync/types';

const T0 = 1_800_000_000_000;
const nm = (value: number, currency = 'USD') => ({ 'Near Mint (NM or M-)': { value, currency } });

function memoryStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		data
	};
}

function setup(prices: (releaseId: number) => unknown = () => nm(10)) {
	let now = T0;
	const storage = memoryStorage();
	const getPrices = vi.fn(async (releaseId: number, _token: string) => {
		const answer = prices(releaseId);
		if (answer instanceof Error) throw answer;
		return answer as any;
	});
	const progress: Array<[number, number]> = [];
	const deps = { getPrices, storage, now: () => now, onProgress: (done: number, total: number) => progress.push([done, total]) };
	return { deps, getPrices, storage, progress, setNow: (n: number) => (now = n) };
}

describe('estimateValue (runs in the browser)', () => {
	it('prices each release with the visitor\'s token and totals them', async () => {
		const s = setup((id) => nm(id * 10));
		const r = await estimateValue([1, 2, 3], 'tok', s.deps);
		expect(s.getPrices.mock.calls).toEqual([[1, 'tok'], [2, 'tok'], [3, 'tok']]);
		expect(r).toEqual({
			totalValue: 60, pricedCount: 3, totalRequested: 3, failedCount: 0, currency: 'USD', partial: false,
			results: [
				{ releaseId: 1, lowestPrice: 10, currency: 'USD' },
				{ releaseId: 2, lowestPrice: 20, currency: 'USD' },
				{ releaseId: 3, lowestPrice: 30, currency: 'USD' }
			]
		});
		expect(s.progress).toEqual([[1, 3], [2, 3], [3, 3]]);
	});
	it('takes Near Mint, then Very Good Plus, and counts a release with neither as unpriced', async () => {
		const s = setup((id) => id === 1 ? { 'Very Good Plus (VG+)': { value: 7, currency: 'USD' }, 'Good (G)': { value: 1, currency: 'USD' } } : id === 2 ? {} : nm(5));
		const r = await estimateValue([1, 2, 3], 'tok', s.deps);
		expect(r.results.map((p) => p.lowestPrice)).toEqual([7, null, 5]);
		expect(r).toMatchObject({ totalValue: 12, pricedCount: 2, failedCount: 0 });
	});
	it('keeps only valid release ids, and at most 20', async () => {
		const s = setup();
		const r = await estimateValue([0, -1, 1.5, NaN, ...Array.from({ length: 30 }, (_, i) => i + 1)], 'tok', s.deps);
		expect(r.totalRequested).toBe(MAX_RELEASE_IDS);
		expect(s.getPrices).toHaveBeenCalledTimes(20);
	});
	it('remembers prices in this browser for six hours', async () => {
		const s = setup();
		await estimateValue([1, 2], 'tok', s.deps);
		s.setNow(T0 + PRICE_TTL_MS - 1);
		const again = await estimateValue([1, 2, 3], 'tok', s.deps);
		expect(s.getPrices.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
		expect(again).toMatchObject({ totalValue: 30, pricedCount: 3 });
		s.setNow(T0 + PRICE_TTL_MS);
		await estimateValue([1, 2], 'tok', s.deps);
		expect(s.getPrices.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 1, 2]);
	});
	it('never stores the token, and drops prices that have expired', async () => {
		const s = setup();
		await estimateValue([1], 'SECRET-TOKEN', s.deps);
		s.setNow(T0 + PRICE_TTL_MS);
		await estimateValue([2], 'SECRET-TOKEN', s.deps);
		const kept = s.storage.data.get(PRICE_STORAGE_KEY)!;
		expect(kept).not.toContain('SECRET-TOKEN');
		expect(Object.keys(JSON.parse(kept))).toEqual(['2']);
	});
	it('Discogs busy: stops there with a partial estimate, keeping what it has', async () => {
		const s = setup((id) => id === 3 ? new DiscogsAPIError('busy', 0, 'UNREACHABLE') : nm(10));
		const r = await estimateValue([1, 2, 3, 4], 'tok', s.deps);
		expect(r).toMatchObject({ partial: true, totalValue: 20, pricedCount: 2, totalRequested: 4, failedCount: 0 });
		expect(s.getPrices).toHaveBeenCalledTimes(3);
		// The two prices fetched before the stop are kept for the next try.
		expect(Object.keys(JSON.parse(s.storage.data.get(PRICE_STORAGE_KEY)!))).toEqual(['1', '2']);
	});
	it('a rejected token stops at once', async () => {
		const s = setup(() => new DiscogsAPIError('bad', 401, 'BAD_TOKEN'));
		await expect(estimateValue([1, 2], 'tok', s.deps)).rejects.toThrow('Invalid or expired Discogs token');
		expect(s.getPrices).toHaveBeenCalledTimes(1);
	});
	it('any other failed lookup is counted, left unpriced, and not remembered', async () => {
		const s = setup((id) => id === 2 ? new DiscogsAPIError('down', 502, 'UPSTREAM_ERROR') : nm(10));
		const r = await estimateValue([1, 2, 3], 'tok', s.deps);
		expect(r).toMatchObject({ failedCount: 1, pricedCount: 2, totalValue: 20, partial: false });
		expect(Object.keys(JSON.parse(s.storage.data.get(PRICE_STORAGE_KEY)!))).toEqual(['1', '3']);
	});
	it('totals one currency only: the first priced release\'s', async () => {
		const s = setup((id) => nm(10, id === 2 ? 'EUR' : 'GBP'));
		const r = await estimateValue([1, 2, 3], 'tok', s.deps);
		expect(r).toMatchObject({ currency: 'GBP', totalValue: 20, pricedCount: 2 });
	});
	it('works with no storage, or with storage that fails or holds rubbish', async () => {
		const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
		for (const storage of [null, broken, memoryStorage({ [PRICE_STORAGE_KEY]: '{not json' }), memoryStorage({ [PRICE_STORAGE_KEY]: '[1,2]' })]) {
			const s = setup();
			expect(await estimateValue([1], 'tok', { ...s.deps, storage })).toMatchObject({ totalValue: 10, pricedCount: 1 });
		}
	});
});
