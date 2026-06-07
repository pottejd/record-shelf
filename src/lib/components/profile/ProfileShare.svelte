<script lang="ts">
	import type { DiscogsCollectionItem, CollectionStats } from '$lib/types/discogs';
	import { reveal } from '$lib/actions/reveal';
	import ShareableCard from '$lib/components/ShareableCard.svelte';
	import ValueEstimate from '$lib/components/ValueEstimate.svelte';
	import CollectionExport from '$lib/components/CollectionExport.svelte';
	import Recommendations from '$lib/components/Recommendations.svelte';

	let { stats, items, badges, username }: {
		stats: CollectionStats;
		items: DiscogsCollectionItem[];
		badges: Array<{ label: string; style: string }>;
		username: string;
	} = $props();
</script>

<section id="share" class="card">
	<h2>Share Stats</h2>
	<ShareableCard {username} {stats} {badges} />
</section>

<section class="card" use:reveal>
	<h2>Collection Value</h2>
	<ValueEstimate items={items} {username} />
</section>

<section class="card" use:reveal>
	<h2>Export Collection</h2>
	<p class="section-subtitle">Download collection data</p>
	<CollectionExport items={items} {username} />
</section>

<section class="card" use:reveal>
	<h2>Explore More</h2>
	<p class="section-subtitle">Recommendations based on this collection</p>
	<Recommendations {stats} />
</section>
