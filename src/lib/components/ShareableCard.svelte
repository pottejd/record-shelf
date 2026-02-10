<script lang="ts">
	import type { CollectionStats } from '$lib/types/discogs';

	let { username, stats, badges = [] }: {
		username: string;
		stats: CollectionStats;
		badges?: { label: string; style: string }[];
	} = $props();

	let cardElement: HTMLDivElement | undefined = $state(undefined);
	let copied = $state(false);

	async function copyAsImage() {
		if (!cardElement) return;

		try {
			// Use html2canvas if available, otherwise just copy text stats
			const text = `${username}'s Record Collection
${stats.totalItems} Records | ${stats.totalArtists} Artists | ${stats.totalLabels} Labels
Top Genre: ${stats.dominantGenre || 'Various'}
Dominant Era: ${stats.dominantDecade ? stats.dominantDecade + 's' : 'Mixed'}
recordshelf.app/u/${username}`;

			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch {
			// Fallback
			alert('Copy not supported in this browser');
		}
	}
</script>

<div class="shareable-container">
	<div class="stats-card" bind:this={cardElement}>
		<div class="card-header">
			<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="logo">
				<circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/>
				<circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
				<circle cx="24" cy="24" r="3" fill="currentColor"/>
			</svg>
			<span class="brand">Record Shelf</span>
		</div>

		<div class="card-username">{username}</div>

		<div class="card-badges">
			{#each badges.slice(0, 4) as badge}
				<span class="card-badge">{badge.label}</span>
			{/each}
		</div>

		<div class="card-stats">
			<div class="card-stat">
				<span class="card-stat-value">{stats.totalItems.toLocaleString()}</span>
				<span class="card-stat-label">Records</span>
			</div>
			<div class="card-stat">
				<span class="card-stat-value">{stats.totalArtists.toLocaleString()}</span>
				<span class="card-stat-label">Artists</span>
			</div>
			<div class="card-stat">
				<span class="card-stat-value">{stats.totalLabels.toLocaleString()}</span>
				<span class="card-stat-label">Labels</span>
			</div>
		</div>

		<div class="card-highlights">
			{#if stats.dominantGenre}
				<div class="highlight-item">
					<span class="highlight-label">Top Genre</span>
					<span class="highlight-value">{stats.dominantGenre}</span>
				</div>
			{/if}
			{#if stats.dominantDecade}
				<div class="highlight-item">
					<span class="highlight-label">Favorite Era</span>
					<span class="highlight-value">{stats.dominantDecade}s</span>
				</div>
			{/if}
			{#if stats.collectionSpan}
				<div class="highlight-item">
					<span class="highlight-label">Year Span</span>
					<span class="highlight-value">{stats.collectionSpan} years</span>
				</div>
			{/if}
		</div>

		<div class="card-footer">
			recordshelf.app/u/{username}
		</div>
	</div>

	<button class="share-btn" onclick={copyAsImage}>
		{#if copied}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="20 6 9 17 4 12" />
			</svg>
			Copied!
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
				<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
			</svg>
			Copy Stats to Clipboard
		{/if}
	</button>
</div>

<style>
	.shareable-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.stats-card {
		width: 100%;
		max-width: 340px;
		padding: 1.5rem;
		background: linear-gradient(145deg, #1a1a2e, #16213e);
		border-radius: 16px;
		color: white;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.logo {
		width: 24px;
		height: 24px;
		color: #8b5cf6;
	}

	.brand {
		font-size: 0.875rem;
		font-weight: 600;
		opacity: 0.7;
	}

	.card-username {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.75rem;
	}

	.card-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-bottom: 1.25rem;
	}

	.card-badge {
		padding: 0.25rem 0.625rem;
		background: rgba(139, 92, 246, 0.3);
		border-radius: 12px;
		font-size: 0.6875rem;
		font-weight: 600;
	}

	.card-stats {
		display: flex;
		justify-content: space-between;
		padding: 1rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		margin-bottom: 1rem;
	}

	.card-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.card-stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.card-stat-label {
		font-size: 0.6875rem;
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.card-highlights {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.highlight-item {
		display: flex;
		justify-content: space-between;
		font-size: 0.8125rem;
	}

	.highlight-label {
		opacity: 0.6;
	}

	.highlight-value {
		font-weight: 600;
	}

	.card-footer {
		text-align: center;
		font-size: 0.75rem;
		opacity: 0.4;
	}

	.share-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-bg-secondary);
		border: none;
		border-radius: 8px;
		color: var(--color-text);
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.share-btn:hover {
		background: var(--color-bg-tertiary);
	}

	.share-btn svg {
		width: 18px;
		height: 18px;
	}
</style>
