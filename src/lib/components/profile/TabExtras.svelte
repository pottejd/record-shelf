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

<!-- As drawn: three rows of two sections side by side. On a phone they stack in
     reading order: the pick, the quiz, Share, Collection value, Explore more, Export. -->
<div class="cols extras">
	<section class="section col-wide">
		<h2 class="lone">What should I listen to?</h2>
		<RandomPicker {items} />
	</section>

	<section class="section col-narrow">
		<h2 class="lone">Collection quiz</h2>
		<CollectionQuiz {items} />
	</section>
</div>

<div class="cols extras">
	<section class="section col-half">
		<h2>Share</h2>
		<p class="section-intro">The headline numbers, as text or as a picture.</p>
		<ShareableCard {username} {stats} {items} {badges} />
	</section>

	<section class="section col-half">
		<h2>Collection value</h2>
		<p class="section-intro">A rough estimate from Discogs marketplace prices. It samples up to 20 records and scales up.</p>
		<ValueEstimate {items} {username} />
	</section>
</div>

<div class="cols extras">
	<section class="section col-wide">
		<h2>Explore more</h2>
		<p class="section-intro rows-follow">Searches on Discogs built from your top styles, artists and labels.</p>
		<Recommendations {stats} />
	</section>

	<section class="section col-narrow">
		<h2>Export</h2>
		<p class="section-intro">Download the whole collection.</p>
		<CollectionExport {items} {username} />
	</section>
</div>

<style>
	/* As drawn: a heading sits 8px over its line of introduction, which sits 16px
	   over what follows (4px over rows); a heading with no introduction sits 24px
	   over its content. */
	.extras h2 {
		margin-bottom: 8px;
	}

	.extras h2.lone {
		margin-bottom: 24px;
	}

	.extras .section-intro {
		margin-bottom: 16px;
	}

	.extras .section-intro.rows-follow {
		margin-bottom: 4px;
	}
</style>
