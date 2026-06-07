import { describe, it, expect } from 'vitest';
import { toChartData, colorAt, CHART_PALETTE, RANK_PALETTE } from './chart';

describe('toChartData', () => {
	it('maps a record to {label, value} entries', () => {
		const result = toChartData({ Rock: 3, Jazz: 1 }, { sort: 'value-desc' });
		expect(result).toContainEqual({ label: 'Rock', value: 3 });
		expect(result).toContainEqual({ label: 'Jazz', value: 1 });
	});

	it('sorts by value descending', () => {
		const result = toChartData({ a: 1, b: 5, c: 3 }, { sort: 'value-desc' });
		expect(result.map((d) => d.value)).toEqual([5, 3, 1]);
	});

	it('sorts by label ascending', () => {
		const result = toChartData({ c: 1, a: 1, b: 1 }, { sort: 'label-asc' });
		expect(result.map((d) => d.label)).toEqual(['a', 'b', 'c']);
	});

	it('applies a label transform before sorting', () => {
		const result = toChartData({ '1990': 2, '1980': 5 }, {
			sort: 'label-asc',
			labelFn: (k) => `${k}s`
		});
		expect(result).toEqual([
			{ label: '1980s', value: 5 },
			{ label: '1990s', value: 2 }
		]);
	});

	it('applies a limit after sorting', () => {
		const result = toChartData({ a: 1, b: 2, c: 3, d: 4 }, { sort: 'value-desc', limit: 2 });
		expect(result).toEqual([
			{ label: 'd', value: 4 },
			{ label: 'c', value: 3 }
		]);
	});

	it('returns an empty array for an empty record', () => {
		expect(toChartData({}, { sort: 'value-desc' })).toEqual([]);
	});
});

describe('colorAt', () => {
	it('returns the palette color at the given index', () => {
		expect(colorAt(0)).toBe(CHART_PALETTE[0]);
		expect(colorAt(3)).toBe(CHART_PALETTE[3]);
	});

	it('wraps around the palette by default (modulo)', () => {
		const n = CHART_PALETTE.length;
		expect(colorAt(n)).toBe(CHART_PALETTE[0]);
		expect(colorAt(n + 2)).toBe(CHART_PALETTE[2]);
	});

	it('handles negative indices when wrapping', () => {
		expect(colorAt(-1)).toBe(CHART_PALETTE[CHART_PALETTE.length - 1]);
	});

	it('clamps to the last color in clamp mode (matches TopList rank coloring)', () => {
		const n = RANK_PALETTE.length;
		expect(colorAt(0, RANK_PALETTE, 'clamp')).toBe(RANK_PALETTE[0]);
		expect(colorAt(n + 5, RANK_PALETTE, 'clamp')).toBe(RANK_PALETTE[n - 1]);
		expect(colorAt(-3, RANK_PALETTE, 'clamp')).toBe(RANK_PALETTE[0]);
	});

	it('accepts a custom palette', () => {
		const palette = ['#aaa', '#bbb'];
		expect(colorAt(1, palette)).toBe('#bbb');
		expect(colorAt(2, palette)).toBe('#aaa');
	});

	it('falls back to a neutral gray for an empty palette', () => {
		expect(colorAt(0, [])).toBe('#6b7280');
	});
});
