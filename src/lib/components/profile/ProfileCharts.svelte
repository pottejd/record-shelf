<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import type { ChartDatum } from '$lib/utils/chart';
	import { reveal } from '$lib/actions/reveal';
	import BarChart from '$lib/components/BarChart.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import YearHeatmap from '$lib/components/YearHeatmap.svelte';
	import ArtistLoyalty from '$lib/components/ArtistLoyalty.svelte';
	import FormatDrilldown from '$lib/components/FormatDrilldown.svelte';

	let {
		items,
		stats,
		decadeData,
		genreData,
		formatData,
		styleData,
		onDecade,
		onGenre,
		onFormat,
		onStyle,
		onYear,
		openDrawer
	}: {
		items: DiscogsCollectionItem[];
		stats: CollectionStats;
		decadeData: ChartDatum[];
		genreData: ChartDatum[];
		formatData: ChartDatum[];
		styleData: ChartDatum[];
		onDecade: (label: string) => void;
		onGenre: (genre: string) => void;
		onFormat: (format: string) => void;
		onStyle: (style: string) => void;
		onYear: (year: number) => void;
		openDrawer: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();
</script>

<div id="charts" class="grid-2col" use:reveal>
	<section class="card">
		<h2>By Decade</h2>
		<BarChart data={decadeData} colorful clickable onItemClick={onDecade} />
	</section>

	<section class="card">
		<h2>By Genre</h2>
		<DonutChart data={genreData} clickable onItemClick={onGenre} />
	</section>
</div>

<div class="grid-2col" use:reveal>
	<section class="card">
		<h2>Release Years</h2>
		<YearHeatmap data={stats.yearBreakdown} onYearClick={onYear} />
	</section>

	<section class="card">
		<h2>Artist Loyalty</h2>
		<p class="section-subtitle">Artists that keep showing up</p>
		<ArtistLoyalty items={items} />
	</section>
</div>

<div class="grid-2col">
	<section class="card">
		<h2>By Format</h2>
		<DonutChart data={formatData} size={180} thickness={35} clickable onItemClick={onFormat} />
	</section>

	<section class="card">
		<h2>Format Drill-Down</h2>
		<p class="section-subtitle">Expand to see sub-formats</p>
		<FormatDrilldown items={items} onFilter={(title, filtered) => openDrawer(title, filtered)} />
	</section>
</div>

<section class="card">
	<h2>Top Styles</h2>
	<BarChart data={styleData} horizontal colorful clickable onItemClick={onStyle} />
</section>
