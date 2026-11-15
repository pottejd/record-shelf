<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import CollectingCalendar from '$lib/components/CollectingCalendar.svelte';
	import TimelineChart from '$lib/components/TimelineChart.svelte';
	import NewVsVintage from '$lib/components/NewVsVintage.svelte';
	import GenreEvolution from '$lib/components/GenreEvolution.svelte';
	import CollectingActivity from '$lib/components/CollectingActivity.svelte';
	import DayPatterns from '$lib/components/DayPatterns.svelte';
	import Milestones from '$lib/components/Milestones.svelte';
	import CollectionTimeline from '$lib/components/CollectionTimeline.svelte';

	let { items, stats }: {
		items: DiscogsCollectionItem[];
		stats: CollectionStats;
	} = $props();
</script>

<!-- The calendar across the top, then two columns, then the timeline across the
     foot. On a phone the left column comes first, then the right. -->
<section class="section">
	<CollectingCalendar {items}>
		<h2>Collecting calendar</h2>
	</CollectingCalendar>
</section>

<div class="cols activity">
	<div class="col-half stack">
		{#if stats.addedByMonth.length > 1}
			<section class="section">
				<h2>Collection growth</h2>
				<p class="intro wide">Records added each month.</p>
				<TimelineChart data={stats.addedByMonth} />
			</section>
		{/if}

		<section class="section">
			<h2>New vs vintage</h2>
			<p class="intro">New releases or digging for classics?</p>
			<NewVsVintage {items} />
		</section>

		<section class="section">
			<h2>Genre evolution</h2>
			<p class="intro">The top genres among the records you added each year.</p>
			<GenreEvolution {items} />
		</section>
	</div>

	<div class="col-half stack">
		<section class="section">
			<h2>Collecting activity</h2>
			<CollectingActivity {items} />
		</section>

		<section class="section">
			<h2>Day patterns</h2>
			<DayPatterns {items} />
		</section>

		<section class="section">
			<h2>Milestones</h2>
			<Milestones {items} />
		</section>
	</div>
</div>

<section class="section timeline">
	<h2>Collection timeline</h2>
	<p class="intro wide">What arrived, month by month.</p>
	<CollectionTimeline {items} />
</section>

<style>
	/* As drawn: a heading sits 8px over what follows; a line of introduction
	   sits 8px over rows and 16px over a chart. */
	.activity h2,
	.timeline h2 {
		margin-bottom: 8px;
	}

	.intro {
		margin: 0 0 8px;
		font-size: 17px;
		color: var(--muted);
	}

	.intro.wide {
		margin-bottom: 16px;
	}
</style>
