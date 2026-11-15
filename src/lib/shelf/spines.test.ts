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
}): DiscogsCollectionItem {
	return {
		id: o.id,
		instance_id: o.id,
		folder_id: 1,
		rating: 0,
		date_added: '2020-01-01T00:00:00-00:00',
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
	it('orders by year, unknown last, then artist, title', () => {
		const out = shelfOrder([rec({ id: 1, year: 0 }), rec({ id: 2, year: 1980, artist: 'B' }), rec({ id: 3, year: 1960 }), rec({ id: 4, year: 1980, artist: 'A' })]);
		expect(out.map((s) => s.key)).toEqual([3, 4, 2, 1]);
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
	it('titles a shelf', () => {
		expect(shelfTitle(shelfOrder([rec({ id: 1, year: 1957 }), rec({ id: 2, year: 1979 }), rec({ id: 3, year: 0 })]))).toBe('1957 to 1979');
		expect(shelfTitle(shelfOrder([rec({ id: 1, year: 1990 }), rec({ id: 2, year: 1990 })]))).toBe('1990');
		expect(shelfTitle(shelfOrder([rec({ id: 1, year: 0 })]))).toBe('Year unknown');
		expect(shelfTitle([])).toBe('Year unknown');
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
	it('the order is the same on every visit, with many records in one year', () => {
		const items = Array.from({ length: 50 }, (_, i) => rec({ id: i + 1, year: i % 2 ? 0 : 1999, artist: 'Same', title: 'Same' }));
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
