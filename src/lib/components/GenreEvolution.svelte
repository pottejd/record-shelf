<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { partColour } from '$lib/utils/chart';
	import { genreEvolution } from '$lib/utils/genreEvolution';
	import SplitBar from '$lib/components/SplitBar.svelte';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	let evolution = $derived(genreEvolution(items));
	let hasOther = $derived(
		evolution.years.some((y) => y.parts.some((p) => p.label === 'Other' && p.value > 0))
	);

	/** "Rock 12, Jazz 8, Other 3": every part with a count, in the order of the bar. */
	function counts(parts: { label: string; value: number }[]): string {
		return parts
			.filter((p) => p.value > 0)
			.map((p) => `${p.label} ${p.value.toLocaleString()}`)
			.join(', ');
	}
</script>

{#if evolution.years.length > 0}
	<div class="genre-evolution">
		<!-- Not "rows": the global .rows rule would draw hairlines between the years. -->
		<div class="years">
			{#each evolution.years as y (y.year)}
				<div class="year">
					<span class="year-label">{y.year}</span>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div class="bar-cell" role="group" aria-label="{y.year} by genre" tabindex="0">
						<SplitBar parts={y.parts} height={20} legend={false} label="{y.year} by genre" />
						<span class="counts">{counts(y.parts)}</span>
					</div>
					<span class="year-total">{y.total.toLocaleString()}</span>
				</div>
			{/each}
		</div>
		<ul class="legend">
			{#each evolution.genres as genre, i (genre)}
				<li>
					<span class="swatch" aria-hidden="true" style:background={partColour(genre, i)}></span>
					<span>{genre}</span>
				</li>
			{/each}
			{#if hasOther}
				<li>
					<span class="swatch" aria-hidden="true" style:background={partColour('Other', evolution.genres.length)}></span>
					<span>Other</span>
				</li>
			{/if}
		</ul>
	</div>
{:else}
	<p class="no-data">Not enough data to show genre evolution</p>
{/if}

<style>
	.genre-evolution {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.year {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 44px;
	}

	.year-label {
		width: 44px;
		flex-shrink: 0;
		font-size: 15px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.bar-cell {
		position: relative;
		flex: 1;
		min-width: 0;
	}

	.year-total {
		min-width: 4ch;
		flex-shrink: 0;
		text-align: right;
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Always in the page for screen readers; seen on hover and on keyboard focus. */
	.counts {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.bar-cell:hover .counts,
	.bar-cell:focus-visible .counts {
		top: 100%;
		left: 0;
		z-index: 1;
		width: auto;
		height: auto;
		margin: 4px 0 0;
		padding: 4px 8px;
		overflow: visible;
		clip-path: none;
		white-space: normal;
		background: var(--ink);
		color: var(--on-ink);
		font-size: 15px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		margin: 0;
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

	.no-data {
		color: var(--muted);
		margin: 0;
	}
</style>
