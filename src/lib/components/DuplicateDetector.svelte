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

<ul class="dup-list rows">
	{#each groups as group (group.key)}
		{@const info = group.items[0].basic_information}
		<li>
			<button class="dup-row" onclick={() => onSelect(info.title, group.items)}>
				<img src={info.thumb || '/placeholder.svg'} alt="" class="dup-cover cover" loading="lazy" />
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
	/* Rows on the ground divided by hairlines; the whole row opens the side list. */
	.dup-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.dup-row {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		padding: 12px 0;
		background: transparent;
		border: 0;
		border-radius: 0;
		font: inherit;
		cursor: pointer;
		text-align: left;
		color: var(--ink);
	}

	.dup-row:hover .dup-title {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.dup-cover {
		width: 56px;
		height: 56px;
		background: var(--track);
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
		font-size: 17px;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dup-artist {
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dup-count {
		flex-shrink: 0;
		font-size: 17px;
		font-weight: 600;
	}
</style>
