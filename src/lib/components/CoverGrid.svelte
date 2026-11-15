<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import LazyImage from './LazyImage.svelte';

	let { items, size = 'medium' }: { items: DiscogsCollectionItem[]; size?: 'small' | 'medium' | 'large' } = $props();

	function getArtistNames(item: DiscogsCollectionItem): string {
		return formatArtists(item.basic_information.artists);
	}
</script>

<div class="cover-grid size-{size}">
	{#each items as item (item.instance_id)}
		<a
			href="https://www.discogs.com/release/{item.basic_information.id}"
			target="_blank"
			rel="noopener noreferrer"
			class="tile"
			title="{getArtistNames(item)} - {item.basic_information.title}"
		>
			<LazyImage
				src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
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

	/* A square cover on the track colour; the image inside carries the .cover edge. */
	.tile {
		display: block;
		aspect-ratio: 1;
		background: var(--track);
	}
</style>
