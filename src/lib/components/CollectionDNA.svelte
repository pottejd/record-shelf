<script lang="ts">
	import type { CollectionStats } from '$lib/types/discogs';

	let { stats }: { stats: CollectionStats } = $props();

	// The collection's four traits, each a percent of the whole collection.
	let traits = $derived(calculateTraits(stats));

	/** A share of the collection as a percent from 0 to 100 (0 for an empty collection). */
	function share(count: number, total: number): number {
		return total > 0 ? Math.min(100, Math.max(0, (count / total) * 100)) : 0;
	}

	function calculateTraits(s: CollectionStats) {
		const vintageCount = Object.entries(s.decadeBreakdown)
			.filter(([decade]) => parseInt(decade) < 1990)
			.reduce((sum, [, count]) => sum + count, 0);
		const vinylCount = s.formatBreakdown['Vinyl'] || 0;
		// Fewer genres means more focused.
		const genreCount = Object.keys(s.genreBreakdown).length;

		return [
			{
				name: 'Diversity',
				detail: 'different artists per record',
				value: Math.min(Math.max(s.uniqueArtistRatio * 100, 0), 100) || 0
			},
			{ name: 'Vintage', detail: 'released before 1990', value: share(vintageCount, s.totalItems) },
			{ name: 'Vinyl', detail: 'on vinyl', value: share(vinylCount, s.totalItems) },
			{
				name: 'Focus',
				detail: 'how few genres it spans',
				value: Math.max(0, 100 - (genreCount - 1) * 10)
			}
		];
	}
</script>

<ul class="traits">
	{#each traits as trait (trait.name)}
		<li class="trait">
			<div class="trait-header">
				<span class="trait-text">
					<span class="trait-name">{trait.name}</span>
					<span class="trait-detail">{trait.detail}</span>
				</span>
				<span class="trait-value">{Math.round(trait.value)}%</span>
			</div>
			<div class="trait-bar" aria-hidden="true">
				<div class="trait-fill" style:width="{trait.value}%"></div>
			</div>
		</li>
	{/each}
</ul>

<style>
	/* Four rows under hairlines: name, what it measures and the percent, then
	   an ink bar on the track. */
	.traits {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.trait {
		padding: 12px 0;
		border-bottom: 1px solid var(--hairline);
	}

	.trait-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}

	.trait-text {
		min-width: 0;
		font-size: 18px;
	}

	.trait-name {
		font-weight: 600;
	}

	.trait-detail {
		font-size: 15px;
		color: var(--muted);
	}

	.trait-value {
		flex-shrink: 0;
		font-size: 17px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.trait-bar {
		height: 8px;
		margin-top: 10px;
		background: var(--track);
	}

	.trait-fill {
		height: 100%;
		background: var(--ink);
	}
</style>
