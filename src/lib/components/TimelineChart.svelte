<script lang="ts">
	let { data, height = 220 }: { data: Array<{ date: string; count: number }>; height?: number } = $props();

	let maxCount = $derived(Math.max(1, ...data.map((d) => d.count)));
	let divisor = $derived(Math.max(1, data.length - 1));

	/** Each month as an "x,y" point in a 100 by 100 box, y downwards. */
	let coords = $derived(data.map((d, i) => `${(i / divisor) * 100},${100 - (d.count / maxCount) * 100}`));
	let points = $derived(coords.join(' '));
	let areaPath = $derived(`M 0,100 L ${coords.join(' L ')} L 100,100 Z`);

	let totalAdded = $derived(data.reduce((sum, d) => sum + d.count, 0));
	let last = $derived(data.length > 0 ? data[data.length - 1] : null);
	/** How far down the plot the last point sits, in percent. */
	let lastTop = $derived(last ? 100 - (last.count / maxCount) * 100 : 100);

	/** "2026-03" as "Mar 2026" (or "March 2026" with `long`). */
	function monthName(key: string, month: 'short' | 'long' = 'short'): string {
		const [y, m] = key.split('-').map(Number);
		if (!y || !m) return key;
		return new Date(y, m - 1).toLocaleDateString('en-US', { month, year: 'numeric' });
	}
</script>

<div class="timeline-chart">
	<div class="chart-header">
		<span class="total">{totalAdded.toLocaleString()} records added</span>
		<span class="period">Last {data.length} months</span>
	</div>
	<div class="plot" style:height="{height}px">
		<svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
			<path d={areaPath} class="area" />
			<polyline points={points} class="line" vector-effect="non-scaling-stroke" />
		</svg>
		{#if last}
			<span class="end-dot" style:top="{lastTop}%" aria-hidden="true"></span>
			<!-- The last month's count, written beside the dot in a gutter of its
			     own, so the line never crosses it. -->
			<span class="end-value" style:top="{lastTop}%" aria-hidden="true">
				{last.count.toLocaleString()}
			</span>
		{/if}
	</div>
	<ul class="visually-hidden" aria-label="Collection growth by month">
		{#each data as d}
			<li>{monthName(d.date, 'long')}: {d.count} record{d.count !== 1 ? 's' : ''}</li>
		{/each}
	</ul>
	{#if data.length > 0}
		<div class="x-labels" aria-hidden="true">
			<span>{monthName(data[0].date)}</span>
			<span>{monthName(data[data.length - 1].date)}</span>
		</div>
	{/if}
</div>

<style>
	/* One 2px ink line over a 10% ink area, with an accent dot and the last
	   month's count at the end. The dot is the one round shape on the tab. */
	.timeline-chart {
		width: 100%;
	}

	.chart-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 16px;
		margin-bottom: 16px;
	}

	.total {
		font-weight: 600;
		font-size: 18px;
	}

	.period {
		font-size: 15px;
		color: var(--muted);
	}

	/* The plot stops short of the right edge; the gap holds the last count. */
	.plot,
	.x-labels {
		margin-right: 56px;
	}

	.plot {
		position: relative;
		border-bottom: 1px solid var(--hairline);
	}

	svg {
		width: 100%;
		height: 100%;
		display: block;
		overflow: visible;
	}

	.area {
		fill: var(--ink);
		opacity: 0.1;
	}

	.line {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2;
	}

	.end-dot {
		position: absolute;
		right: -5px;
		width: 10px;
		height: 10px;
		margin-top: -5px;
		border-radius: 50%;
		background: var(--accent);
		outline: 2px solid var(--ground);
	}

	.end-value {
		position: absolute;
		left: calc(100% + 12px);
		transform: translateY(-50%);
		font-size: 15px;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.x-labels {
		display: flex;
		justify-content: space-between;
		font-size: 15px;
		color: var(--muted);
		margin-top: 10px;
	}
</style>
