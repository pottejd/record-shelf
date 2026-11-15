<script lang="ts">
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

<div class="random-picker">
	{#if picked}
		<div class="picker-display" class:spinning={isSpinning}>
			<a
				href="https://www.discogs.com/release/{picked.basic_information.id}"
				target="_blank"
				rel="noopener noreferrer"
				class="picked-record"
			>
				<img
					src={picked.basic_information.cover_image || picked.basic_information.thumb || '/placeholder.svg'}
					alt=""
					class="picked-cover cover"
				/>
			</a>
		</div>
		<div class="picked-info">
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
			<a
				href="https://www.discogs.com/release/{picked.basic_information.id}"
				target="_blank"
				rel="noopener noreferrer"
				class="view-link"
			>
				View on Discogs
			</a>
		</div>
	{:else}
		<div class="picker-display empty" class:spinning={isSpinning}>
			<div class="picker-placeholder">
				<svg aria-hidden="true" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.3"/>
					<circle cx="24" cy="24" r="14" stroke="currentColor" stroke-width="1.5" opacity="0.2"/>
					<circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.3"/>
				</svg>
				<p>Spin to discover something from the collection</p>
			</div>
		</div>
	{/if}

	<button class="spin-btn btn btn-primary" onclick={pickRandom} disabled={isSpinning || items.length === 0}>
		{#if isSpinning}
			<span class="spin-icon">
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M23 4v6h-6M1 20v-6h6" />
					<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
				</svg>
			</span>
			Spinning...
		{:else}
			<span class="spin-icon">
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M23 4v6h-6M1 20v-6h6" />
					<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
				</svg>
			</span>
			Pick Random Record
		{/if}
	</button>
</div>

<style>
	.random-picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.picker-display {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.picker-display.empty {
		width: 100%;
		min-height: 180px;
	}

	.picker-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 32px 0;
		color: var(--muted);
	}

	.picker-placeholder svg {
		width: 64px;
		height: 64px;
	}

	.picker-placeholder p {
		margin: 0;
		font-size: 17px;
		text-align: center;
	}

	.picked-record {
		display: block;
		text-decoration: none;
	}

	.picked-cover {
		width: 200px;
		height: 200px;
		background: var(--track);
	}

	.picked-info {
		text-align: center;
		margin-top: 8px;
	}

	.picked-title {
		margin: 0;
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.picked-artist {
		margin: 8px 0 0;
		font-size: 18px;
		color: var(--muted);
	}

	.picked-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 16px;
		margin-top: 12px;
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

	.view-link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		margin-top: 4px;
		font-size: 17px;
		font-weight: 600;
	}

	.spin-icon {
		display: flex;
		width: 20px;
		height: 20px;
	}

	.spin-icon svg {
		width: 100%;
		height: 100%;
	}
</style>
