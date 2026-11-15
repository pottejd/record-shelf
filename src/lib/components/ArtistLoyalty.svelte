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

	/** The longest strip of covers; a phone shows the first four. */
	const MAX_COVERS = 6;

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
				if (existing.covers.length < MAX_COVERS && item.basic_information.thumb) {
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
	<ul class="artist-loyalty">
		{#each loyalArtists as artist}
			<li class="loyal-artist">
				<span class="artist-info">
					<span class="artist-name">{artist.name}</span>
					<span class="artist-count">{artist.count} releases</span>
				</span>
				<span class="strip" aria-hidden="true">
					{#each artist.covers as cover}
						<img src={cover} alt="" class="strip-cover cover" loading="lazy" />
					{/each}
				</span>
				<span class="loyalty-word">{getLoyaltyLabel(artist.count)}</span>
			</li>
		{/each}
	</ul>
{:else}
	<p class="no-data">No artists with {minCount}+ releases yet. Keep collecting!</p>
{/if}

<style>
	/* A row per artist, 60px high under a hairline: name and count, a strip of
	   their covers, and the Loyal / Devoted / Superfan word in ink. */
	.artist-loyalty {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.loyal-artist {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 60px;
		padding: 6px 0;
		border-bottom: 1px solid var(--hairline);
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

	/* Covers 26px square, 2px apart, as drawn. */
	.strip {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.strip-cover {
		width: 26px;
		height: 26px;
		background: var(--track);
	}

	.loyalty-word {
		width: 72px;
		flex-shrink: 0;
		font-size: 15px;
		font-weight: 700;
		color: var(--ink);
	}

	.no-data {
		color: var(--muted);
		margin: 0;
	}

	@media (max-width: 699px) {
		.loyal-artist {
			gap: 12px;
		}

		.strip-cover:nth-child(n + 5) {
			display: none;
		}
	}
</style>
