<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import type { ChartDatum } from '$lib/utils/chart';
	import BarChart from '$lib/components/BarChart.svelte';
	import RatingsOverview from '$lib/components/RatingsOverview.svelte';
	import ArtistLoyalty from '$lib/components/ArtistLoyalty.svelte';
	import FormatBreakdown from '$lib/components/FormatBreakdown.svelte';
	import TopList from '$lib/components/TopList.svelte';
	import YearHeatmap from '$lib/components/YearHeatmap.svelte';
	import OldestNewestHighlights from '$lib/components/profile/OldestNewestHighlights.svelte';
	import CollectionDNA from '$lib/components/CollectionDNA.svelte';

	let {
		items,
		stats,
		genreData,
		formatData,
		styleData,
		onGenre,
		onStyle,
		onYear,
		onLabelClick,
		openDrawer
	}: {
		items: DiscogsCollectionItem[];
		stats: CollectionStats;
		genreData: ChartDatum[];
		formatData: ChartDatum[];
		styleData: ChartDatum[];
		onGenre: (genre: string) => void;
		onStyle: (style: string) => void;
		onYear: (year: number) => void;
		onLabelClick: (name: string) => void;
		openDrawer: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();
</script>

<div class="cols">
	<div class="col-half stack">
		<section class="section">
			<h2>By genre</h2>
			<BarChart data={genreData} horizontal clickable onItemClick={onGenre} />
		</section>

		<section class="section">
			<h2>Top styles</h2>
			<BarChart data={styleData} horizontal clickable onItemClick={onStyle} />
		</section>

		{#if stats.ratedCount > 0}
			<section class="section">
				<h2>Ratings</h2>
				<RatingsOverview {stats} />
			</section>
		{/if}

		<section class="section">
			<h2>Artist loyalty</h2>
			<p class="section-subtitle">Artists that keep showing up</p>
			<ArtistLoyalty {items} />
		</section>
	</div>

	<div class="col-half stack">
		<section class="section">
			<h2>By format</h2>
			<FormatBreakdown {items} {formatData} onFilter={openDrawer} />
		</section>

		<section class="section">
			<h2>Top labels</h2>
			<TopList items={stats.topLabels} clickable onItemClick={onLabelClick} />
		</section>

		<section class="section">
			<h2>Release years</h2>
			<YearHeatmap data={stats.yearBreakdown} onYearClick={onYear} />
			{#if stats.oldestRelease || stats.newestRelease}
				<div class="release-ends">
					<OldestNewestHighlights {stats} />
				</div>
			{/if}
		</section>

		<section class="section">
			<h2>Collection DNA</h2>
			<CollectionDNA {stats} />
		</section>
	</div>
</div>

<style>
	/* "Oldest release" and "Newest release" side by side under the year grid. */
	.release-ends {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 32px;
		margin-top: 24px;
	}

	.release-ends > :global(*) {
		flex: 1 1 200px;
		min-width: 0;
	}
</style>
