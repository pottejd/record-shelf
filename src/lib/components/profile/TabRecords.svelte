<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import type { AlbumGroup } from '$lib/utils/albums';
	import CollectionBrowser from '$lib/components/CollectionBrowser.svelte';
	import DuplicateDetector from '$lib/components/DuplicateDetector.svelte';
	import FormatUpgrades from '$lib/components/FormatUpgrades.svelte';

	let { items, duplicates, formatUpgrades, onSelect }: {
		items: DiscogsCollectionItem[];
		duplicates: AlbumGroup[];
		formatUpgrades: AlbumGroup[];
		onSelect: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();
</script>

<section class="section">
	<h2>All records</h2>
	<CollectionBrowser {items} />
</section>

{#if duplicates.length > 0 || formatUpgrades.length > 0}
	<div class="cols">
		{#if duplicates.length > 0}
			<section class="section col-half">
				<h2>Duplicates and variants</h2>
				<p class="section-subtitle">Albums you own more than one copy or pressing of</p>
				<DuplicateDetector groups={duplicates} {onSelect} />
			</section>
		{/if}

		{#if formatUpgrades.length > 0}
			<section class="section col-half">
				<h2>Vinyl upgrade picks</h2>
				<p class="section-subtitle">Owned on CD or cassette but not vinyl</p>
				<FormatUpgrades groups={formatUpgrades} {onSelect} />
			</section>
		{/if}
	</div>
{/if}
