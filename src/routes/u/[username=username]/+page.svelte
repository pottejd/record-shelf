<script lang="ts">
	import type { PageData } from './$types';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import CollectionDrawer from '$lib/components/CollectionDrawer.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import LoadingBanner from '$lib/components/profile/LoadingBanner.svelte';
	import ProfileTabs from '$lib/components/profile/ProfileTabs.svelte';
	import TabOverview from '$lib/components/profile/TabOverview.svelte';
	import TabRecords from '$lib/components/profile/TabRecords.svelte';
	import TabCharts from '$lib/components/profile/TabCharts.svelte';
	import TabActivity from '$lib/components/profile/TabActivity.svelte';
	import TabExtras from '$lib/components/profile/TabExtras.svelte';
	import SkeletonProfile from '$lib/components/SkeletonProfile.svelte';
	import { findDuplicates, groupAlbums } from '$lib/utils/albums';
	import { computeCollectionStats } from '$lib/api/discogs';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { createLoader } from '$lib/sync/loader.svelte';
	import { useFrame } from '$lib/frame/frame.svelte';
	import { keyboardNav } from '$lib/actions/keyboardNav';
	import { tabFromUrl, tabHref, type TabId } from '$lib/profile/tabs';
	import { scrollBehavior } from '$lib/utils/motion';
	import { sampleN } from '$lib/utils/array';
	import { toChartData } from '$lib/utils/chart';
	import { calculateBadges } from '$lib/utils/badges';
	import { CHART_LIMITS, GRID_PREVIEW_LIMIT } from '$lib/constants';

	let { data }: { data: PageData } = $props();

	// The open tab comes from the address. Nothing the loader uses depends on it,
	// so switching tabs never restarts the load.
	let tab = $derived(tabFromUrl(page.url));

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

	// The refresh button and "Keyboard shortcuts" live in the shared top bar and
	// footer; hand them this page's actions while it is on screen.
	const frame = useFrame();
	$effect(() => {
		const l = loader;
		const ready = profile != null && !s.error;
		frame.refresh.run = ready ? () => l.refresh() : null;
		frame.help = ready ? () => (showHelp = true) : null;
		return () => {
			frame.refresh.run = null;
			frame.help = null;
		};
	});
	$effect(() => {
		frame.refresh.busy = s.phase === 'loading' || s.phase === 'waiting' || s.phase === 'refreshing';
		return () => {
			frame.refresh.busy = false;
		};
	});

	/** Opens a tab (a new history step, so Back returns to the tab before). */
	function openTab(next: TabId) {
		if (next !== tab) goto(tabHref(page.url, next), { noScroll: true });
	}

	/** Opens Records and focuses its search once the tab is on screen. */
	async function openSearch() {
		if (tab !== 'records') await goto(tabHref(page.url, 'records'), { noScroll: true, keepFocus: true });
		await tick();
		const input = document.querySelector<HTMLInputElement>('#records input[type="search"]');
		if (input) {
			input.focus();
			input.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
		}
	}

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
		<title>{profile.username}'s shelf - Record Shelf</title>
		<meta
			name="description"
			content="{profile.username}'s record collection: {totalDiscogsItems} records on Record Shelf"
		/>
		<meta property="og:title" content="{profile.username}'s shelf - Record Shelf" />
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
	<div class="section notice" role="alert">
		{#if s.error.code === 'NOT_FOUND'}
			No Discogs user named "{data.username}".
		{:else}
			{data.username}'s collection is private.
		{/if}
	</div>
</main>
{:else if profile}
<main
	id="main-content"
	class="profile"
	use:keyboardNav={{
		tab: () => tab,
		onTab: openTab,
		onSearch: openSearch,
		isDrawerOpen: () => drawerOpen,
		onCloseDrawer: closeDrawer,
		onShowHelp: () => (showHelp = true)
	}}
>
	<h1>{profile.username}'s shelf</h1>

	<ProfileTabs active={tab} url={page.url} />

	<LoadingBanner state={s} onRetry={() => loader.run()} />

	<div id={tab} class="tab-body">
		{#if tab === 'records'}
			<TabRecords {items} {duplicates} {formatUpgrades} onSelect={openDrawer} />
		{:else if tab === 'charts'}
			<TabCharts
				{items}
				{stats}
				{genreData}
				{formatData}
				{styleData}
				onGenre={filterByGenre}
				onFormat={filterByFormat}
				onStyle={filterByStyle}
				onYear={filterByYear}
				onLabelClick={filterByLabel}
				{openDrawer}
			/>
		{:else if tab === 'activity'}
			<TabActivity {items} {stats} />
		{:else if tab === 'extras'}
			<TabExtras {items} {stats} {badges} username={profile.username} />
		{:else}
			<TabOverview
				{stats}
				{items}
				{badges}
				{randomHighlights}
				{decadeData}
				onDecade={filterByDecade}
				onArtistClick={filterByArtist}
				{openDrawer}
			/>
		{/if}
	</div>
</main>

<CollectionDrawer
	open={drawerOpen}
	title={drawerTitle}
	items={drawerItems}
	onClose={closeDrawer}
/>

<KeyboardHelp open={showHelp} onClose={() => (showHelp = false)} />
{:else}
<main id="main-content" class="profile">
	<LoadingBanner state={s} onRetry={() => loader.run()} />
	<SkeletonProfile />
</main>
{/if}

<style>
	.profile {
		padding-bottom: var(--section-gap);
	}

	h1 {
		margin: 56px 0 0;
		overflow-wrap: anywhere;
	}

	.notice {
		margin-top: 56px;
	}

	/* A tab is a column of sections; .cols puts two columns side by side, each a
	   .stack of sections (or a .col-half section). The section gap does the spacing,
	   so sections drop their own bottom margin here. */
	.tab-body {
		display: flex;
		flex-direction: column;
		gap: var(--section-gap);
		margin-top: 48px;
	}

	.tab-body :global(.section) {
		margin-bottom: 0;
	}

	.tab-body :global(.stack) {
		display: flex;
		flex-direction: column;
		gap: var(--section-gap);
	}

	.tab-body :global(.col-half) {
		flex: 1 1 400px;
		min-width: 0;
	}

	.tab-body :global(.section-subtitle) {
		margin: -8px 0 16px;
		font-size: 15px;
		color: var(--muted);
	}

	@media (max-width: 699px) {
		h1,
		.notice {
			margin-top: 32px;
		}
	}
</style>
