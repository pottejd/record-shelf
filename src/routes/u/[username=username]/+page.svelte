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
	import BrandNav from '$lib/components/BrandNav.svelte';
	import SkeletonProfile from '$lib/components/SkeletonProfile.svelte';
	import { findDuplicates, groupAlbums } from '$lib/utils/albums';
	import { computeCollectionStats } from '$lib/api/discogs';
	import { goto } from '$app/navigation';
	import { createLoader } from '$lib/sync/loader.svelte';
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

	// Random highlights: sampled once per collection, the first time records are on
	// screen, rather than on every batch the loader appends (which reshuffled the
	// grid and re-downloaded covers each time).
	let randomHighlights = $state<DiscogsCollectionItem[]>([]);

	// One loader per username: it starts from the stored copy and fetches the rest
	// through the sync API. Navigating to another user stops the old one.
	const loader = $derived(
		createLoader<DiscogsCollectionItem>({
			kind: 'collection',
			username: data.username,
			initial: data.stored,
			keyOf: (i) => i.instance_id
		})
	);
	$effect(() => {
		const l = loader;
		randomHighlights = [];
		l.run();
		return () => l.stop();
	});
	let s = $derived(loader.state);
	let items = $derived(s.items);
	let stats = $derived(computeCollectionStats(items));

	let profile = $derived(s.profile);
	let totalDiscogsItems = $derived(s.totalItems);

	$effect(() => {
		if (randomHighlights.length === 0 && items.length > 0) {
			randomHighlights = sampleN(items, GRID_PREVIEW_LIMIT);
		}
	});

	// The token cookie is missing or rejected: send the visitor to settings.
	$effect(() => {
		const code = s.error?.code;
		if (code === 'TOKEN_REQUIRED' || code === 'BAD_TOKEN') {
			goto(`/settings?redirect=/u/${encodeURIComponent(data.username)}`, { replaceState: true });
		}
	});

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
	{#if profile}
		<title>{profile.username}'s Collection - Record Shelf</title>
		<meta
			name="description"
			content="{profile.username}'s record collection: {totalDiscogsItems} records on Record Shelf"
		/>
		<meta property="og:title" content="{profile.username}'s Collection - Record Shelf" />
		<meta property="og:description" content="{profile.username}'s record collection: {totalDiscogsItems} records on Record Shelf" />
		<meta property="og:type" content="profile" />
		{#if profile.avatar_url}
			<meta property="og:image" content={profile.avatar_url} />
		{/if}
		<meta name="twitter:card" content="summary" />
		<meta name="twitter:title" content="{profile.username}'s Record Collection" />
		<meta name="twitter:description" content="{profile.username}'s record collection: {totalDiscogsItems} records on Record Shelf" />
	{:else}
		<title>Record Shelf</title>
	{/if}
</svelte:head>

{#if s.error?.code === 'NOT_FOUND' || s.error?.code === 'PRIVATE'}
<main id="main-content" class="profile">
	<BrandNav />
	<div class="card" role="alert">
		{#if s.error.code === 'NOT_FOUND'}
			No Discogs user named "{data.username}".
		{:else}
			{data.username}'s collection is private.
		{/if}
	</div>
	<SiteFooter />
</main>
{:else if profile}
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
	<ProfileHeader
		{profile}
		{badges}
		refreshing={s.phase === 'loading' || s.phase === 'waiting' || s.phase === 'refreshing'}
		onRefresh={() => loader.refresh()}
	/>

	<SectionNav sections={navSections} />

	<LoadingBanner state={s} onRetry={() => loader.run()} />

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
{:else}
<main id="main-content" class="profile">
	<BrandNav />
	<LoadingBanner state={s} onRetry={() => loader.run()} />
	<SkeletonProfile />
</main>
{/if}

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
