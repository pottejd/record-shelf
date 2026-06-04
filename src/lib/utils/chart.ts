export interface ChartDatum {
	label: string;
	value: number;
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
