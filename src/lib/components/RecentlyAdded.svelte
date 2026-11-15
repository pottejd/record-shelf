<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	function getTimeAgo(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
		return `${Math.floor(diffDays / 365)}y ago`;
	}

	function getArtistNames(item: DiscogsCollectionItem): string {
		return formatArtists(item.basic_information.artists);
	}
</script>

<div class="recently-added">
	{#each items as item}
		<a
			href="https://www.discogs.com/release/{item.basic_information.id}"
			target="_blank"
			rel="noopener noreferrer"
			class="item"
			title="{getArtistNames(item)} - {item.basic_information.title}"
		>
			<img
				src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
				alt="{getArtistNames(item)} - {item.basic_information.title}"
				loading="lazy"
				class="cover"
			/>
			<span class="time-badge">{getTimeAgo(item.date_added)}</span>
		</a>
	{/each}
</div>

<style>
	.recently-added {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 12px;
	}

	/* A square cover on the track colour with how long ago it was added in an
	   ink label at its foot. */
	.item {
		position: relative;
		display: block;
		aspect-ratio: 1;
		overflow: hidden;
		background: var(--track);
		text-decoration: none;
	}

	.item img {
		width: 100%;
		height: 100%;
	}

	.time-badge {
		position: absolute;
		bottom: 0;
		left: 0;
		padding: 2px 6px;
		background: var(--ink);
		color: var(--on-ink);
		font-size: 13px;
		font-weight: 600;
		line-height: 1.3;
	}
</style>
