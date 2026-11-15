<script lang="ts">
	import { partColour, type ChartDatum } from '$lib/utils/chart';

	let { parts, height = 12, legend = true, label }: {
		parts: ChartDatum[];
		height?: number;
		legend?: boolean;
		label: string;
	} = $props();

	/** Each part keeps the colour of its place in `parts`, even when an earlier one is not drawn. */
	let drawn = $derived.by(() => {
		const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0);
		return parts
			.map((p, i) => ({
				label: p.label,
				value: p.value,
				colour: partColour(p.label, i),
				percent: total > 0 ? Math.round((p.value / total) * 100) : 0
			}))
			.filter((p) => p.value > 0);
	});

	let name = $derived(`${label}: ${drawn.map((p) => `${p.label} ${p.percent}%`).join(', ')}`);
</script>

{#if drawn.length > 0}
	<div class="split">
		<div class="bar" role="img" aria-label={name} style:height="{height}px">
			{#each drawn as p (p.label)}
				<div class="segment" data-segment style:flex-grow={p.value} style:background={p.colour}></div>
			{/each}
		</div>
		{#if legend}
			<ul class="legend">
				{#each drawn as p (p.label)}
					<li>
						<span class="swatch" aria-hidden="true" style:background={p.colour}></span>
						<span>{p.label}</span>
						<span class="pct">{p.percent}%</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.bar {
		display: flex;
		gap: 2px;
		background: var(--ground);
	}

	.segment {
		flex: 1 1 0;
		min-width: 0;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 20px;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
		color: var(--ink);
		font-size: 15px;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pct {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
