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

<!-- All records across the full width; under it, duplicates beside upgrade picks (one column on a phone). -->
<section class="section">
	<CollectionBrowser {items} />
</section>

{#if duplicates.length > 0 || formatUpgrades.length > 0}
	<div class="cols">
		{#if duplicates.length > 0}
			<section class="section col-half">
				<h2>Duplicates and variants</h2>
				<p class="note">Albums on the shelf more than once.</p>
				<DuplicateDetector groups={duplicates} {onSelect} />
			</section>
		{/if}

		{#if formatUpgrades.length > 0}
			<section class="section col-half">
				<h2>Vinyl upgrade picks</h2>
				<p class="note">Albums you own on CD or cassette but not on vinyl.</p>
				<FormatUpgrades groups={formatUpgrades} {onSelect} />
			</section>
		{/if}
	</div>
{/if}

<style>
	.col-half h2 {
		margin-bottom: 8px;
	}

	.note {
		margin: 0 0 8px;
		font-size: 17px;
		color: var(--muted);
	}
</style>
