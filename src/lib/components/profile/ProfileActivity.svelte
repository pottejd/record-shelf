<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import LazySection from '$lib/components/LazySection.svelte';
	import GenreEvolution from '$lib/components/GenreEvolution.svelte';
	import NewVsVintage from '$lib/components/NewVsVintage.svelte';
	import CollectingCalendar from '$lib/components/CollectingCalendar.svelte';
	import DayPatterns from '$lib/components/DayPatterns.svelte';
	import CollectingActivity from '$lib/components/CollectingActivity.svelte';

	let { items }: { items: DiscogsCollectionItem[] } = $props();
</script>

<LazySection height="300px">
	<div class="grid-2col">
		<section class="card">
			<h2>Genre Evolution</h2>
			<p class="section-subtitle">How taste has evolved over time</p>
			<GenreEvolution items={items} />
		</section>

		<section class="card">
			<h2>New vs Vintage</h2>
			<p class="section-subtitle">New releases or digging for classics?</p>
			<NewVsVintage items={items} />
		</section>
	</div>
</LazySection>

<LazySection height="250px">
	<section id="activity" class="card">
		<h2>Collecting Calendar</h2>
		<p class="section-subtitle">Activity over the past year</p>
		<CollectingCalendar items={items} />
	</section>
</LazySection>

<LazySection height="250px">
	<div class="grid-2col">
		<section class="card">
			<h2>Day Patterns</h2>
			<DayPatterns items={items} />
		</section>

		<section class="card">
			<h2>Collecting Activity</h2>
			<CollectingActivity items={items} />
		</section>
	</div>
</LazySection>
