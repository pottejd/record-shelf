<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items, size = 'medium' }: { items: DiscogsCollectionItem[]; size?: 'small' | 'medium' | 'large' } = $props();

	function getArtistNames(item: DiscogsCollectionItem): string {
		return item.basic_information.artists.map((a) => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
	}
</script>

<div class="cover-grid size-{size}">
	{#each items as item}
		<a
			href="https://www.discogs.com/release/{item.basic_information.id}"
			target="_blank"
			rel="noopener"
			class="cover"
			title="{getArtistNames(item)} - {item.basic_information.title}"
		>
			<img
				src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
				alt="{getArtistNames(item)} - {item.basic_information.title}"
				loading="lazy"
			/>
		</a>
	{/each}
</div>

<style>
	.cover-grid {
		display: grid;
		gap: 0.5rem;
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

	.cover {
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 4px;
		background: var(--color-bg-secondary, #f5f5f5);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.cover:hover {
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1;
	}

	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
