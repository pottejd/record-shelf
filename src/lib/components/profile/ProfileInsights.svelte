<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import type { AlbumGroup } from '$lib/utils/albums';
	import { reveal } from '$lib/actions/reveal';
	import DuplicateDetector from '$lib/components/DuplicateDetector.svelte';
	import FormatUpgrades from '$lib/components/FormatUpgrades.svelte';

	let { duplicates, formatUpgrades, onSelect }: {
		duplicates: AlbumGroup[];
		formatUpgrades: AlbumGroup[];
		onSelect: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();
</script>

{#if duplicates.length > 0}
	<section class="card" use:reveal>
		<h2>Duplicates &amp; Variants</h2>
		<p class="section-subtitle">Albums you own more than one copy or pressing of</p>
		<DuplicateDetector groups={duplicates} onSelect={onSelect} />
	</section>
{/if}

{#if formatUpgrades.length > 0}
	<section class="card" use:reveal>
		<h2>Vinyl Upgrade Picks</h2>
		<p class="section-subtitle">Owned on CD or cassette but not vinyl</p>
		<FormatUpgrades groups={formatUpgrades} onSelect={onSelect} />
	</section>
{/if}
