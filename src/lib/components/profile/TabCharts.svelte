<script lang="ts">
	import { NO_COVER, showNoCover } from '$lib/utils/cover';
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import type { ChartDatum } from '$lib/utils/chart';
	import BarChart from '$lib/components/BarChart.svelte';
	import RatingsOverview from '$lib/components/RatingsOverview.svelte';
	import ArtistLoyalty from '$lib/components/ArtistLoyalty.svelte';
	import FormatBreakdown from '$lib/components/FormatBreakdown.svelte';
	import TopList from '$lib/components/TopList.svelte';
	import YearHeatmap from '$lib/components/YearHeatmap.svelte';
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

	let releaseEnds = $derived(
		[
			{ label: 'Oldest release', release: stats.oldestRelease },
			{ label: 'Newest release', release: stats.newestRelease }
		].filter((end) => end.release)
	);
</script>

<!-- Two columns; on a phone the left one comes first, then the right. -->
<div class="cols charts">
	<div class="col-half stack">
		<section class="section">
			<h2>By genre</h2>
			<div class="genre-rows">
				<BarChart data={genreData} horizontal clickable onItemClick={onGenre} />
			</div>
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
			<p class="intro">
				Artists you own five or more records by. Loyal is 5 or more, Devoted is 10, Superfan is 20.
			</p>
			<ArtistLoyalty {items} />
		</section>
	</div>

	<div class="col-half stack">
		<section class="section format">
			<h2>By format</h2>
			<FormatBreakdown {items} {formatData} onFilter={openDrawer} />
		</section>

		<section class="section">
			<h2>Top labels</h2>
			<TopList items={stats.topLabels} clickable onItemClick={onLabelClick} />
		</section>

		<section class="section years">
			<h2>Release years</h2>
			<YearHeatmap data={stats.yearBreakdown} onYearClick={onYear} />
			{#if releaseEnds.length > 0}
				<div class="release-ends">
					{#each releaseEnds as end (end.label)}
						<div class="release-end">
							<img src={end.release?.thumb || NO_COVER} alt="" class="end-cover cover" onerror={showNoCover} />
							<div class="end-text">
								<span class="small">{end.label}</span>
								<span class="end-title">{end.release?.title}</span>
								<span class="small">{end.release?.year}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="section">
			<h2>Collection DNA</h2>
			<p class="intro">Four traits worked out from the whole collection.</p>
			<CollectionDNA {stats} />
		</section>
	</div>
</div>

<style>
	/* As drawn: every heading sits 8px over what follows; the split bar and the
	   year grid stand a further 16px down. */
	.charts h2 {
		margin-bottom: 8px;
	}

	.format h2,
	.years h2 {
		margin-bottom: 24px;
	}

	.intro {
		margin: 0 0 8px;
		font-size: 17px;
		color: var(--muted);
	}

	/* By genre has eight rows, a little taller than the twelve of Top styles. */
	.genre-rows :global(.bar-container) {
		min-height: 40px;
	}

	/* "Oldest release" and "Newest release" side by side under the year grid. */
	.release-ends {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 32px;
		margin-top: 24px;
	}

	.release-end {
		flex: 1 1 200px;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.end-cover {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		background: var(--track);
	}

	.end-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.end-title {
		font-size: 17px;
		font-weight: 600;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
</style>
