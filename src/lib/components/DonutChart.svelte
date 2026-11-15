<script lang="ts">
	import { chartColour, foldSeries } from '$lib/utils/chart';

	interface Props {
		data: Array<{ label: string; value: number }>;
		size?: number;
		thickness?: number;
		clickable?: boolean;
		onItemClick?: (label: string) => void;
	}

	let { data, size = 200, thickness = 40, clickable = false, onItemClick }: Props = $props();

	let total = $derived(data.reduce((sum, d) => sum + d.value, 0));
	let radius = $derived(size / 2);
	let innerRadius = $derived(radius - thickness);

	function percentOf(value: number) {
		return ((value / total) * 100).toFixed(1);
	}

	// Biggest first. The five biggest parts take the chart colours; every later
	// part is drawn in the "Other" colour but stays its own segment, with its own
	// name and number on hover and focus, and still opens its records.
	let segments = $derived((() => {
		let currentAngle = -90;
		return [...data]
			.sort((a, b) => b.value - a.value)
			.map((d, i) => {
				const angle = (d.value / total) * 360;
				const startAngle = currentAngle;
				currentAngle += angle;
				return {
					...d,
					color: chartColour(i),
					startAngle,
					endAngle: currentAngle,
					percentage: percentOf(d.value)
				};
			});
	})());

	// The legend: the five biggest parts by name, then the rest together as "Other".
	let legend = $derived(
		foldSeries(data).map((d, i) => ({
			...d,
			color: chartColour(i),
			percentage: percentOf(d.value),
			other: i >= 5
		}))
	);

	function polarToCartesian(angle: number, r: number) {
		const rad = (angle * Math.PI) / 180;
		return {
			x: radius + r * Math.cos(rad),
			y: radius + r * Math.sin(rad)
		};
	}

	function describeArc(startAngle: number, endAngle: number, outerR: number, innerR: number) {
		const start = polarToCartesian(endAngle, outerR);
		const end = polarToCartesian(startAngle, outerR);
		const innerStart = polarToCartesian(endAngle, innerR);
		const innerEnd = polarToCartesian(startAngle, innerR);
		const largeArc = endAngle - startAngle > 180 ? 1 : 0;

		return [
			'M', start.x, start.y,
			'A', outerR, outerR, 0, largeArc, 0, end.x, end.y,
			'L', innerEnd.x, innerEnd.y,
			'A', innerR, innerR, 0, largeArc, 1, innerStart.x, innerStart.y,
			'Z'
		].join(' ');
	}
</script>

<div class="donut-chart" class:clickable>
	<svg aria-hidden="true" width={size} height={size} viewBox="0 0 {size} {size}">
		{#each segments as segment}
			{#if clickable}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<path
					d={describeArc(segment.startAngle, segment.endAngle - 0.5, radius - 2, innerRadius)}
					fill={segment.color}
					class="segment clickable"
					role="button"
					tabindex="0"
					onclick={() => onItemClick?.(segment.label)}
					onkeydown={(e) => e.key === 'Enter' && onItemClick?.(segment.label)}
				>
					<title>{segment.label}: {segment.value} ({segment.percentage}%)</title>
				</path>
			{:else}
				<path
					d={describeArc(segment.startAngle, segment.endAngle - 0.5, radius - 2, innerRadius)}
					fill={segment.color}
					class="segment"
				>
					<title>{segment.label}: {segment.value} ({segment.percentage}%)</title>
				</path>
			{/if}
		{/each}
		<text x={radius} y={radius} text-anchor="middle" dominant-baseline="middle" class="center-text">
			<tspan x={radius} dy="-0.3em" class="center-value">{total.toLocaleString()}</tspan>
			<tspan x={radius} dy="1.4em" class="center-label">Total</tspan>
		</text>
	</svg>
	<div class="legend">
		{#each legend as part}
			{#if part.other}
				<div class="legend-item">
					<span class="swatch" style:background={part.color}></span>
					<span class="legend-label">{part.label}</span>
					<span class="legend-value">{part.percentage}%</span>
				</div>
			{:else}
				<button
					class="legend-item"
					class:clickable
					type="button"
					disabled={!clickable}
					onclick={() => onItemClick?.(part.label)}
				>
					<span class="swatch" style:background={part.color}></span>
					<span class="legend-label">{part.label}</span>
					<span class="legend-value">{part.percentage}%</span>
				</button>
			{/if}
		{/each}
	</div>
</div>

<style>
	.donut-chart {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
	}

	svg {
		overflow: visible;
	}

	.segment.clickable {
		cursor: pointer;
	}

	.center-text {
		fill: var(--ink);
	}

	.center-value {
		font-size: 28px;
		font-weight: 800;
	}

	.center-label {
		font-size: 15px;
		fill: var(--muted);
	}

	/* A row per part: swatch, name in ink, share in ink. */
	.legend {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 360px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		width: 100%;
		padding: 0;
		border: 0;
		border-top: 1px solid var(--hairline);
		border-radius: 0;
		background: none;
		font: inherit;
		font-size: 17px;
		color: var(--ink);
		text-align: left;
	}

	.legend-item:first-child {
		border-top: 0;
	}

	.legend-item.clickable {
		cursor: pointer;
	}

	.legend-item.clickable:hover .legend-label {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.legend-item:disabled {
		cursor: default;
		color: var(--ink);
	}

	.swatch {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.legend-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.legend-value {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
