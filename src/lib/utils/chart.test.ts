import { describe, it, expect } from 'vitest';
import { toChartData, chartColour, foldSeries, shadeStep } from './chart';

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

describe('chart colours and shades', () => {
	it('chartColour', () => { expect(chartColour(0)).toBe('var(--chart-1)'); expect(chartColour(4)).toBe('var(--chart-5)'); expect(chartColour(5)).toBe('var(--chart-other)'); expect(chartColour(99)).toBe('var(--chart-other)'); });
	it('foldSeries keeps five and sums the rest', () => {
		const d = [7, 6, 5, 4, 3, 2, 1].map((v, i) => ({ label: `g${i}`, value: v }));
		expect(foldSeries(d)).toEqual([...d.slice(0, 5), { label: 'Other', value: 3 }]);
		expect(foldSeries(d.slice(0, 3))).toEqual(d.slice(0, 3));
		expect(foldSeries([{ label: 'b', value: 1 }, { label: 'a', value: 9 }])[0].label).toBe('a');
	});
	it('shadeStep', () => { expect(shadeStep(0, 10)).toBe(0); expect(shadeStep(1, 10)).toBe(1); expect(shadeStep(10, 10)).toBe(5); expect(shadeStep(5, 10)).toBe(3); expect(shadeStep(3, 0)).toBe(1); });
});
