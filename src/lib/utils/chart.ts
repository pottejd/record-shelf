export interface ChartDatum {
	label: string;
	value: number;
}

/**
 * Categorical color palette shared by BarChart and DonutChart for coloring
 * distinct series. Indices wrap (modulo) so any number of series renders.
 */
export const CHART_PALETTE = [
	'#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
	'#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
] as const;

/**
 * Monochromatic purple-fade palette for TopList rank coloring. Indices clamp
 * (the lowest ranks share the faintest shade) rather than wrap.
 */
export const RANK_PALETTE = [
	'#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe',
	'#e9d5ff', '#f3e8ff', '#faf5ff', '#fdf4ff', '#fefce8'
] as const;

/**
 * Color for series index `i`. Defaults to the categorical palette with
 * wrapping; pass `'clamp'` (and usually RANK_PALETTE) for ranked lists where
 * indices past the end should reuse the last color rather than wrap.
 */
export function colorAt(
	i: number,
	palette: readonly string[] = CHART_PALETTE,
	mode: 'wrap' | 'clamp' = 'wrap'
): string {
	const n = palette.length;
	if (n === 0) return '#6b7280';
	const idx = mode === 'clamp' ? Math.min(Math.max(i, 0), n - 1) : ((i % n) + n) % n;
	return palette[idx];
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
