<script lang="ts">
	import { NO_COVER } from '$lib/utils/cover';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import LazyImage from './LazyImage.svelte';

	let { items, size = 'medium', columns }: {
		items: DiscogsCollectionItem[];
		size?: 'small' | 'medium' | 'large';
		/** A fixed number of columns (half as many, rounded up, on a phone) instead of as many as fit. */
		columns?: number;
	} = $props();

	function getArtistNames(item: DiscogsCollectionItem): string {
		return formatArtists(item.basic_information.artists);
	}
</script>

<div
	class="cover-grid size-{size}"
	class:fixed={columns !== undefined}
	style:--cols={columns}
	style:--cols-phone={columns ? Math.ceil(columns / 2) : undefined}
>
	{#each items as item (item.instance_id)}
		<a
			href="https://www.discogs.com/release/{item.basic_information.id}"
			target="_blank"
			rel="noopener noreferrer"
			class="tile"
			title="{getArtistNames(item)} - {item.basic_information.title}"
		>
			<LazyImage
				src={item.basic_information.cover_image || item.basic_information.thumb || NO_COVER}
				alt="{getArtistNames(item)} - {item.basic_information.title}"
				class="cover"
			/>
		</a>
	{/each}
</div>

<style>
	.cover-grid {
		display: grid;
		gap: 12px;
	}

	.size-small {
		grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
	}

	.size-medium {
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
	}

	.size-large {
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	}

	.cover-grid.fixed {
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 24px;
	}

	@media (max-width: 699px) {
		.cover-grid.fixed {
			grid-template-columns: repeat(var(--cols-phone), minmax(0, 1fr));
			gap: 16px;
		}
	}

	/* A square cover on the track colour; the image inside carries the .cover edge. */
	.tile {
		display: block;
		aspect-ratio: 1;
		background: var(--track);
	}
</style>
