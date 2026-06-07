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
</script>

<ul class="dup-list">
	{#each groups as group (group.key)}
		{@const info = group.items[0].basic_information}
		<li>
			<button class="dup-row" onclick={() => onSelect(info.title, group.items)}>
				<img src={info.thumb || '/placeholder.svg'} alt="" class="dup-cover" loading="lazy" />
				<span class="dup-info">
					<span class="dup-title">{info.title}</span>
					<span class="dup-artist">{formatArtists(info.artists)}</span>
				</span>
				<span class="dup-count">{group.items.length} copies</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	.dup-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dup-row {
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

	.dup-row:hover {
		border-color: var(--color-primary);
	}

	.dup-cover {
		width: 44px;
		height: 44px;
		border-radius: 6px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.dup-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.dup-title {
		font-weight: 600;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dup-artist {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dup-count {
		flex-shrink: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-primary);
		padding: 0.25rem 0.625rem;
		background: var(--color-bg-card);
		border-radius: 999px;
	}
</style>
