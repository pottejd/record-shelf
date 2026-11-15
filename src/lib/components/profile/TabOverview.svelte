<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import type { ChartDatum } from '$lib/utils/chart';
	import type { Badge } from '$lib/utils/badges';
	import StatCard from '$lib/components/StatCard.svelte';
	import RecentlyAdded from '$lib/components/RecentlyAdded.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import TopList from '$lib/components/TopList.svelte';
	import CoverGrid from '$lib/components/CoverGrid.svelte';
	import Shelf from '$lib/components/shelf/Shelf.svelte';

	// `items` is for the sections a later task redraws ("See all").
	let { stats, shelfItems, total, badges, randomHighlights, decadeData, onDecade, onArtistClick, openDrawer }: {
		stats: CollectionStats;
		items: DiscogsCollectionItem[];
		/** What the shelf draws now (held back while a stored copy is still arriving). */
		shelfItems: DiscogsCollectionItem[];
		/** The full count, known from the first reply. */
		total: number;
		badges: Badge[];
		randomHighlights: DiscogsCollectionItem[];
		decadeData: ChartDatum[];
		onDecade: (label: string) => void;
		onArtistClick: (name: string) => void;
		openDrawer: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();
</script>

<div class="hero">
	{#if total > 0}
		<p class="lead">
			{total.toLocaleString()} {total === 1 ? 'record' : 'records'}, one spine each. The oldest pressing sits on the left.
		</p>
	{/if}
	<Shelf items={shelfItems} {total} onOpen={openDrawer} />
</div>

<div class="cols">
	<div class="col-wide stack">
		<section class="section">
			<h2>Just added</h2>
			<RecentlyAdded items={stats.recentlyAdded} />
		</section>

		<section class="section">
			<h2>By decade</h2>
			<BarChart data={decadeData} clickable onItemClick={onDecade} />
		</section>
	</div>

	<div class="col-narrow stack">
		<section class="section">
			<h2>At a glance</h2>
			<div class="stats">
				<StatCard label="Records" value={stats.totalItems} />
				<StatCard label="Artists" value={stats.totalArtists} />
				<StatCard label="Labels" value={stats.totalLabels} />
				<StatCard label="Avg. year" value={stats.averageYear ? String(stats.averageYear) : '—'} />
				<StatCard label="Year span" value={stats.collectionSpan ? `${stats.collectionSpan} yrs` : '—'} />
				<StatCard label="Top genre" value={stats.dominantGenre || '—'} />
			</div>
			{#if badges.length > 0}
				<p class="badges small">{badges.map((b) => b.label).join(', ')}</p>
			{/if}
		</section>

		<section class="section">
			<h2>Top artists</h2>
			<TopList items={stats.topArtists} clickable onItemClick={onArtistClick} />
		</section>
	</div>
</div>

<section class="section">
	<h2>Highlights</h2>
	<p class="section-subtitle">A random selection from the collection</p>
	<CoverGrid items={randomHighlights} />
</section>

<style>
	/* In the approved picture the lead line sits 32px under the tab row, where every
	   other tab's first section sits 48px under it (.tab-body's top margin). */
	.hero {
		margin-top: -16px;
	}

	/* The lead line wraps as in the approved picture; the shelf stands 40px under it. */
	.lead {
		max-width: 44ch;
		margin-bottom: 40px;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 16px;
	}

	.badges {
		margin: 16px 0 0;
	}

	@media (max-width: 699px) {
		.lead {
			margin-bottom: 32px;
		}

		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
