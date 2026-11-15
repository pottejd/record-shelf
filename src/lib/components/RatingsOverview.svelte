<script lang="ts">
	import type { CollectionStats, DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';

	let { stats }: { stats: CollectionStats } = $props();

	let maxRatingCount = $derived(Math.max(...Object.values(stats.ratingBreakdown), 1));

	function getArtistName(item: DiscogsCollectionItem): string {
		return formatArtists(item.basic_information.artists);
	}
</script>

<div class="ratings-overview">
	<div class="rating-summary">
		<div class="avg-rating">
			<span class="avg-value">{stats.averageRating.toFixed(1)}</span>
			<div class="stars">
				{#each [1, 2, 3, 4, 5] as star}
					<span class="star" class:filled={star <= Math.round(stats.averageRating)}>&#9733;</span>
				{/each}
			</div>
			<span class="avg-label">{stats.ratedCount} of {stats.totalItems} rated</span>
		</div>
	</div>

	<div class="rating-distribution">
		{#each [5, 4, 3, 2, 1] as rating}
			{@const count = stats.ratingBreakdown[rating] || 0}
			<div class="rating-row">
				<span class="rating-label">{rating} &#9733;</span>
				<div class="rating-bar-track">
					<div
						class="rating-bar-fill"
						style:width="{maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0}%"
					></div>
				</div>
				<span class="rating-count">{count}</span>
			</div>
		{/each}
	</div>

	{#if stats.topRatedItems.length > 0}
		<div class="top-rated">
			<h4>Top rated</h4>
			<div class="top-rated-list rows">
				{#each stats.topRatedItems.slice(0, 6) as item}
					<a
						href="https://www.discogs.com/release/{item.basic_information.id}"
						target="_blank"
						rel="noopener noreferrer"
						class="top-rated-item"
					>
						<img
							src={item.basic_information.thumb || '/placeholder.svg'}
							alt=""
							class="top-rated-thumb cover"
						/>
						<div class="top-rated-info">
							<span class="top-rated-title">{item.basic_information.title}</span>
							<span class="top-rated-artist">{getArtistName(item)}</span>
						</div>
						<span class="top-rated-stars">
							{#each Array(item.rating) as _}&#9733;{/each}
						</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.ratings-overview {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.avg-rating {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 16px;
	}

	.avg-value {
		font-size: 34px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.stars {
		display: flex;
		gap: 2px;
		font-size: 20px;
	}

	.star {
		color: var(--hairline);
	}

	.star.filled {
		color: var(--ink);
	}

	.avg-label {
		font-size: 15px;
		color: var(--muted);
	}

	/* Five ink bars, 5 stars to 1, each with its count. */
	.rating-distribution {
		display: flex;
		flex-direction: column;
	}

	.rating-row {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 36px;
	}

	.rating-label {
		width: 40px;
		font-size: 15px;
		color: var(--muted);
		flex-shrink: 0;
	}

	.rating-bar-track {
		flex: 1;
		height: 16px;
		background: var(--track);
	}

	.rating-bar-fill {
		height: 100%;
		background: var(--ink);
		min-width: 2px;
	}

	.rating-count {
		width: 40px;
		font-size: 15px;
		font-weight: 600;
		text-align: right;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.top-rated h4 {
		margin: 0 0 4px;
		font-size: 18px;
		font-weight: 700;
	}

	.top-rated-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 0;
		text-decoration: none;
		color: inherit;
	}

	.top-rated-item:hover .top-rated-title {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.top-rated-thumb {
		width: 48px;
		height: 48px;
		background: var(--track);
		flex-shrink: 0;
	}

	.top-rated-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.top-rated-title {
		font-size: 17px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.top-rated-artist {
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.top-rated-stars {
		font-size: 15px;
		flex-shrink: 0;
	}
</style>
