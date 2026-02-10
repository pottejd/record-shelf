<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import LazyImage from '../LazyImage.svelte';

	let { item }: { item: DiscogsCollectionItem } = $props();

	function getArtistName(item: DiscogsCollectionItem): string {
		return item.basic_information.artists.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
	}
</script>

<a
	href="https://www.discogs.com/release/{item.basic_information.id}"
	target="_blank"
	rel="noopener"
	class="item-card"
>
	<div class="item-cover">
		<LazyImage
			src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
			alt=""
		/>
	</div>
	<div class="item-info">
		<p class="item-title">{item.basic_information.title}</p>
		<p class="item-artist">{getArtistName(item)}</p>
		<div class="item-meta">
			{#if item.basic_information.year}
				<span class="item-year">{item.basic_information.year}</span>
			{/if}
			{#if item.basic_information.formats?.[0]}
				<span class="item-format">{item.basic_information.formats[0].name}</span>
			{/if}
		</div>
	</div>
</a>

<style>
	.item-card {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: inherit;
		border-radius: 10px;
		overflow: hidden;
		background: var(--color-bg-secondary);
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.item-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.item-cover {
		width: 100%;
		aspect-ratio: 1;
		background: var(--color-bg-tertiary);
	}

	.item-info {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.item-title {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.item-artist {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.item-year, .item-format {
		font-size: 0.6875rem;
		color: var(--color-text-tertiary);
	}

	.item-year {
		font-weight: 600;
		color: var(--color-primary);
	}

	@media (max-width: 600px) {
		.item-info {
			padding: 0.5rem;
		}
	}
</style>
