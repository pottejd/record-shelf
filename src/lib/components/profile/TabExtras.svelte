<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import type { Badge } from '$lib/utils/badges';
	import RandomPicker from '$lib/components/RandomPicker.svelte';
	import CollectionQuiz from '$lib/components/CollectionQuiz.svelte';
	import ShareableCard from '$lib/components/ShareableCard.svelte';
	import ValueEstimate from '$lib/components/ValueEstimate.svelte';
	import Recommendations from '$lib/components/Recommendations.svelte';
	import CollectionExport from '$lib/components/CollectionExport.svelte';

	let { items, stats, badges, username }: {
		items: DiscogsCollectionItem[];
		stats: CollectionStats;
		badges: Badge[];
		username: string;
	} = $props();
</script>

<div class="cols">
	<section class="section col-wide">
		<h2>What should I listen to?</h2>
		<RandomPicker {items} />
	</section>

	<section class="section col-narrow">
		<h2>Collection quiz</h2>
		<CollectionQuiz {items} />
	</section>
</div>

<div class="cols">
	<section class="section col-half">
		<h2>Share</h2>
		<ShareableCard {username} {stats} {badges} />
	</section>

	<section class="section col-half">
		<h2>Collection value</h2>
		<ValueEstimate {items} {username} />
	</section>
</div>

<div class="cols">
	<section class="section col-wide">
		<h2>Explore more</h2>
		<p class="section-subtitle">Recommendations based on this collection</p>
		<Recommendations {stats} />
	</section>

	<section class="section col-narrow">
		<h2>Export</h2>
		<p class="section-subtitle">Download collection data</p>
		<CollectionExport {items} {username} />
	</section>
</div>
