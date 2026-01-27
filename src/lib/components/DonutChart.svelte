<script lang="ts">
	export let data: Array<{ label: string; value: number; color?: string }>;
	export let size = 200;
	export let thickness = 40;
	export let clickable = false;
	export let onItemClick: ((label: string) => void) | undefined = undefined;

	const colors = [
		'#6366f1', // indigo
		'#8b5cf6', // violet
		'#ec4899', // pink
		'#f43f5e', // rose
		'#f97316', // orange
		'#eab308', // yellow
		'#22c55e', // green
		'#14b8a6', // teal
		'#06b6d4', // cyan
		'#3b82f6', // blue
	];

	$: total = data.reduce((sum, d) => sum + d.value, 0);
	$: radius = size / 2;
	$: innerRadius = radius - thickness;

	$: segments = (() => {
		let currentAngle = -90;
		return data.map((d, i) => {
			const angle = (d.value / total) * 360;
			const startAngle = currentAngle;
			currentAngle += angle;
			return {
				...d,
				color: d.color || colors[i % colors.length],
				startAngle,
				endAngle: currentAngle,
				percentage: ((d.value / total) * 100).toFixed(1)
			};
		});
	})();

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
	<svg width={size} height={size} viewBox="0 0 {size} {size}">
		{#each segments as segment}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<path
				d={describeArc(segment.startAngle, segment.endAngle - 0.5, radius - 2, innerRadius)}
				fill={segment.color}
				class="segment"
				class:clickable
				role={clickable ? 'button' : undefined}
				tabindex={clickable ? 0 : undefined}
				onclick={() => clickable && onItemClick?.(segment.label)}
				onkeydown={(e) => e.key === 'Enter' && clickable && onItemClick?.(segment.label)}
			>
				<title>{segment.label}: {segment.value} ({segment.percentage}%)</title>
			</path>
		{/each}
		<text x={radius} y={radius} text-anchor="middle" dominant-baseline="middle" class="center-text">
			<tspan x={radius} dy="-0.3em" class="center-value">{total.toLocaleString()}</tspan>
			<tspan x={radius} dy="1.4em" class="center-label">total</tspan>
		</text>
	</svg>
	<div class="legend">
		{#each segments.slice(0, 6) as segment}
			<button
				class="legend-item"
				class:clickable
				type="button"
				disabled={!clickable}
				onclick={() => onItemClick?.(segment.label)}
			>
				<span class="legend-color" style:background={segment.color}></span>
				<span class="legend-label">{segment.label}</span>
				<span class="legend-value">{segment.percentage}%</span>
			</button>
		{/each}
		{#if segments.length > 6}
			<div class="legend-item more">+{segments.length - 6} more</div>
		{/if}
	</div>
</div>

<style>
	.donut-chart {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	svg {
		overflow: visible;
	}

	.segment {
		transition: opacity 0.2s;
		cursor: pointer;
	}

	.segment:hover {
		opacity: 0.8;
	}

	.center-text {
		fill: var(--color-text, #1a1a1a);
	}

	.center-value {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.center-label {
		font-size: 0.75rem;
		fill: var(--color-text-secondary, #666);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		justify-content: center;
		max-width: 300px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		background: none;
		border: none;
		padding: 0.25rem 0.5rem;
		margin: -0.25rem -0.5rem;
		border-radius: 6px;
		font: inherit;
		color: inherit;
	}

	.legend-item.clickable {
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.legend-item.clickable:hover {
		background: var(--color-bg-secondary, rgba(0, 0, 0, 0.05));
	}

	.legend-item:disabled {
		cursor: default;
	}

	.legend-item.more {
		color: var(--color-text-secondary, #666);
	}

	.legend-color {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.legend-label {
		color: var(--color-text-secondary, #666);
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.legend-value {
		font-weight: 600;
	}
</style>
