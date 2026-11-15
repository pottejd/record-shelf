<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import type { ChartDatum } from '$lib/utils/chart';
	import type { Badge } from '$lib/utils/badges';
	import { tabHref } from '$lib/profile/tabs';
	import JustAdded from './JustAdded.svelte';
	import AtAGlance from './AtAGlance.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import TopList from '$lib/components/TopList.svelte';
	import CoverGrid from '$lib/components/CoverGrid.svelte';
	import Shelf from '$lib/components/shelf/Shelf.svelte';

	let { stats, items, url, shelfItems, total, badges, randomHighlights, decadeData, onDecade, onArtistClick, openDrawer }: {
		stats: CollectionStats;
		/** Every record so far; "Just added" picks the newest from it. */
		items: DiscogsCollectionItem[];
		/** The page's address, for the link to the Records tab. */
		url: URL;
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
		<section class="section rows-follow">
			<h2>Just added</h2>
			<JustAdded {items} {total} allHref={tabHref(url, 'records')} />
		</section>

		<section class="section chart-follows">
			<h2>By decade</h2>
			<BarChart data={decadeData} clickable onItemClick={onDecade} />
		</section>
	</div>

	<div class="col-narrow stack">
		<section class="section rows-follow">
			<h2>At a glance</h2>
			<AtAGlance {stats} {badges} />
		</section>

		<section class="section rows-follow">
			<h2>Top artists</h2>
			<TopList items={stats.topArtists} bars="spines" clickable onItemClick={onArtistClick} />
		</section>
	</div>
</div>

<section class="section">
	<h2>Highlights</h2>
	<p class="section-subtitle">A random selection from the collection</p>
	<CoverGrid items={randomHighlights} columns={6} />
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

	/* As drawn: a heading sits 8px over rows that bring their own padding, and
	   24px over a chart. */
	.rows-follow h2 {
		margin-bottom: 8px;
	}

	.chart-follows h2 {
		margin-bottom: 24px;
	}

	@media (max-width: 699px) {
		.lead {
			margin-bottom: 32px;
		}
	}
</style>
