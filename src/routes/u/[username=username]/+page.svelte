<script lang="ts">
	import type { PageData } from './$types';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import CollectionDrawer from '$lib/components/CollectionDrawer.svelte';
	import SectionNav from '$lib/components/SectionNav.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import FloatingActions from '$lib/components/FloatingActions.svelte';
	import ProfileHeader from '$lib/components/profile/ProfileHeader.svelte';
	import LoadingBanner from '$lib/components/profile/LoadingBanner.svelte';
	import ProfileOverview from '$lib/components/profile/ProfileOverview.svelte';
	import ProfileCollection from '$lib/components/profile/ProfileCollection.svelte';
	import ProfileCharts from '$lib/components/profile/ProfileCharts.svelte';
	import ProfileActivity from '$lib/components/profile/ProfileActivity.svelte';
	import ProfileInsights from '$lib/components/profile/ProfileInsights.svelte';
	import ProfileShare from '$lib/components/profile/ProfileShare.svelte';
	import OldestNewestHighlights from '$lib/components/profile/OldestNewestHighlights.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { findDuplicates, groupAlbums } from '$lib/utils/albums';
	import { computeCollectionStats } from '$lib/api/discogs';
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { keyboardNav } from '$lib/actions/keyboardNav';
	import { sampleN } from '$lib/utils/array';
	import { toChartData } from '$lib/utils/chart';
	import { calculateBadges } from '$lib/utils/badges';
	import { CHART_LIMITS, GRID_PREVIEW_LIMIT } from '$lib/constants';

	const navSections = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'top-lists', label: 'Top Lists' },
		{ id: 'collection', label: 'Collection' },
		{ id: 'charts', label: 'Charts' },
		{ id: 'activity', label: 'Activity' },
		{ id: 'share', label: 'Share' }
	];
	const navSectionIds = navSections.map((s) => s.id);

	let { data }: { data: PageData } = $props();

	let profile = $derived(data.collection.profile);
	let totalDiscogsItems = $derived(data.collection.totalDiscogsItems);

	// Mutable items array for progressive loading
	let items: DiscogsCollectionItem[] = $state(data.collection.items);
	let isLoadingMore = $state(false);
	let loadProgress = $state(0);
	let loadError = $state(false);

	// Recompute stats reactively as more items load
	let stats = $derived(computeCollectionStats(items));

	// Reset items when navigating to a different user
	$effect(() => {
		items = data.collection.items;
	});

	// Progressive loading: fetch remaining pages client-side.
	// Pages are buffered and flushed to the reactive `items` array every few
	// pages so stats + ~13 derived consumers recompute a handful of times
	// instead of once per page (which was O(n^2) over the growing collection).
	const FLUSH_EVERY_PAGES = 3;

	$effect(() => {
		if (!browser) return;
		const initialItems = data.collection.items;
		const total = data.collection.totalDiscogsItems;
		if (initialItems.length >= total) return;

		let cancelled = false;
		isLoadingMore = true;
		loadError = false;

		async function loadRemaining() {
			let nextPage = 2;
			let buffer = [...initialItems];
			let sinceFlush = 0;
			const flush = () => {
				items = buffer;
				loadProgress = Math.min(items.length / total, 1);
				sinceFlush = 0;
			};

			try {
				while (!cancelled) {
					const response = await fetch(
						`/api/collection/${data.collection.profile.username}?page=${nextPage}`
					);
					if (cancelled) return;
					if (!response.ok) {
						loadError = true;
						break;
					}
					const pageData = await response.json();
					if (cancelled) return;
					if (!pageData.items?.length) break;

					buffer = [...buffer, ...pageData.items];
					if (++sinceFlush >= FLUSH_EVERY_PAGES) flush();

					if (pageData.pagination.page >= pageData.pagination.pages) break;
					nextPage++;
				}
			} catch {
				loadError = true;
			} finally {
				if (!cancelled) {
					flush(); // ensure the last buffered pages are shown
					isLoadingMore = false;
				}
			}
		}

		loadRemaining();
		return () => { cancelled = true; };
	});

	// Refresh state
	let refreshing = $state(false);

	async function refreshCollection() {
		refreshing = true;
		try {
			await fetch(`/api/collection/${profile.username}`, { method: 'DELETE' });
			await invalidateAll();
		} finally {
			refreshing = false;
		}
	}

	// Drawer state
	let drawerOpen = $state(false);
	let drawerTitle = $state('');
	let drawerItems: DiscogsCollectionItem[] = $state([]);
	let showHelp = $state(false);

	function openDrawer(title: string, items: DiscogsCollectionItem[]) {
		drawerTitle = title;
		drawerItems = items;
		drawerOpen = true;
	}

	function closeDrawer() {
		drawerOpen = false;
	}

	// Filter functions: each opens the drawer with the items matching a predicate.
	function filterBy(title: string, predicate: (item: DiscogsCollectionItem) => boolean) {
		openDrawer(title, items.filter(predicate));
	}

	function filterByDecade(label: string) {
		const decadeStart = parseInt(label.replace('s', ''));
		filterBy(label, (item) => {
			const year = item.basic_information.year;
			return year >= decadeStart && year < decadeStart + 10;
		});
	}

	function filterByGenre(genre: string) {
		filterBy(genre, (item) => item.basic_information.genres?.includes(genre) ?? false);
	}

	function filterByFormat(format: string) {
		filterBy(format, (item) => item.basic_information.formats?.some((f) => f.name === format) ?? false);
	}

	function filterByStyle(style: string) {
		filterBy(style, (item) => item.basic_information.styles?.includes(style) ?? false);
	}

	function filterByArtist(artistName: string) {
		filterBy(artistName, (item) => item.basic_information.artists?.some((a) => a.name === artistName) ?? false);
	}

	function filterByLabel(labelName: string) {
		filterBy(labelName, (item) => item.basic_information.labels?.some((l) => l.name === labelName) ?? false);
	}

	function filterByYear(year: number) {
		filterBy(String(year), (item) => item.basic_information.year === year);
	}

	let decadeData = $derived(
		toChartData(stats.decadeBreakdown, { sort: 'label-asc', labelFn: (d) => `${d}s` })
	);
	let genreData = $derived(
		toChartData(stats.genreBreakdown, { sort: 'value-desc', limit: CHART_LIMITS.TOP_GENRES })
	);
	let formatData = $derived(toChartData(stats.formatBreakdown, { sort: 'value-desc' }));
	let styleData = $derived(
		toChartData(stats.styleBreakdown, { sort: 'value-desc', limit: CHART_LIMITS.TOP_STYLES })
	);

	// Random highlights — shuffle the collection for variety
	// Sample highlights from the initial (server-rendered) page once per collection
	// rather than re-deriving from `items` on every progressive append — that
	// reshuffled the grid and re-downloaded covers on each page load.
	let randomHighlights = $state<DiscogsCollectionItem[]>([]);
	$effect(() => {
		randomHighlights = sampleN(data.collection.items, GRID_PREVIEW_LIMIT);
	});

	// Fun personality badges
	let badges = $derived(calculateBadges(stats));

	// Collection insights (duplicates / format upgrades) — computed via albums util
	let duplicates = $derived(findDuplicates(items));
	let formatUpgrades = $derived(
		groupAlbums(items).filter((g) => {
			const formats = new Set(
				g.items.flatMap((i) => i.basic_information.formats.map((f) => f.name))
			);
			return !formats.has('Vinyl') && (formats.has('CD') || formats.has('Cassette'));
		})
	);
