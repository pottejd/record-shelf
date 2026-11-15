<script lang="ts">
	import type { PageData } from './$types';
	import type { DiscogsWantlistItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import { goto } from '$app/navigation';
	import { createLoader } from '$lib/sync/loader.svelte';
	import RecordCard from '$lib/components/browser/RecordCard.svelte';
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
		<title>{profile.username}'s wantlist - Record Shelf</title>
		<meta name="description" content="Browse {profile.username}'s wantlist on Record Shelf" />
		<meta property="og:title" content="{profile.username}'s wantlist - Record Shelf" />
		<meta property="og:description" content="See what records {profile.username} is looking for" />
		<meta property="og:type" content="website" />
	{:else}
		<title>Record Shelf</title>
	{/if}
</svelte:head>

{#if s.error?.code === 'NOT_FOUND' || s.error?.code === 'PRIVATE'}
<main id="main-content" class="wantlist-page">
	<div class="section notice" role="alert">
		{#if s.error.code === 'NOT_FOUND'}
			No Discogs user named "{data.username}".
		{:else}
			{data.username}'s wantlist is private.
		{/if}
	</div>
</main>
{:else if profile}
<main id="main-content" class="wantlist-page">
	<h1>{profile.username}'s wantlist</h1>
	<p class="lead">{s.totalItems.toLocaleString()} items</p>

	<div class="body">
		<LoadingBanner state={s} label="wantlist" onRetry={() => loader.run()} />

		<!-- Laid out as the Records tab: search and sort over the six-column grid. -->
		<section class="section" aria-label="Wantlist">
			<div class="search-bar">
				<SearchBar bind:value={searchQuery} placeholder="Search wantlist..." />
				{#if searchQuery}
					<span class="result-count" aria-live="polite" role="status">{filteredItems.length} results</span>
				{/if}
			</div>
			<div class="sort-bar">
				<span class="sort-label">Sort by</span>
				{#each [
					{ value: 'added', label: 'Date added' },
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

			{#if filteredItems.length > 0}
				<div class="wantlist-grid">
					{#each filteredItems as item (item.id)}
						<RecordCard {item} />
					{/each}
				</div>
			{/if}

			{#if filteredItems.length === 0 && (searchQuery || (s.phase === 'done' && s.totalItems === 0))}
				<div class="empty-state">
					{#if searchQuery}
						<p class="empty-title">No results</p>
						<p class="empty-desc">No items match "{searchQuery}"</p>
						<button class="btn btn-secondary" onclick={() => searchQuery = ''}>Clear search</button>
					{:else}
						<p class="empty-title">Wantlist is empty</p>
						<p class="empty-desc">{profile.username} hasn't added any items to their wantlist yet.</p>
						<a href="/u/{profile.username}" class="btn btn-secondary">View collection</a>
					{/if}
				</div>
			{/if}
		</section>
	</div>
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
		padding-bottom: var(--section-gap);
	}

	h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.lead {
		margin-top: 16px;
	}

	.body {
		margin-top: 48px;
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
		margin-top: 8px;
	}

	.sort-label {
		font-size: 17px;
		color: var(--muted);
	}

	/* Plain words; the chosen one is ink and bold (as the Records tab). */
	.sort-btn {
		min-height: 48px;
		padding: 0;
		border: 0;
		border-radius: 0;
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

	/* The Records grid: six columns, two on a phone. */
	.wantlist-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 32px 24px;
		margin-top: 32px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		margin-top: 32px;
	}

	.empty-title {
		margin: 0;
		font-size: 21px;
		font-weight: 700;
	}

	.empty-desc {
		margin: 0 0 16px;
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	@media (max-width: 699px) {
		.wantlist-page {
			padding-top: 32px;
		}

		.body {
			margin-top: 32px;
		}

		.sort-bar {
			gap: 0 12px;
		}

		.wantlist-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 24px 16px;
		}
	}
</style>
