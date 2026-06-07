<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import { reveal } from '$lib/actions/reveal';
	import StatCard from '$lib/components/StatCard.svelte';
	import RecentlyAdded from '$lib/components/RecentlyAdded.svelte';
	import RandomPicker from '$lib/components/RandomPicker.svelte';
	import TopList from '$lib/components/TopList.svelte';
	import CoverGrid from '$lib/components/CoverGrid.svelte';
	import CollectionDNA from '$lib/components/CollectionDNA.svelte';

	let { stats, items, randomHighlights, onArtistClick, onLabelClick }: {
		stats: CollectionStats;
		items: DiscogsCollectionItem[];
		randomHighlights: DiscogsCollectionItem[];
		onArtistClick: (name: string) => void;
		onLabelClick: (name: string) => void;
	} = $props();
</script>

<section id="overview" class="stats-overview">
	<StatCard label="Records" value={stats.totalItems} />
	<StatCard label="Artists" value={stats.totalArtists} />
	<StatCard label="Labels" value={stats.totalLabels} />
	<StatCard label="Avg. Year" value={stats.averageYear ? String(stats.averageYear) : '—'} />
	<StatCard label="Year Span" value={stats.collectionSpan ? `${stats.collectionSpan} yrs` : '—'} />
	<StatCard label="Top Genre" value={stats.dominantGenre || '—'} />
</section>

<div class="grid-2col" use:reveal>
	<section class="card">
		<h2>Recently Added</h2>
		<RecentlyAdded items={stats.recentlyAdded} />
	</section>

	<section class="card">
		<h2>What Should I Listen To?</h2>
		<RandomPicker items={items} />
	</section>
</div>

<div id="top-lists" class="grid-2col" use:reveal>
	<section class="card">
		<h2>Top Artists</h2>
		<TopList items={stats.topArtists} clickable onItemClick={onArtistClick} />
	</section>

	<section class="card">
		<h2>Top Labels</h2>
		<TopList items={stats.topLabels} clickable onItemClick={onLabelClick} />
	</section>
</div>

<div class="grid-2col" use:reveal>
	<section class="card">
		<h2>Collection Highlights</h2>
		<p class="section-subtitle">A random selection from the collection</p>
		<CoverGrid items={randomHighlights} />
	</section>

	<section class="card">
		<h2>Collection DNA</h2>
		<CollectionDNA {stats} />
	</section>
</div>
