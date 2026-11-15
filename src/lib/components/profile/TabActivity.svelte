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

<section class="section">
	<h2>Collecting calendar</h2>
	<p class="section-subtitle">Activity over the past year</p>
	<CollectingCalendar {items} />
</section>

<div class="cols">
	<div class="col-half stack">
		{#if stats.addedByMonth.length > 1}
			<section class="section">
				<h2>Collection growth</h2>
				<TimelineChart data={stats.addedByMonth} />
			</section>
		{/if}

		<section class="section">
			<h2>New vs vintage</h2>
			<p class="section-subtitle">New releases or digging for classics?</p>
			<NewVsVintage {items} />
		</section>

		<section class="section">
			<h2>Genre evolution</h2>
			<p class="section-subtitle">How taste has evolved over time</p>
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

<section class="section">
	<h2>Collection timeline</h2>
	<p class="section-subtitle">Additions month by month</p>
	<CollectionTimeline {items} />
</section>
