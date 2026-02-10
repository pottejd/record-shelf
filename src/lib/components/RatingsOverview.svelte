<script lang="ts">
	import type { CollectionStats, DiscogsCollectionItem } from '$lib/types/discogs';

	let { stats }: { stats: CollectionStats } = $props();

	let maxRatingCount = $derived(Math.max(...Object.values(stats.ratingBreakdown), 1));

	function getArtistName(item: DiscogsCollectionItem): string {
		return item.basic_information.artists.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
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
			<h4>Top Rated</h4>
			<div class="top-rated-list">
				{#each stats.topRatedItems.slice(0, 6) as item}
					<a
						href="https://www.discogs.com/release/{item.basic_information.id}"
						target="_blank"
						rel="noopener"
						class="top-rated-item"
					>
						<img
							src={item.basic_information.thumb || '/placeholder.svg'}
							alt=""
							class="top-rated-thumb"
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
		gap: 1.5rem;
	}

	.rating-summary {
		display: flex;
		justify-content: center;
	}

	.avg-rating {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1rem 2rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(236, 72, 153, 0.1));
		border-radius: 12px;
	}

	.avg-value {
		font-size: 2rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.stars {
		display: flex;
		gap: 0.125rem;
		font-size: 1.25rem;
	}

	.star {
		color: var(--color-border);
	}

	.star.filled {
		color: #eab308;
	}

	.avg-label {
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
	}

	.rating-distribution {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.rating-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.rating-label {
		width: 2.5rem;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		text-align: right;
		flex-shrink: 0;
	}

	.rating-bar-track {
		flex: 1;
		height: 8px;
		background: var(--color-bg-secondary);
		border-radius: 4px;
		overflow: hidden;
	}

	.rating-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #6366f1, #8b5cf6);
		border-radius: 4px;
		transition: width 0.3s ease;
		min-width: 2px;
	}

	.rating-count {
		width: 2rem;
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		text-align: right;
		flex-shrink: 0;
	}

	.top-rated h4 {
		margin: 0 0 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}

	.top-rated-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.top-rated-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: background-color 0.15s;
	}

	.top-rated-item:hover {
		background: var(--color-bg-secondary);
	}

	.top-rated-thumb {
		width: 40px;
		height: 40px;
		border-radius: 6px;
		object-fit: cover;
		background: var(--color-bg-secondary);
		flex-shrink: 0;
	}

	.top-rated-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.top-rated-title {
		font-size: 0.8125rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.top-rated-artist {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.top-rated-stars {
		color: #eab308;
		font-size: 0.75rem;
		flex-shrink: 0;
	}
</style>
