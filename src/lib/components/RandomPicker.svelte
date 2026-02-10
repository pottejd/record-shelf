<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	let picked: DiscogsCollectionItem | null = $state(null);
	let isSpinning = $state(false);
	let spinCount = $state(0);

	function pickRandom() {
		if (items.length === 0 || isSpinning) return;

		isSpinning = true;
		spinCount = 0;
		const totalSpins = 15 + Math.floor(Math.random() * 10);
		const spinInterval = setInterval(() => {
			picked = items[Math.floor(Math.random() * items.length)];
			spinCount++;

			if (spinCount >= totalSpins) {
				clearInterval(spinInterval);
				isSpinning = false;
			}
		}, 80 + spinCount * 8);
	}

	function getArtistNames(item: DiscogsCollectionItem): string {
		return item.basic_information.artists.map((a) => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
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
				rel="noopener"
				class="picked-record"
			>
				<img
					src={picked.basic_information.cover_image || picked.basic_information.thumb || '/placeholder.svg'}
					alt=""
					class="picked-cover"
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
				rel="noopener"
				class="view-link"
			>
				View on Discogs
			</a>
		</div>
	{:else}
		<div class="picker-display empty" class:spinning={isSpinning}>
			<div class="picker-placeholder">
				<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.3"/>
					<circle cx="24" cy="24" r="14" stroke="currentColor" stroke-width="1.5" opacity="0.2"/>
					<circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.3"/>
				</svg>
				<p>Spin to discover something from your collection</p>
			</div>
		</div>
	{/if}

	<button class="spin-btn" onclick={pickRandom} disabled={isSpinning || items.length === 0}>
		{#if isSpinning}
			<span class="spin-icon spinning">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M23 4v6h-6M1 20v-6h6" />
					<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
				</svg>
			</span>
			Spinning...
		{:else}
			<span class="spin-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
		gap: 1rem;
	}

	.picker-display {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.1s;
	}

	.picker-display.empty {
		width: 100%;
		min-height: 180px;
		background: var(--color-bg-secondary);
		border-radius: 12px;
	}

	.picker-display.spinning {
		animation: shake 0.1s infinite;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-2px); }
		75% { transform: translateX(2px); }
	}

	.picker-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem;
		color: var(--color-text-tertiary);
	}

	.picker-placeholder svg {
		width: 64px;
		height: 64px;
	}

	.picker-placeholder p {
		margin: 0;
		font-size: 0.875rem;
		text-align: center;
	}

	.picked-record {
		display: block;
		text-decoration: none;
	}

	.picked-cover {
		width: 160px;
		height: 160px;
		border-radius: 10px;
		object-fit: cover;
		background: var(--color-bg-secondary);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.picked-record:hover .picked-cover {
		transform: scale(1.03);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
	}

	.picked-info {
		text-align: center;
		margin-top: 1rem;
	}

	.picked-title {
		margin: 0;
		font-weight: 700;
		font-size: 1.125rem;
		line-height: 1.3;
	}

	.picked-artist {
		margin: 0.25rem 0 0;
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
	}

	.picked-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.meta-item {
		padding: 0.25rem 0.625rem;
		background: var(--color-bg-secondary);
		border-radius: 6px;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.meta-item.year {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: white;
		font-weight: 600;
	}

	.picked-label {
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
	}

	.view-link {
		display: inline-block;
		margin-top: 0.75rem;
		font-size: 0.8125rem;
		color: var(--color-primary);
		text-decoration: none;
	}

	.view-link:hover {
		text-decoration: underline;
	}

	.spin-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: white;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
	}

	.spin-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	.spin-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.spin-icon.spinning {
		animation: spin 0.5s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
