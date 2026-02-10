<script lang="ts">
	import type { PageData } from './$types';
	import CoverGrid from '$lib/components/CoverGrid.svelte';

	let { data }: { data: PageData } = $props();

	let user1 = $derived(data.user1);
	let user2 = $derived(data.user2);
	let comparison = $derived(data.comparison);

	function getSimilarityLabel(score: number): string {
		if (score >= 30) return 'Taste twins!';
		if (score >= 15) return 'Similar vibes';
		if (score >= 5) return 'Some overlap';
		return 'Different tastes';
	}
</script>

<svelte:head>
	<title>{user1.profile.username} vs {user2.profile.username} - Record Shelf</title>
</svelte:head>

<main class="compare-results">
	<nav class="nav-bar">
		<a href="/" class="home-link">
			<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/>
				<circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
				<circle cx="24" cy="24" r="3" fill="currentColor"/>
			</svg>
			<span>Record Shelf</span>
		</a>
	</nav>

	<header class="matchup">
		<div class="user-card">
			{#if user1.profile.avatar_url}
				<img src={user1.profile.avatar_url} alt="" class="avatar" />
			{/if}
			<a href="/u/{user1.profile.username}" class="username">{user1.profile.username}</a>
			<span class="item-count">{user1.totalItems} records</span>
		</div>

		<div class="vs-badge">
			<span class="similarity-score">{comparison.similarityScore}%</span>
			<span class="similarity-label">{getSimilarityLabel(comparison.similarityScore)}</span>
		</div>

		<div class="user-card">
			{#if user2.profile.avatar_url}
				<img src={user2.profile.avatar_url} alt="" class="avatar" />
			{/if}
			<a href="/u/{user2.profile.username}" class="username">{user2.profile.username}</a>
			<span class="item-count">{user2.totalItems} records</span>
		</div>
	</header>

	<section class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{comparison.overlapCount}</span>
			<span class="stat-label">Records in common</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{comparison.sharedArtistsCount}</span>
			<span class="stat-label">Shared artists</span>
		</div>
	</section>

	{#if comparison.sharedArtists.length > 0}
		<section class="card">
			<h2>Shared Artists</h2>
			<div class="artist-tags">
				{#each comparison.sharedArtists as artist}
					<span class="artist-tag">{artist}</span>
				{/each}
				{#if comparison.sharedArtistsCount > 10}
					<span class="more-tag">+{comparison.sharedArtistsCount - 10} more</span>
				{/if}
			</div>
		</section>
	{/if}

	{#if comparison.overlap.length > 0}
		<section class="card">
			<h2>Records Both Own</h2>
			<CoverGrid items={comparison.overlap.slice(0, 30)} />
		</section>
	{/if}

	<div class="grid-2col">
		<section class="card">
			<h2>Only {user1.profile.username} Has</h2>
			{#if comparison.uniqueTo1.length > 0}
				<CoverGrid items={comparison.uniqueTo1} />
			{:else}
				<p class="no-data">No unique records found</p>
			{/if}
		</section>

		<section class="card">
			<h2>Only {user2.profile.username} Has</h2>
			{#if comparison.uniqueTo2.length > 0}
				<CoverGrid items={comparison.uniqueTo2} />
			{:else}
				<p class="no-data">No unique records found</p>
			{/if}
		</section>
	</div>

	<div class="actions">
		<a href="/compare" class="action-btn">Compare Different Users</a>
	</div>

	<footer class="footer">
		<p>&copy; {new Date().getFullYear()} Record Shelf. Not affiliated with Discogs.</p>
	</footer>
</main>

<style>
	.compare-results {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.nav-bar {
		margin-bottom: 2rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 600;
		font-size: 1rem;
	}

	.home-link svg {
		width: 28px;
		height: 28px;
		color: var(--color-primary);
	}

	.matchup {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		margin-bottom: 2rem;
		flex-wrap: wrap;
	}

	.user-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		min-width: 150px;
	}

	.avatar {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		object-fit: cover;
	}

	.username {
		font-weight: 600;
		font-size: 1.125rem;
		color: var(--color-text);
		text-decoration: none;
	}

	.username:hover {
		color: var(--color-primary);
	}

	.item-count {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.vs-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.similarity-score {
		font-size: 2.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.similarity-label {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.stats-row {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 2rem;
		background: var(--color-bg-secondary);
		border-radius: 12px;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.card {
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.card h2 {
		margin: 0 0 1.25rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.grid-2col {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.grid-2col .card {
		margin-bottom: 0;
	}

	.artist-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.artist-tag {
		padding: 0.375rem 0.75rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
		border-radius: 20px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.more-tag {
		padding: 0.375rem 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: 20px;
		font-size: 0.875rem;
		color: var(--color-text-tertiary);
	}

	.no-data {
		text-align: center;
		color: var(--color-text-tertiary);
		font-size: 0.875rem;
		padding: 2rem;
		margin: 0;
	}

	.actions {
		display: flex;
		justify-content: center;
		margin: 2rem 0;
	}

	.action-btn {
		padding: 0.75rem 1.5rem;
		background: var(--color-bg-secondary);
		border-radius: 8px;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 500;
		transition: background-color 0.15s;
	}

	.action-btn:hover {
		background: var(--color-bg-tertiary);
	}

	.footer {
		padding: 2rem 0;
		border-top: 1px solid var(--color-border);
	}

	.footer p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		text-align: center;
	}

	@media (max-width: 600px) {
		.matchup {
			flex-direction: column;
		}

		.vs-badge {
			order: -1;
		}
	}
</style>
