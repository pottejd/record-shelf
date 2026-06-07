<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import type { AlbumGroup } from '$lib/utils/albums';
	import { formatArtists } from '$lib/utils/discogs';

	let {
		groups,
		onSelect
	}: {
		groups: AlbumGroup[];
		onSelect: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();

	function ownedFormats(group: AlbumGroup): string {
		return [
			...new Set(group.items.flatMap((i) => i.basic_information.formats.map((f) => f.name)))
		].join(', ');
	}
</script>

<ul class="upg-list">
	{#each groups as group (group.key)}
		{@const info = group.items[0].basic_information}
		<li>
			<button class="upg-row" onclick={() => onSelect(info.title, group.items)}>
				<img src={info.thumb || '/placeholder.svg'} alt="" class="upg-cover" loading="lazy" />
				<span class="upg-info">
					<span class="upg-title">{info.title}</span>
					<span class="upg-artist">{formatArtists(info.artists)}</span>
				</span>
				<span class="upg-meta">owned on {ownedFormats(group)} · no vinyl</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	.upg-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.upg-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.5rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		cursor: pointer;
		text-align: left;
		color: var(--color-text);
	}

	.upg-row:hover {
		border-color: var(--color-primary);
	}

	.upg-cover {
		width: 44px;
		height: 44px;
		border-radius: 6px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.upg-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.upg-title {
		font-weight: 600;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.upg-artist {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.upg-meta {
		flex-shrink: 0;
		font-size: 0.7rem;
		color: var(--color-text-tertiary);
	}
</style>
