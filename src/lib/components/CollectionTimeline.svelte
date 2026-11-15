<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import LazyImage from '$lib/components/LazyImage.svelte';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	interface MonthGroup {
		key: string;
		label: string;
		items: DiscogsCollectionItem[];
	}

	let months = $derived(groupByMonth(items));

	function groupByMonth(all: DiscogsCollectionItem[]): MonthGroup[] {
		const sorted = [...all].sort(
			(a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()
		);

		const map = new Map<string, DiscogsCollectionItem[]>();
		for (const item of sorted) {
			const d = new Date(item.date_added);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(item);
		}

		const groups: MonthGroup[] = [];
		for (const [key, groupItems] of map) {
			const [year, month] = key.split('-');
			const date = new Date(parseInt(year), parseInt(month) - 1);
			groups.push({
				key,
				label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
				items: groupItems.slice(0, 12)
			});
		}

		return groups.slice(0, 24);
	}
</script>

{#if months.length > 0}
	<div class="timeline">
		{#each months as month}
			<div class="month-group">
				<div class="month-label">{month.label}</div>
				<div class="month-count">{month.items.length} added</div>
				<div class="covers">
					{#each month.items as item (item.instance_id)}
						{@const info = item.basic_information}
						<a
							href="https://www.discogs.com/release/{info.id}"
							target="_blank"
							rel="noopener noreferrer"
							class="cover-link"
							title="{formatArtists(info.artists)} – {info.title}"
						>
							<LazyImage
								src={info.cover_image || info.thumb || '/placeholder.svg'}
								alt={info.title}
								class="cover"
							/>
						</a>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* A column per month: its name, how many arrived, then the covers. */
	.timeline {
		display: flex;
		gap: 32px;
		overflow-x: auto;
		padding-bottom: 12px;
		scroll-snap-type: x mandatory;
		scrollbar-width: thin;
	}

	.month-group {
		flex-shrink: 0;
		scroll-snap-align: start;
		min-width: 160px;
	}

	.month-label {
		font-size: 17px;
		font-weight: 600;
	}

	.month-count {
		margin: 2px 0 12px;
		font-size: 15px;
		color: var(--muted);
	}

	.covers {
		display: grid;
		grid-template-columns: repeat(3, 48px);
		gap: 4px;
	}

	.cover-link {
		display: block;
		width: 48px;
		height: 48px;
		overflow: hidden;
		background: var(--track);
	}


	.cover-link :global(.lazy-image) {
		width: 48px;
		height: 48px;
	}

	.cover-link :global(img) {
		width: 48px;
		height: 48px;
		object-fit: cover;
	}
</style>
