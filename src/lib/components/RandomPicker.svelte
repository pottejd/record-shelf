<script lang="ts">
	import { NO_COVER, showNoCover } from '$lib/utils/cover';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	let picked: DiscogsCollectionItem | null = $state(null);
	let isSpinning = $state(false);
	let spinCount = $state(0);

	// Track the pending spin timer so a teardown mid-spin doesn't keep firing and
	// mutating state after the component is gone.
	let spinTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(spinTimer));

	function pickRandom() {
		if (items.length === 0 || isSpinning) return;

		isSpinning = true;
		spinCount = 0;
		const totalSpins = 15 + Math.floor(Math.random() * 10);

		function spin() {
			picked = items[Math.floor(Math.random() * items.length)];
			spinCount++;
			if (spinCount >= totalSpins) {
				isSpinning = false;
			} else {
				spinTimer = setTimeout(spin, 80 + spinCount * 8);
			}
		}
		spin();
	}

	function getArtistNames(item: DiscogsCollectionItem): string {
		return formatArtists(item.basic_information.artists);
	}

	function getFormat(item: DiscogsCollectionItem): string | null {
		const format = item.basic_information.formats?.[0];
		if (!format) return null;
		const desc = format.descriptions?.join(', ') || '';
		return desc ? `${format.name} (${desc})` : format.name;
	}

	function getLabel(item: DiscogsCollectionItem): string | null {
		return item.basic_information.labels?.[0]?.name || null;
	}

	function getGenre(item: DiscogsCollectionItem): string | null {
		return item.basic_information.genres?.[0] || null;
	}
</script>

<!-- As drawn: a large cover, and beside it (under it on a phone) the title, the
     artist, a line of facts, then the button and the Discogs link. Before the
     first pick an empty square holds the cover's place. -->
<div class="random-picker">
	{#if picked}
		<!-- The same address as "View on Discogs", so the cover is not a second tab stop. -->
		<a
			href="https://www.discogs.com/release/{picked.basic_information.id}"
			target="_blank"
			rel="noopener noreferrer"
			class="picked-record"
			tabindex="-1"
			aria-hidden="true"
		>
			<img
				src={picked.basic_information.cover_image || picked.basic_information.thumb || NO_COVER}
				alt=""
				class="picked-cover cover"
				onerror={showNoCover}
			/>
		</a>
	{:else}
		<div class="picked-cover empty" aria-hidden="true"></div>
	{/if}

	<div class="picked-info">
		{#if picked}
			<p class="picked-title">{picked.basic_information.title}</p>
			<p class="picked-artist">{getArtistNames(picked)}</p>
			<div class="picked-meta">
				{#if picked.basic_information.year}
					<span class="meta-item year">{picked.basic_information.year}</span>
				{/if}
				{#if getGenre(picked)}
					<span class="meta-item">{getGenre(picked)}</span>
				{/if}
				{#if getFormat(picked)}
					<span class="meta-item">{getFormat(picked)}</span>
				{/if}
			</div>
			{#if getLabel(picked)}
				<p class="picked-label">{getLabel(picked)}</p>
			{/if}
		{:else}
			<p class="picker-prompt">Spin to discover something from the collection</p>
		{/if}

		<div class="picker-actions">
			<button class="btn btn-primary" onclick={pickRandom} disabled={isSpinning || items.length === 0}>
				{#if isSpinning}
					Spinning…
				{:else if picked}
					Pick another record
				{:else}
					Pick random record
				{/if}
			</button>
			{#if picked}
				<a
					href="https://www.discogs.com/release/{picked.basic_information.id}"
					target="_blank"
					rel="noopener noreferrer"
					class="view-link"
				>
					View on Discogs
				</a>
			{/if}
		</div>
	</div>
</div>

<style>
	.random-picker {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 24px 32px;
	}

	.picked-record {
		display: block;
		flex-shrink: 0;
		width: 240px;
		max-width: 100%;
		text-decoration: none;
	}

	.picked-cover {
		width: 240px;
		max-width: 100%;
		background: var(--track);
	}

	.picked-cover.empty {
		flex-shrink: 0;
		aspect-ratio: 1;
		outline: 1px solid var(--cover-edge);
		outline-offset: -1px;
	}

	.picked-info {
		flex: 1 1 240px;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.picked-title {
		margin: 0;
		font-size: 30px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.picked-artist {
		margin: 8px 0 0;
		font-size: 20px;
		color: var(--muted);
	}

	.picked-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin-top: 16px;
	}

	.meta-item {
		font-size: 15px;
		color: var(--muted);
	}

	.meta-item.year {
		color: var(--ink);
		font-weight: 600;
	}

	.picked-label {
		margin: 4px 0 0;
		font-size: 15px;
		color: var(--muted);
	}

	.picker-prompt {
		margin: 0;
		font-size: 20px;
		color: var(--muted);
	}

	.picker-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 24px;
		margin-top: 24px;
	}

	.view-link {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch);
		font-size: 17px;
		font-weight: 600;
	}

	@media (max-width: 699px) {
		.picked-title {
			font-size: 26px;
		}
	}
</style>