</script>

<svelte:head>
	<title>{profile.username}'s Collection - Record Shelf</title>
	<meta
		name="description"
		content="Explore {profile.username}'s record collection: {stats.totalItems} items across {stats.totalArtists} artists"
	/>
	<meta property="og:title" content="{profile.username}'s Collection - Record Shelf" />
	<meta property="og:description" content="{stats.totalItems} records, {stats.totalArtists} artists, top genre: {stats.dominantGenre || 'Various'}" />
	<meta property="og:type" content="profile" />
	{#if profile.avatar_url}
		<meta property="og:image" content={profile.avatar_url} />
	{/if}
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="{profile.username}'s Record Collection" />
	<meta name="twitter:description" content="{stats.totalItems} records across {stats.totalArtists} artists on Record Shelf" />
</svelte:head>

<main
	id="main-content"
	class="profile"
	use:keyboardNav={{
		sectionIds: navSectionIds,
		isDrawerOpen: () => drawerOpen,
		onCloseDrawer: closeDrawer,
		onShowHelp: () => (showHelp = true)
	}}
>
	<ProfileHeader {profile} {badges} {refreshing} onRefresh={refreshCollection} />

	<SectionNav sections={navSections} />

	<LoadingBanner
		{isLoadingMore}
		{loadError}
		loaded={items.length}
		total={totalDiscogsItems}
		{loadProgress}
		onRetry={() => invalidateAll()}
	/>

	<ProfileOverview
		{stats}
		{items}
		{randomHighlights}
		onArtistClick={filterByArtist}
		onLabelClick={filterByLabel}
	/>

	<ProfileCollection {items} {stats} />

	<ProfileCharts
		{items}
		{stats}
		{decadeData}
		{genreData}
		{formatData}
		{styleData}
		onDecade={filterByDecade}
		onGenre={filterByGenre}
		onFormat={filterByFormat}
		onStyle={filterByStyle}
		onYear={filterByYear}
		{openDrawer}
	/>

	<ProfileActivity {items} />

	<ProfileInsights {duplicates} {formatUpgrades} onSelect={openDrawer} />

	<ProfileShare {stats} {items} {badges} username={profile.username} />

	{#if stats.oldestRelease || stats.newestRelease}
		<div class="grid-2col">
			<OldestNewestHighlights {stats} />
		</div>
	{/if}

	<SiteFooter />
</main>

<CollectionDrawer
	open={drawerOpen}
	title={drawerTitle}
	items={drawerItems}
	onClose={closeDrawer}
/>

<FloatingActions onHelp={() => (showHelp = true)} />
<KeyboardHelp open={showHelp} onClose={() => (showHelp = false)} />

<style>
	.profile {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	/* These layout/typography rules are :global(.profile ...) so they apply to
	   `.card`/grid/subtitle/heading elements that now live in extracted
	   components/profile/* children (Svelte would otherwise only scope them to
	   markup in this file). Scoped to .profile so other pages are unaffected. */
	:global(.profile .stats-overview) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	:global(.profile .grid-2col) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	/* Base .card styling is global (app.css); these are page-specific tweaks. */
	:global(.profile .card h2) {
		margin: 0 0 1.25rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-secondary, #666);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	:global(.profile .section-subtitle) {
		margin: -1rem 0 1.25rem;
		font-size: 0.875rem;
		color: var(--color-text-tertiary);
	}

	@media (max-width: 600px) {
		.profile {
			padding: 1rem;
		}

		:global(.profile .card) {
			padding: 1rem;
			border-radius: 12px;
		}

		:global(.profile .stats-overview) {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
