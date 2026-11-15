<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { chartColour, foldSeries } from '$lib/utils/chart';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	interface GenrePeriod {
		period: string;
		genres: { name: string; count: number; percentage: number }[];
	}

	let evolution = $derived(calculateEvolution(items));

	function calculateEvolution(items: DiscogsCollectionItem[]): GenrePeriod[] {
		// Group items by year added
		const byYear = new Map<number, DiscogsCollectionItem[]>();

		for (const item of items) {
			const year = new Date(item.date_added).getFullYear();
			if (!byYear.has(year)) byYear.set(year, []);
			byYear.get(year)!.push(item);
		}

		const years = Array.from(byYear.keys()).sort((a, b) => a - b);
		if (years.length === 0) return [];

		// Take last 5 years or all if less
		const recentYears = years.slice(-5);

		return recentYears.map(year => {
			const yearItems = byYear.get(year)!;
			const genreCount = new Map<string, number>();

			for (const item of yearItems) {
				for (const genre of item.basic_information.genres || []) {
					genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
				}
			}

			const total = yearItems.length;
			const genres = Array.from(genreCount.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 4)
				.map(([name, count]) => ({
					name,
					count,
					percentage: (count / total) * 100
				}));

			return { period: String(year), genres };
		});
	}

	// Every genre shown, ranked by its count across the years shown: the five
	// biggest keep one chart colour in every row, the rest share "Other".
	let legend = $derived(
		foldSeries(
			[...evolution.flatMap((e) => e.genres).reduce(
				(totals, g) => totals.set(g.name, (totals.get(g.name) ?? 0) + g.count),
				new Map<string, number>()
			)].map(([label, value]) => ({ label, value }))
		).map((part, i) => ({ label: part.label, color: chartColour(i) }))
	);
	let colourOf = $derived(new Map(legend.map((part) => [part.label, part.color])));
</script>

{#if evolution.length > 0}
	<div class="genre-evolution">
		<div class="timeline">
			{#each evolution as period}
				<div class="period">
					<div class="period-label">{period.period}</div>
					<div class="genre-bars">
						{#each period.genres as genre}
							<div
								class="genre-bar"
								style:width="{genre.percentage}%"
								style:background={colourOf.get(genre.name) ?? chartColour(5)}
								title="{genre.name}: {genre.count} ({genre.percentage.toFixed(0)}%)"
							></div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		<div class="legend">
			{#each legend as part}
				<div class="legend-item">
					<span class="swatch" style:background={part.color}></span>
					<span class="legend-label">{part.label}</span>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<p class="no-data">Not enough data to show genre evolution</p>
{/if}

<style>
	/* A row per year: one bar split by genre in the chart colours, on the track. */
	.genre-evolution {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.timeline {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.period {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 40px;
	}

	.period-label {
		width: 44px;
		font-size: 15px;
		color: var(--muted);
		flex-shrink: 0;
	}

	.genre-bars {
		flex: 1;
		min-width: 0;
		display: flex;
		gap: 2px;
		height: 20px;
		background: var(--track);
		overflow: hidden;
	}

	.genre-bar {
		height: 100%;
		min-width: 4px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.swatch {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.legend-label {
		font-size: 15px;
		color: var(--ink);
	}

	.no-data {
		color: var(--muted);
		margin: 0;
	}
</style>
