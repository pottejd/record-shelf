<script lang="ts">
	import { shadeStep } from '$lib/utils/chart';

	let { data, onYearClick }: { data: Record<number, number>; onYearClick?: (year: number) => void } = $props();

	let years = $derived(Object.keys(data).map(Number).sort((a, b) => a - b));
	let minYear = $derived(years.length > 0 ? Math.min(...years) : 0);
	let maxYear = $derived(years.length > 0 ? Math.max(...years) : 0);
	let maxCount = $derived(years.length > 0 ? Math.max(...Object.values(data)) : 1);

	let allYears = $derived(Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i));

	// Group years by decade once per data change, instead of filtering the full
	// year range for every decade row on every render.
	let yearsByDecade = $derived.by(() => {
		const map = new Map<number, number[]>();
		for (const y of allYears) {
			const decade = Math.floor(y / 10) * 10;
			if (!map.has(decade)) map.set(decade, []);
			map.get(decade)!.push(y);
		}
		return map;
	});
	let decades = $derived([...yearsByDecade.keys()].sort((a, b) => a - b));
</script>

<div class="year-heatmap">
	{#each decades as decade}
		<div class="decade-row">
			<span class="decade-label">{decade}s</span>
			<div class="years">
				{#each yearsByDecade.get(decade) ?? [] as year}
					{@const count = data[year] || 0}
					{@const column = year % 10}
					{#if count > 0}
						{@const label = `${year}: ${count} release${count !== 1 ? 's' : ''}`}
						<button
							class="year-cell step-{shadeStep(count, maxCount)}"
							class:clickable={!!onYearClick}
							style:grid-column={column + 1}
							aria-label={label}
							type="button"
							onclick={() => onYearClick?.(year)}
						>
							<span class="year-num" aria-hidden="true">{year.toString().slice(-2)}</span>
							<span class="year-tip" class:tip-end={column >= 5} aria-hidden="true">{label}</span>
						</button>
					{:else}
						<span class="year-cell empty" data-empty style:grid-column={column + 1}></span>
					{/if}
				{/each}
			</div>
		</div>
	{/each}
	<div class="legend" aria-hidden="true">
		<span>Fewer</span>
		<div class="legend-scale">
			{#each [1, 2, 3, 4, 5] as step}
				<div class="legend-cell step-{step}"></div>
			{/each}
		</div>
		<span>More</span>
	</div>
</div>

<style>
	/* A row per decade of ten year cells, shaded by count on the five-step ramp.
	   A year with nothing is an empty cell with a hairline edge. A year with
	   records is a button: its number shows in the cell, and its count shows in a
	   label above it on hover and on keyboard focus alike. */
	.year-heatmap {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.decade-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.decade-label {
		width: 56px;
		font-size: 15px;
		color: var(--muted);
		flex-shrink: 0;
	}

	.years {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 2px;
	}

	.year-cell {
		position: relative;
		height: 32px;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 0;
		padding: 0;
		font: inherit;
		background: none;
		color: var(--ink);
	}

	.year-cell.clickable {
		cursor: pointer;
	}

	.year-cell.clickable:hover .year-num {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.year-num {
		font-size: 13px;
		font-weight: 600;
	}

	.year-cell.empty {
		box-shadow: inset 0 0 0 1px var(--hairline);
	}

	/* Each step carries its own text colour: ink or ground, whichever reads there. */
	.step-1 { background: var(--shade-1); color: var(--shade-1-text); }
	.step-2 { background: var(--shade-2); color: var(--shade-2-text); }
	.step-3 { background: var(--shade-3); color: var(--shade-3-text); }
	.step-4 { background: var(--shade-4); color: var(--shade-4-text); }
	.step-5 { background: var(--shade-5); color: var(--shade-5-text); }

	/* The label: ink with ground-coloured text, over the cell, kept inside the
	   grid (the left half of a row opens rightwards, the right half leftwards). */
	.year-tip {
		display: none;
		position: absolute;
		bottom: calc(100% + 6px);
		left: 0;
		z-index: 2;
		padding: 6px 10px;
		background: var(--ink);
		color: var(--on-ink);
		font-size: 15px;
		font-weight: 400;
		line-height: 1.3;
		white-space: nowrap;
		pointer-events: none;
	}

	.year-tip.tip-end {
		left: auto;
		right: 0;
	}

	.year-cell:hover .year-tip,
	.year-cell:focus-visible .year-tip {
		display: block;
	}

	.year-cell:hover,
	.year-cell:focus-visible {
		z-index: 1;
	}

	.legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		margin-top: 16px;
		font-size: 15px;
		color: var(--muted);
	}

	.legend-scale {
		display: flex;
		gap: 6px;
		margin: 0 4px;
	}

	.legend-cell {
		width: 16px;
		height: 16px;
	}

	@media (max-width: 699px) {
		.decade-row {
			gap: 8px;
		}

		.decade-label {
			width: 44px;
			font-size: 13px;
		}

		.year-num {
			font-size: 11px;
		}
	}
</style>
