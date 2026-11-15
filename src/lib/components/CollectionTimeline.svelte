<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import LazyImage from '$lib/components/LazyImage.svelte';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	interface MonthGroup {
		key: string;
		label: string;
		/** How many records arrived that month. */
		count: number;
		/** The first twelve of them, newest first. */
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
				count: groupItems.length,
				items: groupItems.slice(0, 12)
			});
		}

		return groups.slice(0, 24);
	}
</script>

{#if months.length > 0}
	<!-- A box of its own that scrolls sideways; it takes keyboard focus so the
	     arrow keys can scroll it. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="timeline" role="region" aria-label="Records added month by month" tabindex="0">
		<div class="months">
			{#each months as month (month.key)}
				<div class="month-group">
					<div class="month-label">{month.label}</div>
					<div class="month-count">{month.count.toLocaleString()} added</div>
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
	</div>
{/if}

<style>
	/* A column per month, newest first: its name, how many arrived, then up to
	   twelve covers three to a row. The columns scroll sideways inside the box. */
	.timeline {
		overflow-x: auto;
		/* Room for the focus outline of the covers along the edges. */
		padding: 4px;
		margin: -4px;
	}

	.months {
		display: flex;
		gap: 32px;
	}

	/* A few months share out the width; many keep 150px each and scroll. */
	.month-group {
		flex: 1 0 150px;
		max-width: 220px;
		min-width: 0;
	}

	.month-label {
		font-size: 17px;
		font-weight: 600;
		line-height: 1.2;
	}

	.month-count {
		margin-top: 6px;
		font-size: 15px;
		color: var(--muted);
	}

	.covers {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
		margin-top: 12px;
	}

	.cover-link {
		display: block;
		aspect-ratio: 1;
		background: var(--track);
	}

	.cover-link :global(.lazy-image),
	.cover-link :global(img) {
		width: 100%;
		height: 100%;
	}

	.cover-link :global(img) {
		object-fit: cover;
	}

	/* On a phone part of a third month shows, so the box is seen to scroll. */
	@media (max-width: 699px) {
		.months {
			gap: 24px;
		}

		.month-group {
			flex-basis: 136px;
		}
	}
</style>
