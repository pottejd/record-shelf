<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	export let items: DiscogsCollectionItem[];
	export let minCount = 5;

	interface LoyalArtist {
		name: string;
		count: number;
		covers: string[];
	}

	$: loyalArtists = calculateLoyalty(items);

	// Artists to exclude (compilations, etc.)
	const excludedArtists = new Set([
		'various',
		'various artists',
		'va',
		'unknown',
		'unknown artist'
	]);

	function calculateLoyalty(items: DiscogsCollectionItem[]): LoyalArtist[] {
		const artistMap = new Map<string, { count: number; covers: string[] }>();

		for (const item of items) {
			for (const artist of item.basic_information.artists) {
				const name = artist.name.replace(/\s*\(\d+\)$/, '');

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

	function getLoyaltyColor(count: number): string {
		if (count >= 20) return '#f59e0b';
		if (count >= 10) return '#8b5cf6';
		return '#6366f1';
	}
</script>

{#if loyalArtists.length > 0}
	<div class="artist-loyalty">
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
				<span class="loyalty-badge" style:background={getLoyaltyColor(artist.count)}>
					{getLoyaltyLabel(artist.count)}
				</span>
			</div>
		{/each}
	</div>
{:else}
	<p class="no-data">No artists with {minCount}+ releases yet. Keep collecting!</p>
{/if}

<style>
	.artist-loyalty {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.loyal-artist {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: 10px;
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.loyal-artist:hover {
		transform: translateX(4px);
		box-shadow: var(--shadow-sm);
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
		border-radius: 4px;
		object-fit: cover;
		border: 2px solid var(--color-bg-secondary);
		background: var(--color-bg-tertiary);
	}

	.artist-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.artist-name {
		font-weight: 600;
		font-size: 0.9375rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.artist-count {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.loyalty-badge {
		padding: 0.25rem 0.625rem;
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: white;
		border-radius: 12px;
		flex-shrink: 0;
	}

	.no-data {
		text-align: center;
		color: var(--color-text-tertiary);
		font-size: 0.875rem;
		padding: 2rem 1rem;
		margin: 0;
	}
</style>
