<script lang="ts">
	import type { DiscogsUserProfile, DiscogsWantlistItem } from '$lib/types/discogs';
	import LazyImage from '$lib/components/LazyImage.svelte';

	let { data }: { data: { profile: DiscogsUserProfile; wantlist: DiscogsWantlistItem[] } } = $props();

	let profile = $derived(data.profile);
	let wantlist = $derived(data.wantlist);

	let searchQuery = $state('');
	let sortBy = $state<'added' | 'artist' | 'title' | 'year'>('added');

	let filteredItems = $derived(
		wantlist
			.filter((item: DiscogsWantlistItem) => {
				if (!searchQuery) return true;
				const q = searchQuery.toLowerCase();
				const title = item.basic_information.title.toLowerCase();
				const artist = item.basic_information.artists.map((a: { name: string }) => a.name.toLowerCase()).join(' ');
				return title.includes(q) || artist.includes(q);
			})
			.sort((a: DiscogsWantlistItem, b: DiscogsWantlistItem) => {
				switch (sortBy) {
					case 'artist':
						return getArtistName(a.basic_information.artists).localeCompare(getArtistName(b.basic_information.artists));
					case 'title':
						return a.basic_information.title.localeCompare(b.basic_information.title);
					case 'year':
						return (b.basic_information.year || 0) - (a.basic_information.year || 0);
					default:
						return 0;
				}
			})
	);

	function getArtistName(artists: Array<{ name: string }>): string {
		return artists.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
	}
</script>

<svelte:head>
	<title>{profile.username}'s Wantlist - Record Shelf</title>
	<meta name="description" content="Browse {profile.username}'s wantlist on Record Shelf" />
	<meta property="og:title" content="{profile.username}'s Wantlist - Record Shelf" />
	<meta property="og:description" content="See what records {profile.username} is looking for" />
	<meta property="og:type" content="website" />
</svelte:head>

<main class="wantlist-page">
	<nav class="nav-bar">
		<a href="/u/{profile.username}" class="back-link">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6" />
			</svg>
			Back to Collection
		</a>
	</nav>

	<header class="page-header">
		<div class="user-info">
			{#if profile.avatar_url}
				<img src={profile.avatar_url} alt={profile.username} class="avatar" />
			{/if}
			<div>
				<h1>{profile.username}'s Wantlist</h1>
				<p class="count">{wantlist.length} items</p>
			</div>
		</div>
	</header>

	<div class="controls">
		<div class="search-bar">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search wantlist..."
			/>
			{#if searchQuery}
				<span class="result-count">{filteredItems.length} results</span>
			{/if}
		</div>
		<div class="sort-bar">
			<span class="sort-label">Sort:</span>
			{#each [
				{ value: 'added', label: 'Date Added' },
				{ value: 'artist', label: 'Artist' },
				{ value: 'title', label: 'Title' },
				{ value: 'year', label: 'Year' }
			] as option}
				<button
					class="sort-btn"
					class:active={sortBy === option.value}
					onclick={() => sortBy = option.value as typeof sortBy}
				>{option.label}</button>
			{/each}
		</div>
	</div>

	<div class="wantlist-grid">
		{#each filteredItems as item (item.id)}
			<a
				href="https://www.discogs.com/release/{item.basic_information.id}"
				target="_blank"
				rel="noopener"
				class="want-card"
			>
				<div class="want-cover">
					<LazyImage
						src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
						alt=""
					/>
				</div>
				<div class="want-info">
					<p class="want-title">{item.basic_information.title}</p>
					<p class="want-artist">{getArtistName(item.basic_information.artists)}</p>
					<div class="want-meta">
						{#if item.basic_information.year}
							<span class="want-year">{item.basic_information.year}</span>
						{/if}
						{#if item.basic_information.formats?.[0]}
							<span class="want-format">{item.basic_information.formats[0].name}</span>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>

	{#if filteredItems.length === 0}
		<div class="empty-state">
			{#if searchQuery}
				<p class="empty-title">No results</p>
				<p class="empty-desc">No items match "{searchQuery}"</p>
				<button class="clear-btn" onclick={() => searchQuery = ''}>Clear search</button>
			{:else}
				<svg class="empty-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="32" cy="32" r="24" opacity="0.3" />
					<circle cx="32" cy="32" r="16" opacity="0.2" />
					<circle cx="32" cy="32" r="4" fill="currentColor" opacity="0.4" />
					<path d="M32 8v4M32 52v4M8 32h4M52 32h4" opacity="0.3" />
				</svg>
				<p class="empty-title">Wantlist is empty</p>
				<p class="empty-desc">{profile.username} hasn't added any items to their wantlist yet.</p>
				<a href="/u/{profile.username}" class="back-btn">View Collection</a>
			{/if}
		</div>
	{/if}
</main>

<style>
	.wantlist-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.nav-bar {
		margin-bottom: 1.5rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		text-decoration: none;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		padding: 0.5rem 0.75rem 0.5rem 0.25rem;
		margin: -0.5rem;
		border-radius: 8px;
		transition: background-color 0.15s, color 0.15s;
	}

	.back-link:hover {
		background: var(--color-bg-secondary);
		color: var(--color-text);
	}

	.back-link svg {
		width: 18px;
		height: 18px;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.avatar {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--color-border);
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.count {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.sort-bar {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.sort-label {
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		font-weight: 500;
		margin-right: 0.25rem;
	}

	.sort-btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-bg-card);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all 0.15s;
	}

	.sort-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.sort-btn.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.search-bar input {
		flex: 1;
		padding: 0.75rem 1rem;
		font-size: 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg-card);
		color: var(--color-text);
		transition: border-color 0.15s;
	}

	.search-bar input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.result-count {
		font-size: 0.8125rem;
		color: var(--color-text-tertiary);
		white-space: nowrap;
	}

	.wantlist-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
	}

	.want-card {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: inherit;
		border-radius: 10px;
		overflow: hidden;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.want-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
	}

	.want-cover {
		width: 100%;
		aspect-ratio: 1;
		background: var(--color-bg-secondary);
	}

	.want-info {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.want-title {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.want-artist {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.want-meta {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.want-year, .want-format {
		font-size: 0.6875rem;
		color: var(--color-text-tertiary);
	}

	.want-year {
		font-weight: 600;
		color: var(--color-primary);
	}

	.empty-state {
		text-align: center;
		padding: 4rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.empty-icon {
		width: 80px;
		height: 80px;
		color: var(--color-text-tertiary);
		margin-bottom: 0.5rem;
	}

	.empty-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.empty-desc {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-tertiary);
	}

	.clear-btn, .back-btn {
		margin-top: 0.75rem;
		padding: 0.5rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid var(--color-primary);
		border-radius: 8px;
		background: transparent;
		color: var(--color-primary);
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s;
	}

	.clear-btn:hover, .back-btn:hover {
		background: var(--color-primary);
		color: white;
	}

	@media (max-width: 600px) {
		.wantlist-page {
			padding: 1rem;
		}

		.wantlist-grid {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
			gap: 0.75rem;
		}
	}
</style>
