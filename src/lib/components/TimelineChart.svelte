<script lang="ts">
	let { data, height = 120 }: { data: Array<{ date: string; count: number }>; height?: number } = $props();

	let maxCount = $derived(Math.max(1, ...data.map((d) => d.count)));
	let divisor = $derived(Math.max(1, data.length - 1));
	let points = $derived(data
		.map((d, i) => {
			const x = (i / divisor) * 100;
			const y = 100 - (d.count / maxCount) * 100;
			return `${x},${y}`;
		})
		.join(' '));

	let areaPath = $derived(`M 0,100 L ${data
		.map((d, i) => {
			const x = (i / divisor) * 100;
			const y = 100 - (d.count / maxCount) * 100;
			return `${x},${y}`;
		})
		.join(' L ')} L 100,100 Z`);

	let totalAdded = $derived(data.reduce((sum, d) => sum + d.count, 0));
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
			{#each data as d, i}
				{@const x = (i / divisor) * 100}
				{@const y = 100 - (d.count / maxCount) * 100}
				<circle cx={x} cy={y} r="3" vector-effect="non-scaling-stroke" class="dot">
					<title>{d.date}: {d.count} added</title>
				</circle>
			{/each}
		</svg>
		{#if data.length > 0}
			<span
				class="end-dot"
				style:top="{100 - (data[data.length - 1].count / maxCount) * 100}%"
				aria-hidden="true"
			></span>
		{/if}
	</div>
	<div class="x-labels">
		<span>{data[0]?.date}</span>
		<span>{data[data.length - 1]?.date}</span>
	</div>
</div>

<style>
	/* One 2px ink line over a 10% ink area, with an accent dot at the end. */
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

	/* Each month's point is an unseen target that shows its count on hover. */
	.dot {
		fill: transparent;
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

	.x-labels {
		display: flex;
		justify-content: space-between;
		font-size: 15px;
		color: var(--muted);
		margin-top: 10px;
	}
</style>
