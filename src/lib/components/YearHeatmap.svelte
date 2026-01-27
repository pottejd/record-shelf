<script lang="ts">
	export let data: Record<number, number>;
	export let onYearClick: ((year: number) => void) | undefined = undefined;

	$: years = Object.keys(data).map(Number).sort((a, b) => a - b);
	$: minYear = Math.min(...years);
	$: maxYear = Math.max(...years);
	$: maxCount = Math.max(...Object.values(data));

	$: allYears = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
	$: decades = [...new Set(allYears.map((y) => Math.floor(y / 10) * 10))].sort();

	function getIntensity(count: number): number {
		if (!count) return 0;
		return Math.max(0.15, count / maxCount);
	}

	function getYearsInDecade(decade: number): number[] {
		return allYears.filter((y) => Math.floor(y / 10) * 10 === decade);
	}
</script>

<div class="year-heatmap">
	{#each decades as decade}
		<div class="decade-row">
			<span class="decade-label">{decade}s</span>
			<div class="years">
				{#each getYearsInDecade(decade) as year}
					{@const count = data[year] || 0}
					<button
						class="year-cell"
						class:empty={!count}
						class:clickable={!!onYearClick && count > 0}
						style:--intensity={getIntensity(count)}
						title="{year}: {count} release{count !== 1 ? 's' : ''}"
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
			{#each [0.15, 0.35, 0.55, 0.75, 1] as intensity}
				<div class="legend-cell" style:--intensity={intensity}></div>
			{/each}
		</div>
		<span>More</span>
	</div>
</div>

<style>
	.year-heatmap {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.decade-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.decade-label {
		width: 40px;
		font-size: 0.6875rem;
		color: var(--color-text-secondary, #666);
		text-align: right;
		flex-shrink: 0;
	}

	.years {
		display: flex;
		gap: 2px;
		flex-wrap: wrap;
	}

	.year-cell {
		width: 28px;
		height: 28px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(99, 102, 241, var(--intensity, 0));
		transition: transform 0.15s, box-shadow 0.15s;
		border: none;
		padding: 0;
		font: inherit;
	}

	.year-cell.clickable {
		cursor: pointer;
	}

	.year-cell.clickable:hover {
		transform: scale(1.1);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 1;
	}

	.year-cell.empty {
		background: var(--color-bg-secondary, #f0f0f0);
		cursor: default;
	}

	.year-num {
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--color-text, #1a1a1a);
		opacity: 0.7;
	}

	.year-cell:not(.empty) .year-num {
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		opacity: 1;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		font-size: 0.6875rem;
		color: var(--color-text-secondary, #666);
	}

	.legend-scale {
		display: flex;
		gap: 2px;
	}

	.legend-cell {
		width: 14px;
		height: 14px;
		border-radius: 2px;
		background: rgba(99, 102, 241, var(--intensity));
	}
</style>
