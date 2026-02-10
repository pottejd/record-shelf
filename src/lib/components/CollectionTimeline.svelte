<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
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
					{#each month.items as item}
						{@const info = item.basic_information}
						<a
							href="https://www.discogs.com/release/{info.id}"
							target="_blank"
							rel="noopener"
							class="cover-link"
							title="{info.artists.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ')} – {info.title}"
						>
							<LazyImage
								src={info.cover_image || info.thumb || '/placeholder.svg'}
								alt={info.title}
							/>
						</a>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.timeline {
		display: flex;
		gap: 1.5rem;
		overflow-x: auto;
		padding-bottom: 0.75rem;
		scroll-snap-type: x mandatory;
		scrollbar-width: thin;
	}

	.month-group {
		flex-shrink: 0;
		scroll-snap-align: start;
		min-width: 160px;
	}

	.month-label {
		font-size: 0.8125rem;
		font-weight: 600;
		margin-bottom: 0.125rem;
	}

	.month-count {
		font-size: 0.6875rem;
		color: var(--color-text-tertiary);
		margin-bottom: 0.5rem;
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
		border-radius: 4px;
		overflow: hidden;
		transition: transform 0.15s;
	}

	.cover-link:hover {
		transform: scale(1.1);
		z-index: 1;
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
