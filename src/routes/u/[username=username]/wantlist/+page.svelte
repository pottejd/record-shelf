<script lang="ts">
	import type { PageData } from './$types';
	import type { DiscogsWantlistItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import { goto } from '$app/navigation';
	import { createLoader } from '$lib/sync/loader.svelte';
	import LazyImage from '$lib/components/LazyImage.svelte';
	import SearchBar from '$lib/components/browser/SearchBar.svelte';
	import LoadingBanner from '$lib/components/profile/LoadingBanner.svelte';
	import SkeletonWantlist from '$lib/components/SkeletonWantlist.svelte';

	let { data }: { data: PageData } = $props();

	// One loader per username: it starts from the stored copy and fetches the rest
	// through the sync API. Navigating to another user stops the old one.
	const loader = $derived(
		createLoader<DiscogsWantlistItem>({
			kind: 'wantlist',
			username: data.username,
			initial: data.stored,
			keyOf: (i) => i.id
		})
	);
	$effect(() => {
		const l = loader;
		l.run();
		return () => l.stop();
	});
	let s = $derived(loader.state);

	let profile = $derived(s.profile);
	let wantlist = $derived(s.items);

	// The token cookie is missing or rejected: send the visitor to settings.
	$effect(() => {
		const code = s.error?.code;
		if (code === 'TOKEN_REQUIRED' || code === 'BAD_TOKEN') {
			goto(`/settings?redirect=/u/${encodeURIComponent(data.username)}/wantlist`, { replaceState: true });
		}
	});

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
		return formatArtists(artists);
	}
</script>

<svelte:head>
	{#if profile}
		<title>{profile.username}'s Wantlist - Record Shelf</title>
		<meta name="description" content="Browse {profile.username}'s wantlist on Record Shelf" />
		<meta property="og:title" content="{profile.username}'s Wantlist - Record Shelf" />
		<meta property="og:description" content="See what records {profile.username} is looking for" />
		<meta property="og:type" content="website" />
	{:else}
		<title>Record Shelf</title>
	{/if}
</svelte:head>

{#if s.error?.code === 'NOT_FOUND' || s.error?.code === 'PRIVATE'}
<main id="main-content" class="wantlist-page">
	<div class="error-note" role="alert">
		{#if s.error.code === 'NOT_FOUND'}
			No Discogs user named "{data.username}".
		{:else}
			{data.username}'s wantlist is private.
		{/if}
	</div>
</main>
{:else if profile}
<main id="main-content" class="wantlist-page">
	<header class="page-header">
		<div class="user-info">
			{#if profile.avatar_url}
				<img src={profile.avatar_url} alt={profile.username} class="avatar cover" />
			{/if}
			<div>
				<h1>{profile.username}'s Wantlist</h1>
				<p class="count lead">{s.totalItems} items</p>
			</div>
		</div>
	</header>

	<LoadingBanner state={s} label="wantlist" onRetry={() => loader.run()} />

	<div class="controls">
		<div class="search-bar">
			<SearchBar bind:value={searchQuery} placeholder="Search wantlist..." />
			{#if searchQuery}
				<span class="result-count" aria-live="polite" role="status">{filteredItems.length} results</span>
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
					aria-pressed={sortBy === option.value}
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
				rel="noopener noreferrer"
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

	{#if filteredItems.length === 0 && (searchQuery || (s.phase === 'done' && s.totalItems === 0))}
		<div class="empty-state">
			{#if searchQuery}
				<p class="empty-title">No results</p>
				<p class="empty-desc">No items match "{searchQuery}"</p>
				<button class="btn btn-secondary clear-btn" onclick={() => searchQuery = ''}>Clear search</button>
			{:else}
				<svg aria-hidden="true" class="empty-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="32" cy="32" r="24" opacity="0.3" />
					<circle cx="32" cy="32" r="16" opacity="0.2" />
					<circle cx="32" cy="32" r="4" fill="currentColor" opacity="0.4" />
					<path d="M32 8v4M32 52v4M8 32h4M52 32h4" opacity="0.3" />
				</svg>
				<p class="empty-title">Wantlist is empty</p>
				<p class="empty-desc">{profile.username} hasn't added any items to their wantlist yet.</p>
				<a href="/u/{profile.username}" class="btn btn-secondary back-btn">View Collection</a>
			{/if}
		</div>
	{/if}
</main>
{:else}
<main id="main-content" class="wantlist-page">
	<LoadingBanner state={s} label="wantlist" onRetry={() => loader.run()} />
	<SkeletonWantlist />
</main>
{/if}

<style>
	.wantlist-page {
		padding-top: 56px;
	}

	.page-header {
		margin-bottom: 40px;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 20px;
	}

	.avatar {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
	}

	h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.count {
		margin: 12px 0 0;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 32px;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.sort-bar {
		display: flex;
		align-items: center;
		gap: 0 28px;
		flex-wrap: wrap;
	}

	.sort-label {
		font-size: 17px;
		color: var(--muted);
	}

	.sort-btn {
		min-height: 48px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 17px;
		font-weight: 500;
		cursor: pointer;
	}

	.sort-btn:hover {
		color: var(--ink);
	}

	.sort-btn.active {
		color: var(--ink);
		font-weight: 700;
	}

	.result-count {
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
	}

	.wantlist-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 32px 24px;
	}

	.want-card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		text-decoration: none;
		color: inherit;
	}

	.want-card:hover .want-title {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	/* Square cover on the track colour, with the 1px inner edge so pale sleeves keep their outline. */
	.want-cover {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		background: var(--track);
	}

	.want-cover::after {
		content: '';
		position: absolute;
		inset: 0;
		box-shadow: inset 0 0 0 1px var(--cover-edge);
		pointer-events: none;
	}

	.want-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 12px;
	}

	.want-title {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
		line-height: 1.25;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.want-artist {
		margin: 0;
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.want-meta {
		display: flex;
		gap: 8px;
		margin-top: 2px;
		font-size: 15px;
	}

	.want-year {
		font-weight: 600;
	}

	.want-format {
		color: var(--muted);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		padding: 40px 0;
	}

	.empty-icon {
		width: 64px;
		height: 64px;
		color: var(--muted);
		margin-bottom: 8px;
	}

	.empty-title {
		margin: 0;
		font-size: 21px;
		font-weight: 700;
	}

	.empty-desc {
		margin: 0;
		color: var(--muted);
	}

	.clear-btn,
	.back-btn {
		margin-top: 16px;
	}

	@media (max-width: 699px) {
		.wantlist-page {
			padding-top: 32px;
		}

		.avatar {
			width: 48px;
			height: 48px;
		}

		.sort-bar {
			gap: 0 18px;
		}

		.wantlist-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 24px 16px;
		}
	}
</style>
