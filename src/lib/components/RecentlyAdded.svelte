<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	export let items: DiscogsCollectionItem[];

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
		return item.basic_information.artists.map((a) => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
	}
</script>

<div class="recently-added">
	{#each items as item}
		<a
			href="https://www.discogs.com/release/{item.basic_information.id}"
			target="_blank"
			rel="noopener"
			class="item"
			title="{getArtistNames(item)} - {item.basic_information.title}"
		>
			<img
				src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
				alt="{getArtistNames(item)} - {item.basic_information.title}"
				loading="lazy"
			/>
			<span class="time-badge">{getTimeAgo(item.date_added)}</span>
		</a>
	{/each}
</div>

<style>
	.recently-added {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.item {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 6px;
		background: var(--color-bg-secondary, #f5f5f5);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.item:hover {
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1;
	}

	.item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.time-badge {
		position: absolute;
		bottom: 0.375rem;
		left: 0.375rem;
		padding: 0.125rem 0.375rem;
		background: rgba(0, 0, 0, 0.75);
		color: white;
		font-size: 0.625rem;
		font-weight: 600;
		border-radius: 4px;
		backdrop-filter: blur(4px);
	}
</style>
