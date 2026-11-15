<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import LazyImage from '../LazyImage.svelte';

	let { item }: { item: DiscogsCollectionItem } = $props();

	function getArtistName(item: DiscogsCollectionItem): string {
		return formatArtists(item.basic_information.artists);
	}
</script>

<a
	href="https://www.discogs.com/release/{item.basic_information.id}"
	target="_blank"
	rel="noopener noreferrer"
	class="item-card"
>
	<div class="item-cover">
		<LazyImage
			src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
			alt=""
			class="cover"
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
	/* No box: a square cover on the ground with its text underneath. */
	.item-card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		text-decoration: none;
		color: inherit;
	}

	.item-card:hover {
		color: inherit;
	}

	.item-card:hover .item-title {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.item-cover {
		width: 100%;
		aspect-ratio: 1;
		background: var(--track);
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 12px;
	}

	.item-title {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
		line-height: 1.25;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.item-artist {
		margin: 0;
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		display: flex;
		gap: 8px;
		margin-top: 6px;
		font-size: 15px;
	}

	.item-year {
		font-weight: 600;
	}

	.item-format {
		color: var(--muted);
	}
</style>
