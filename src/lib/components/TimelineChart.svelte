<script lang="ts">
	let { data, height = 120 }: { data: Array<{ date: string; count: number }>; height?: number } = $props();

	let maxCount = $derived(Math.max(...data.map((d) => d.count)));
	let points = $derived(data
		.map((d, i) => {
			const x = (i / (data.length - 1)) * 100;
			const y = 100 - (d.count / maxCount) * 100;
			return `${x},${y}`;
		})
		.join(' '));

	let areaPath = $derived(`M 0,100 L ${data
		.map((d, i) => {
			const x = (i / (data.length - 1)) * 100;
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
	<svg viewBox="0 0 100 100" preserveAspectRatio="none" style:height="{height}px">
		<defs>
			<linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
				<stop offset="0%" stop-color="#6366f1" stop-opacity="0.3" />
				<stop offset="100%" stop-color="#6366f1" stop-opacity="0.05" />
			</linearGradient>
		</defs>
		<path d={areaPath} fill="url(#areaGradient)" />
		<polyline points={points} fill="none" stroke="#6366f1" stroke-width="2" vector-effect="non-scaling-stroke" />
		{#each data as d, i}
			{@const x = (i / (data.length - 1)) * 100}
			{@const y = 100 - (d.count / maxCount) * 100}
			<circle cx={x} cy={y} r="3" fill="#6366f1" vector-effect="non-scaling-stroke" class="dot">
				<title>{d.date}: {d.count} added</title>
			</circle>
		{/each}
	</svg>
	<div class="x-labels">
		<span>{data[0]?.date}</span>
		<span>{data[data.length - 1]?.date}</span>
	</div>
</div>

<style>
	.timeline-chart {
		width: 100%;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.5rem;
	}

	.total {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.period {
		font-size: 0.75rem;
		color: var(--color-text-secondary, #666);
	}

	svg {
		width: 100%;
		display: block;
	}

	.dot {
		cursor: pointer;
		transition: r 0.2s;
	}

	.dot:hover {
		r: 5;
	}

	.x-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		color: var(--color-text-tertiary, #999);
		margin-top: 0.25rem;
	}
</style>
