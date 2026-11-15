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
					{@const label = `${year}: ${count} release${count !== 1 ? 's' : ''}`}
					<button
						class="year-cell step-{shadeStep(count, maxCount)}"
						class:clickable={!!onYearClick && count > 0}
						style:grid-column={(year % 10) + 1}
						title={label}
						aria-label={label}
						type="button"
						disabled={!count}
						onclick={() => count > 0 && onYearClick?.(year)}
					>
						<span class="year-num">{year.toString().slice(-2)}</span>
					</button>
				{/each}
			</div>
		</div>
	{/each}
	<div class="legend">
		<span>Less</span>
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
	   A year with nothing is an empty cell with a hairline edge. */
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
		width: 52px;
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

	.year-cell:disabled {
		cursor: default;
	}

	.year-num {
		font-size: 13px;
		font-weight: 600;
	}

	.year-cell.step-0 {
		box-shadow: inset 0 0 0 1px var(--hairline);
		color: var(--muted);
	}

	.step-1 { background: var(--shade-1); }
	.step-2 { background: var(--shade-2); }
	.step-3 { background: var(--shade-3); }
	.step-4 { background: var(--shade-4); }
	.step-5 { background: var(--shade-5); }

	/* The number on a cell takes ink or ground, whichever reads on that step. */
	.year-cell.step-4,
	.year-cell.step-5 {
		color: var(--ground);
	}

	:global(html[data-theme="dark"]) .year-cell.step-3 {
		color: var(--ground);
	}

	@media (prefers-color-scheme: dark) {
		:global(html:not([data-theme="light"])) .year-cell.step-3 {
			color: var(--ground);
		}
	}

	.legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
		font-size: 15px;
		color: var(--muted);
	}

	.legend-scale {
		display: flex;
		gap: 4px;
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
