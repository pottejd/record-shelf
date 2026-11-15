import { describe, it, expect } from 'vitest';
import type { DiscogsCollectionItem, DiscogsFormat } from '$lib/types/discogs';
import {
	SPINE_WEIGHTS,
	mix,
	spineOf,
	shelfOrder,
	shelfCount,
	splitShelves,
	shelfTitle,
	shelfSource
} from './spines';

function rec(o: {
	id: number;
	year?: number;
	formats?: Partial<DiscogsFormat>[];
	artist?: string;
	title?: string;
	added?: string;
}): DiscogsCollectionItem {
	return {
		id: o.id,
		instance_id: o.id,
		folder_id: 1,
		rating: 0,
		date_added: o.added ?? '2020-01-01T00:00:00-00:00',
		basic_information: {
			id: o.id,
			title: o.title ?? 'T',
			year: o.year ?? 0,
			thumb: '',
			resource_url: '',
			artists: [{ id: 1, name: o.artist ?? 'A', resource_url: '' } as never],
			labels: [],
			formats: o.formats as never,
			genres: [],
			styles: []
		}
	};
}

describe('spines and shelves', () => {
	it('a plain LP is one unit, full height', () => {
		const s = spineOf(rec({ id: 1, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }] }));
		expect(s.units).toBe(1);
		expect(s.height).toBe(1);
	});
	it('discs set the units', () => {
		expect(spineOf(rec({ id: 1, formats: [{ name: 'Vinyl', qty: '2' }] })).units).toBe(2);
		expect(spineOf(rec({ id: 1, formats: [{ name: 'Box Set', qty: '1' }, { name: 'Vinyl', qty: '5' }] })).units).toBe(4);
	});
	it('sizes set the height', () => {
		expect(spineOf(rec({ id: 1, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['7"', '45 RPM'] }] })).height).toBe(0.56);
		expect(spineOf(rec({ id: 1, formats: [{ name: 'Shellac', qty: '1', descriptions: ['10"'] }] })).height).toBe(0.9);
		expect(spineOf(rec({ id: 1, formats: [{ name: 'CD', qty: '1', descriptions: ['Album'] }] })).height).toBe(1);
		expect(spineOf(rec({ id: 1, formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', '7"'] }] })).height).toBe(1);
	});
	it('thin data never breaks a spine', () => {
		for (const formats of [undefined, [], [{ name: 'Vinyl', qty: '' }], [{ name: 'Vinyl', qty: 'x' }], [{ name: 'Vinyl' }]]) {
			const s = spineOf(rec({ id: 9, formats: formats as never }));
			expect(s.units).toBe(1);
			expect(s.height).toBe(1);
			expect(Number.isFinite(s.width)).toBe(true);
		}
	});
	it('width stays in range and a double beats any single', () => {
		for (let id = 1; id <= 2000; id++) {
			const one = spineOf(rec({ id })).width;
			const two = spineOf(rec({ id, formats: [{ name: 'Vinyl', qty: '2' }] })).width;
			expect(one).toBeGreaterThanOrEqual(0.8);
			expect(one).toBeLessThanOrEqual(1.4);
			expect(two).toBeGreaterThanOrEqual(1.6);
		}
	});
	it('colour is stable and follows the weights', () => {
		expect(spineOf(rec({ id: 4242 })).colour).toBe(spineOf(rec({ id: 4242 })).colour);
		const n = new Array(9).fill(0);
		for (let id = 1; id <= 26000; id++) n[spineOf(rec({ id })).colour]++;
		SPINE_WEIGHTS.forEach((w, i) => {
			expect(n[i] / 1000).toBeGreaterThan(w * 0.9);
			expect(n[i] / 1000).toBeLessThan(w * 1.1);
		});
	});
	it('mix is pinned', () => {
		expect(mix(1, 1)).toBe(mix(1, 1));
		expect(mix(1, 1)).not.toBe(mix(1, 2));
		expect(mix(12345, 2)).toMatchInlineSnapshot(`599080673`);
	});
	it('keeps when a record was added, 0 when unknown', () => {
		expect(spineOf(rec({ id: 1, added: '2021-03-15T12:00:00-00:00' })).added).toBe(Date.UTC(2021, 2, 15, 12));
		expect(spineOf(rec({ id: 1, added: '' })).added).toBe(0);
		expect(spineOf(rec({ id: 1, added: 'not a date' })).added).toBe(0);
		expect(spineOf({ ...rec({ id: 1 }), date_added: undefined as never }).added).toBe(0);
	});
	it('orders by date added, earliest first, whatever the release year', () => {
		const out = shelfOrder([
			rec({ id: 1, year: 1960, added: '2023-01-10T12:00:00Z' }),
			rec({ id: 2, year: 2020, added: '2019-06-01T12:00:00Z' }),
			rec({ id: 3, year: 0, added: '2021-03-15T12:00:00Z' })
		]);
		expect(out.map((s) => s.key)).toEqual([2, 3, 1]);
	});
	it('puts records with a missing or unreadable date last', () => {
		const out = shelfOrder([
			rec({ id: 1, added: '' }),
			rec({ id: 2, added: '2024-01-01T12:00:00Z' }),
			rec({ id: 3, added: 'garbage' }),
			rec({ id: 4, added: '2001-01-01T12:00:00Z' })
		]);
		expect(out.map((s) => s.key)).toEqual([4, 2, 1, 3]);
	});
	it('records added at the same instant fall back to artist, title, then key', () => {
		const at = '2022-05-05T12:00:00Z';
		const out = shelfOrder([
			rec({ id: 5, added: at, artist: 'B', title: 'A' }),
			rec({ id: 12, added: at, artist: 'A', title: 'Z' }),
			rec({ id: 3, added: at, artist: 'A', title: 'Y' }),
			rec({ id: 10, added: at, artist: 'A', title: 'Y' }),
			rec({ id: 2, added: at, artist: 'A', title: 'Y' })
		]);
		expect(out.map((s) => s.key)).toEqual([2, 3, 10, 12, 5]);
	});
	it('counts shelves', () => {
		expect(shelfCount(679, 230)).toBe(3);
		expect(shelfCount(679, 115)).toBe(6);
		expect(shelfCount(0, 230)).toBe(1);
		expect(shelfCount(10, 230)).toBe(1);
		expect(shelfCount(5000, 230)).toBe(22);
	});
	it('splits in order, every spine once, about evenly', () => {
		const spines = shelfOrder(Array.from({ length: 679 }, (_, i) => rec({ id: i + 1, year: 1950 + (i % 70) })));
		const rows = splitShelves(spines, 3);
		expect(rows).toHaveLength(3);
		expect(rows.flat()).toEqual(spines);
		const w = rows.map((r) => r.reduce((a, s) => a + s.width, 0));
		expect(Math.max(...w) / Math.min(...w)).toBeLessThan(1.05);
		expect(splitShelves([], 3)).toEqual([[], [], []]);
		expect(splitShelves(spines.slice(0, 2), 3).flat()).toHaveLength(2);
	});
	it('titles a shelf with the months it covers', () => {
		// Noon UTC on the 15th is the same month in every time zone.
		const shelf = shelfOrder([
			rec({ id: 1, added: '2021-03-15T12:00:00Z' }),
			rec({ id: 2, added: '2022-07-15T12:00:00Z' }),
			rec({ id: 3, added: '2023-01-15T12:00:00Z' }),
			rec({ id: 4, added: '' })
		]);
		expect(shelfTitle(shelf)).toBe('Mar 2021 to Jan 2023');
		expect(shelfTitle(shelfOrder([rec({ id: 1, added: '2021-03-02T12:00:00Z' }), rec({ id: 2, added: '2021-03-28T12:00:00Z' })]))).toBe('Mar 2021');
		expect(shelfTitle(shelfOrder([rec({ id: 1, added: '' }), rec({ id: 2, added: 'garbage' })]))).toBe('Date unknown');
		expect(shelfTitle([])).toBe('Date unknown');
	});
	it('names every month in three English letters', () => {
		const names = Array.from({ length: 12 }, (_, m) =>
			shelfTitle(shelfOrder([rec({ id: 1, added: `2020-${String(m + 1).padStart(2, '0')}-15T12:00:00Z` })]))
		);
		expect(names).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => `${m} 2020`));
	});
	it('reads the month in local time, as the Collection timeline does', () => {
		// Late on the last of March and early on the first of April, local time.
		const late = new Date(2021, 2, 31, 23, 30).toISOString();
		const early = new Date(2021, 3, 1, 0, 30).toISOString();
		expect(shelfTitle(shelfOrder([rec({ id: 1, added: late })]))).toBe('Mar 2021');
		expect(shelfTitle(shelfOrder([rec({ id: 1, added: late }), rec({ id: 2, added: early })]))).toBe('Mar 2021 to Apr 2021');
	});
	it('decides what the shelf draws', () => {
		const prev = [1];
		const next = [1, 2];
		expect(shelfSource(prev, { items: next, phase: 'done', background: false }, true)).toBe(next);
		expect(shelfSource(prev, { items: next, phase: 'loading', background: false }, true)).toBe(prev);
		expect(shelfSource(prev, { items: next, phase: 'loading', background: false }, false)).toBe(next);
		expect(shelfSource(prev, { items: next, phase: 'refreshing', background: true }, false)).toBe(prev);
		expect(shelfSource([], { items: next, phase: 'error', background: false }, true)).toBe(next);
		expect(shelfSource(prev, { items: [], phase: 'error', background: false }, true)).toBe(prev);
	});
	it('the order is the same on every visit, with many records added at once', () => {
		const items = Array.from({ length: 50 }, (_, i) =>
			rec({ id: i + 1, added: i % 3 === 0 ? '' : i % 3 === 1 ? '2024-02-02T10:00:00Z' : '2019-09-09T10:00:00Z', artist: 'Same', title: 'Same' })
		);
		const a = shelfOrder(items).map((s) => s.key);
		const b = shelfOrder([...items].reverse()).map((s) => s.key);
		expect(a).toEqual(b);
	});
	it('handles collections of 0, 1, 10 and 5000', () => {
		for (const n of [0, 1, 10, 5000]) {
			const spines = shelfOrder(Array.from({ length: n }, (_, i) => rec({ id: i + 1, year: 1900 + (i % 100) })));
			const rows = splitShelves(spines, shelfCount(n, 230));
			expect(rows.flat()).toEqual(spines);
			for (const s of spines) expect(Number.isNaN(s.width)).toBe(false);
		}
	});
});
