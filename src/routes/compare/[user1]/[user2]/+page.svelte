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
	<meta name="description" content="Compare the record collections of {user1.profile.username} and {user2.profile.username}" />
	<meta property="og:title" content="{user1.profile.username} vs {user2.profile.username}" />
	<meta property="og:description" content="Head-to-head collection comparison on Record Shelf" />
	<meta property="og:type" content="website" />
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
		<div class="stat-card">
			<span class="stat-value">{comparison.sharedGenres.length}</span>
			<span class="stat-label">Shared genres</span>
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

	{#if comparison.genreOverlap?.length > 0}
		<section class="card">
			<h2>Genre Comparison</h2>
			<div class="genre-bars">
				{#each comparison.genreOverlap as g}
					{@const max = Math.max(g.count1, g.count2, 1)}
					<div class="genre-row">
						<div class="genre-bar-left">
							<div class="bar bar-1" style="width: {(g.count1 / max) * 100}%">
								{#if g.count1 > 0}<span class="bar-label">{g.count1}</span>{/if}
							</div>
						</div>
						<span class="genre-name">{g.genre}</span>
						<div class="genre-bar-right">
							<div class="bar bar-2" style="width: {(g.count2 / max) * 100}%">
								{#if g.count2 > 0}<span class="bar-label">{g.count2}</span>{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="genre-legend">
				<span class="legend-item"><span class="legend-dot dot-1"></span>{user1.profile.username}</span>
				<span class="legend-item"><span class="legend-dot dot-2"></span>{user2.profile.username}</span>
			</div>
		</section>
	{/if}

	{#if comparison.decades1 && comparison.decades2}
		{@const allDecades = [...new Set([...Object.keys(comparison.decades1), ...Object.keys(comparison.decades2)])].sort()}
		<section class="card">
			<h2>Decade Comparison</h2>
			<div class="decade-chart">
				{#each allDecades as decade}
					{@const v1 = comparison.decades1[decade] || 0}
					{@const v2 = comparison.decades2[decade] || 0}
					{@const max = Math.max(v1, v2, 1)}
					<div class="decade-col">
						<div class="decade-bars">
							<div class="decade-bar bar-1" style="height: {(v1 / max) * 100}%"
								title="{user1.profile.username}: {v1}">
							</div>
							<div class="decade-bar bar-2" style="height: {(v2 / max) * 100}%"
								title="{user2.profile.username}: {v2}">
							</div>
						</div>
						<span class="decade-label">{decade}</span>
					</div>
				{/each}
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

	.genre-bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.genre-row {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.5rem;
		align-items: center;
	}

	.genre-bar-left {
		display: flex;
		justify-content: flex-end;
	}

	.genre-bar-right {
		display: flex;
		justify-content: flex-start;
	}

	.bar {
		height: 24px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		min-width: 2px;
		transition: width 0.3s ease;
	}

	.bar-1 {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		justify-content: flex-start;
		padding-left: 6px;
	}

	.bar-2 {
		background: linear-gradient(135deg, #ec4899, #f43f5e);
		justify-content: flex-end;
		padding-right: 6px;
	}

	.bar-label {
		font-size: 0.6875rem;
		font-weight: 600;
		color: white;
	}

	.genre-name {
		font-size: 0.75rem;
		font-weight: 500;
		text-align: center;
		min-width: 80px;
		color: var(--color-text-secondary);
	}

	.genre-legend {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		margin-top: 1rem;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.dot-1 { background: #6366f1; }
	.dot-2 { background: #ec4899; }

	.decade-chart {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		align-items: flex-end;
		height: 180px;
		padding: 1rem 0;
	}

	.decade-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		max-width: 60px;
	}

	.decade-bars {
		display: flex;
		gap: 2px;
		align-items: flex-end;
		height: 150px;
		width: 100%;
	}

	.decade-bar {
		flex: 1;
		border-radius: 3px 3px 0 0;
		min-height: 2px;
		transition: height 0.3s ease;
	}

	.decade-label {
		font-size: 0.625rem;
		color: var(--color-text-tertiary);
		white-space: nowrap;
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
		.compare-results {
			padding: 1rem;
		}

		.matchup {
			flex-direction: column;
		}

		.vs-badge {
			order: -1;
		}

		.stats-row {
			flex-direction: column;
		}

		.stat-card {
			padding: 0.75rem 1rem;
		}

		.genre-row {
			grid-template-columns: 1fr 60px 1fr;
		}

		.genre-name {
			font-size: 0.6875rem;
			min-width: 60px;
		}

		.bar-label {
			font-size: 0.5625rem;
		}

		.decade-chart {
			height: 140px;
			gap: 0.25rem;
			overflow-x: auto;
		}

		.decade-col {
			min-width: 36px;
		}

		.decade-bars {
			height: 110px;
		}

		.decade-label {
			font-size: 0.5625rem;
		}
	}
</style>
