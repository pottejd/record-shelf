export interface ChartDatum {
	label: string;
	value: number;
}

/** The chart colour for part `i` of a whole: five colours in order, then "Other". */
export function chartColour(i: number): string {
	return i >= 0 && i < 5 ? `var(--chart-${i + 1})` : 'var(--chart-other)';
}

/**
 * The colour of the part called `label` at place `i` of a whole: a part
 * labelled "Other" (or one with no place, i < 0) takes the Other colour, any
 * other part the chart colour of its place.
 */
export function partColour(label: string, i: number): string {
	return label === 'Other' ? 'var(--chart-other)' : chartColour(i);
}

/**
 * Biggest first; keeps the first `max` parts and sums the rest into one
 * "Other" part (left out when the rest adds up to nothing).
 */
export function foldSeries(data: ChartDatum[], max = 5): ChartDatum[] {
	const sorted = [...data].sort((a, b) => b.value - a.value);
	const kept = sorted.slice(0, max);
	const rest = sorted.slice(max).reduce((sum, d) => sum + d.value, 0);
	return rest > 0 ? [...kept, { label: 'Other', value: rest }] : kept;
}

/**
 * The step on the five-step shade ramp for `count` out of the largest `max`:
 * 0 for nothing (or a count that is not a finite number), otherwise 1 to 5.
 * A count with no usable maximum (0, negative, NaN or infinite) is step 1.
 */
export function shadeStep(count: number, max: number): 0 | 1 | 2 | 3 | 4 | 5 {
	if (!Number.isFinite(count) || count <= 0) return 0;
	if (!Number.isFinite(max) || max <= 0) return 1;
	return Math.min(5, Math.max(1, Math.ceil((count / max) * 5))) as 1 | 2 | 3 | 4 | 5;
}

interface ToChartDataOptions {
	/** 'value-desc' sorts by count (largest first); 'label-asc' sorts alphabetically by label. */
	sort: 'value-desc' | 'label-asc';
	/** Keep only the first N entries after sorting. */
	limit?: number;
	/** Transform each record key into a display label (applied before sorting). */
	labelFn?: (key: string) => string;
}

/**
 * Turns a `Record<string, number>` breakdown (genres, decades, formats, …)
 * into sorted `{ label, value }` chart data. Replaces the four near-identical
 * derived blocks that previously lived in the profile route.
 */
export function toChartData(
	record: Record<string, number>,
	options: ToChartDataOptions
): ChartDatum[] {
	const data = Object.entries(record).map(([key, value]) => ({
		label: options.labelFn ? options.labelFn(key) : key,
		value
	}));

	if (options.sort === 'value-desc') {
		data.sort((a, b) => b.value - a.value);
	} else {
		data.sort((a, b) => a.label.localeCompare(b.label));
	}

	return options.limit != null ? data.slice(0, options.limit) : data;
}
