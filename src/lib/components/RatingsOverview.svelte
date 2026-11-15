<script lang="ts">
	import type { CollectionStats, DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';

	let { stats }: { stats: CollectionStats } = $props();

	let maxRatingCount = $derived(Math.max(...Object.values(stats.ratingBreakdown), 1));

	function getArtistName(item: DiscogsCollectionItem): string {
		return formatArtists(item.basic_information.artists);
	}

	const stars = (n: number) => `${n} ${n === 1 ? 'star' : 'stars'}`;
</script>

<dl class="facts">
	<div class="fact">
		<dt>Average rating</dt>
		<dd>{stats.averageRating.toFixed(1)}</dd>
	</div>
	<div class="fact">
		<dt>Rated</dt>
		<dd>{stats.ratedCount.toLocaleString()} of {stats.totalItems.toLocaleString()}</dd>
	</div>
</dl>

<div class="distribution">
	{#each [5, 4, 3, 2, 1] as rating}
		{@const count = stats.ratingBreakdown[rating] || 0}
		<div class="rating-row">
			<span class="rating-label">{stars(rating)}</span>
			<div class="track">
				<div class="fill" style:width="{(count / maxRatingCount) * 100}%"></div>
			</div>
			<span class="rating-count">{count.toLocaleString()}</span>
		</div>
	{/each}
</div>

{#if stats.topRatedItems.length > 0}
	<h3>Top rated</h3>
	<ul class="top-rated">
		{#each stats.topRatedItems.slice(0, 6) as item}
			<li>
				<a
					href="https://www.discogs.com/release/{item.basic_information.id}"
					target="_blank"
					rel="noopener noreferrer"
					class="top-rated-item"
				>
					<img src={item.basic_information.thumb || '/placeholder.svg'} alt="" class="thumb cover" />
					<span class="info">
						<span class="title">{item.basic_information.title}</span>
						<span class="artist">{getArtistName(item)}</span>
					</span>
					<span class="item-stars" aria-hidden="true">{'★'.repeat(item.rating)}</span>
					<span class="visually-hidden">{stars(item.rating)}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	/* Two fact rows: label left, value right, 60px high, under a hairline. */
	.facts {
		margin: 0;
	}

	.fact {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		min-height: 60px;
		border-bottom: 1px solid var(--hairline);
	}

	dt {
		font-size: 18px;
	}

	dd {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Five ink bars on their tracks, 5 stars to 1, each with its count. */
	.distribution {
		margin-top: 12px;
	}

	.rating-row {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 36px;
	}

	.rating-label {
		width: 60px;
		flex-shrink: 0;
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
	}

	.track {
		flex: 1;
		min-width: 0;
		height: 16px;
		background: var(--track);
	}

	.fill {
		height: 100%;
		min-width: 2px;
		background: var(--ink);
	}

	.rating-count {
		min-width: 3ch;
		flex-shrink: 0;
		font-size: 15px;
		font-weight: 600;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	h3 {
		margin: 24px 0 4px;
		font-size: 18px;
		font-weight: 700;
	}

	.top-rated {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.top-rated li {
		border-bottom: 1px solid var(--hairline);
	}

	.top-rated-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 0;
		text-decoration: none;
		color: inherit;
	}

	.top-rated-item:hover .title {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.thumb {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		background: var(--track);
	}

	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.title,
	.artist {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title {
		font-size: 17px;
		font-weight: 600;
	}

	.artist {
		font-size: 15px;
		color: var(--muted);
	}

	.item-stars {
		flex-shrink: 0;
		font-size: 15px;
	}
</style>
