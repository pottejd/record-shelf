<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { cleanArtistName } from '$lib/utils/discogs';

	let { items, minCount = 5 }: {
		items: DiscogsCollectionItem[];
		minCount?: number;
	} = $props();

	interface LoyalArtist {
		name: string;
		count: number;
		covers: string[];
	}

	// Artists to exclude (compilations, etc.). Declared before the $derived below
	// so it isn't in the temporal dead zone when calculateLoyalty runs during SSR.
	const excludedArtists = new Set([
		'various',
		'various artists',
		'va',
		'unknown',
		'unknown artist'
	]);

	let loyalArtists = $derived(calculateLoyalty(items));

	function calculateLoyalty(items: DiscogsCollectionItem[]): LoyalArtist[] {
		const artistMap = new Map<string, { count: number; covers: string[] }>();

		for (const item of items) {
			for (const artist of item.basic_information.artists) {
				const name = cleanArtistName(artist.name);

				// Skip excluded artists
				if (excludedArtists.has(name.toLowerCase())) continue;

				const existing = artistMap.get(name) || { count: 0, covers: [] };
				existing.count++;
				if (existing.covers.length < 5 && item.basic_information.thumb) {
					existing.covers.push(item.basic_information.thumb);
				}
				artistMap.set(name, existing);
			}
		}

		return Array.from(artistMap.entries())
			.filter(([, data]) => data.count >= minCount)
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 8)
			.map(([name, data]) => ({
				name,
				count: data.count,
				covers: data.covers
			}));
	}

	function getLoyaltyLabel(count: number): string {
		if (count >= 20) return 'Superfan';
		if (count >= 10) return 'Devoted';
		if (count >= 5) return 'Loyal';
		return '';
	}

</script>

{#if loyalArtists.length > 0}
	<div class="artist-loyalty rows">
		{#each loyalArtists as artist}
			{@const coverCount = Math.min(artist.covers.length, 4)}
			<div class="loyal-artist">
				<div class="artist-covers" style:width="{36 + (coverCount - 1) * 24}px">
					{#each artist.covers.slice(0, 4) as cover, i}
						<img
							src={cover}
							alt=""
							class="cover-thumb"
							style:z-index={4 - i}
							style:left="{i * 24}px"
						/>
					{/each}
				</div>
				<div class="artist-info">
					<span class="artist-name">{artist.name}</span>
					<span class="artist-count">{artist.count} releases</span>
				</div>
				<span class="loyalty-badge">
					{getLoyaltyLabel(artist.count)}
				</span>
			</div>
		{/each}
	</div>
{:else}
	<p class="no-data">No artists with {minCount}+ releases yet. Keep collecting!</p>
{/if}

<style>
	/* A row per artist: a strip of their covers, name and count, and the word. */
	.loyal-artist {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 60px;
		padding: 8px 0;
	}

	.artist-covers {
		position: relative;
		flex-shrink: 0;
		height: 36px;
	}

	.cover-thumb {
		position: absolute;
		top: 0;
		width: 36px;
		height: 36px;
		object-fit: cover;
		border: 2px solid var(--ground);
		background: var(--track);
	}

	.artist-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.artist-name {
		font-weight: 600;
		font-size: 17px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.artist-count {
		font-size: 15px;
		color: var(--muted);
	}

	.loyalty-badge {
		font-size: 15px;
		font-weight: 700;
		flex-shrink: 0;
	}

	.no-data {
		color: var(--muted);
		margin: 0;
	}
</style>
