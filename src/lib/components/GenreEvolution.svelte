<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { getGenreColor } from '$lib/constants';

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
								style:background={getGenreColor(genre.name)}
								title="{genre.name}: {genre.count} ({genre.percentage.toFixed(0)}%)"
							></div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		<div class="legend">
			{#each [...new Set(evolution.flatMap(e => e.genres.map(g => g.name)))] as genre}
				<div class="legend-item">
					<span class="legend-color" style:background={getGenreColor(genre)}></span>
					<span class="legend-label">{genre}</span>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<p class="no-data">Not enough data to show genre evolution</p>
{/if}

<style>
	.genre-evolution {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.timeline {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.period {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.period-label {
		width: 48px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-align: right;
		flex-shrink: 0;
	}

	.genre-bars {
		flex: 1;
		display: flex;
		height: 28px;
		background: var(--color-bg-secondary);
		border-radius: 6px;
		overflow: hidden;
	}

	.genre-bar {
		height: 100%;
		min-width: 4px;
		transition: width 0.3s ease;
	}

	.genre-bar:hover {
		opacity: 0.8;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		padding-top: 0.5rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}

	.legend-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.no-data {
		text-align: center;
		color: var(--color-text-tertiary);
		font-size: 0.875rem;
		padding: 2rem 1rem;
		margin: 0;
	}
</style>
