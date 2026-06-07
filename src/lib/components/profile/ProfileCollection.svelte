<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import { reveal } from '$lib/actions/reveal';
	import CollectionBrowser from '$lib/components/CollectionBrowser.svelte';
	import CollectionQuiz from '$lib/components/CollectionQuiz.svelte';
	import Milestones from '$lib/components/Milestones.svelte';
	import RatingsOverview from '$lib/components/RatingsOverview.svelte';
	import TimelineChart from '$lib/components/TimelineChart.svelte';
	import CollectionTimeline from '$lib/components/CollectionTimeline.svelte';

	let { items, stats }: {
		items: DiscogsCollectionItem[];
		stats: CollectionStats;
	} = $props();
</script>

<section id="collection" class="card" use:reveal>
	<h2>Full Collection</h2>
	<p class="section-subtitle">Browse, search, and filter the entire collection</p>
	<CollectionBrowser items={items} />
</section>

<div class="grid-2col" use:reveal>
	<section class="card">
		<h2>Collection Quiz</h2>
		<CollectionQuiz items={items} />
	</section>

	<section class="card">
		<h2>Milestones</h2>
		<Milestones items={items} />
	</section>
</div>

{#if stats.ratedCount > 0}
	<section class="card" use:reveal>
		<h2>Ratings</h2>
		<RatingsOverview {stats} />
	</section>
{/if}

{#if stats.addedByMonth.length > 1}
	<section class="card" use:reveal>
		<h2>Collection Growth</h2>
		<TimelineChart data={stats.addedByMonth} />
	</section>
{/if}

<section class="card" use:reveal>
	<h2>Collection Timeline</h2>
	<p class="section-subtitle">Additions month by month</p>
	<CollectionTimeline items={items} />
</section>
