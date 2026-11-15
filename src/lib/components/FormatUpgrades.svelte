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

<ul class="upg-list rows">
	{#each groups as group (group.key)}
		{@const info = group.items[0].basic_information}
		<li>
			<button class="upg-row" onclick={() => onSelect(info.title, group.items)}>
				<img src={info.thumb || '/placeholder.svg'} alt="" class="upg-cover cover" loading="lazy" />
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
	/* Rows on the ground divided by hairlines; the whole row opens the side list. */
	.upg-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.upg-row {
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

	.upg-row:hover .upg-title {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.upg-cover {
		width: 56px;
		height: 56px;
		background: var(--track);
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
		font-size: 17px;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.upg-artist {
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.upg-meta {
		flex: 0 1 auto;
		max-width: 45%;
		font-size: 15px;
		color: var(--muted);
		text-align: right;
	}
</style>
