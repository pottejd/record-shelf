<script lang="ts">
	import { NO_COVER, showNoCover } from '$lib/utils/cover';
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
				<img src={info.thumb || NO_COVER} alt="" class="upg-cover cover" onerror={showNoCover} loading="lazy" />
				<span class="upg-info">
					<span class="upg-title">{info.title}</span>
					<span class="upg-artist">{formatArtists(info.artists)}</span>
				</span>
				<span class="upg-meta">Owned on {ownedFormats(group)} · no vinyl</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	/* Rows on the ground divided by hairlines; the whole row opens the side list. */
	.upg-list {
		container: upgrades / inline-size;
		list-style: none;
		margin: 0;
		padding: 0;
		border-bottom: 1px solid var(--hairline);
	}

	/* Cover, title and artist, then the formats at the right edge. */
	.upg-row {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr) fit-content(40%);
		grid-template-areas: 'cover info meta';
		align-items: center;
		gap: 2px 16px;
		width: 100%;
		padding: 14px 0;
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
		grid-area: cover;
		width: 56px;
		height: 56px;
		background: var(--track);
	}

	.upg-info {
		grid-area: info;
		display: flex;
		flex-direction: column;
		min-width: 0;
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
		grid-area: meta;
		min-width: 0;
		font-size: 15px;
		color: var(--muted);
		text-align: right;
		overflow-wrap: anywhere;
	}

	/* In a narrow column (a phone) the formats go under the artist, so the title
	   keeps the width of the row. */
	@container upgrades (max-width: 480px) {
		.upg-row {
			grid-template-columns: 56px minmax(0, 1fr);
			grid-template-areas:
				'cover info'
				'cover meta';
		}

		.upg-meta {
			text-align: left;
		}
	}
</style>
