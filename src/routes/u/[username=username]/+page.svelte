<script lang="ts">
	import type { PageData } from './$types';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import StatCard from '$lib/components/StatCard.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import TimelineChart from '$lib/components/TimelineChart.svelte';
	import YearHeatmap from '$lib/components/YearHeatmap.svelte';
	import TopList from '$lib/components/TopList.svelte';
	import RecentlyAdded from '$lib/components/RecentlyAdded.svelte';
	import CoverGrid from '$lib/components/CoverGrid.svelte';
	import CollectionDrawer from '$lib/components/CollectionDrawer.svelte';
	import RandomPicker from '$lib/components/RandomPicker.svelte';
	import CollectionDNA from '$lib/components/CollectionDNA.svelte';
	import ArtistLoyalty from '$lib/components/ArtistLoyalty.svelte';
	import Milestones from '$lib/components/Milestones.svelte';
	import CollectingActivity from '$lib/components/CollectingActivity.svelte';
	import GenreEvolution from '$lib/components/GenreEvolution.svelte';
	import CollectingCalendar from '$lib/components/CollectingCalendar.svelte';
	import DayPatterns from '$lib/components/DayPatterns.svelte';
	import NewVsVintage from '$lib/components/NewVsVintage.svelte';
	import CollectionQuiz from '$lib/components/CollectionQuiz.svelte';
	import ShareableCard from '$lib/components/ShareableCard.svelte';
	import CollectionBrowser from '$lib/components/CollectionBrowser.svelte';
	import RatingsOverview from '$lib/components/RatingsOverview.svelte';
	import SectionNav from '$lib/components/SectionNav.svelte';
	import ValueEstimate from '$lib/components/ValueEstimate.svelte';
	import CollectionExport from '$lib/components/CollectionExport.svelte';
	import Recommendations from '$lib/components/Recommendations.svelte';
	import FormatDrilldown from '$lib/components/FormatDrilldown.svelte';
	import CollectionTimeline from '$lib/components/CollectionTimeline.svelte';
	import LazySection from '$lib/components/LazySection.svelte';
	import DuplicateDetector from '$lib/components/DuplicateDetector.svelte';
	import FormatUpgrades from '$lib/components/FormatUpgrades.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import FloatingActions from '$lib/components/FloatingActions.svelte';
	import { findDuplicates, groupAlbums } from '$lib/utils/albums';
	import { computeCollectionStats } from '$lib/api/discogs';
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { reveal } from '$lib/actions/reveal';
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
	<nav class="nav-bar">
		<a href="/" class="home-link">
			<svg aria-hidden="true" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/>
				<circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
				<circle cx="24" cy="24" r="3" fill="currentColor"/>
			</svg>
			<span>Record Shelf</span>
		</a>
	</nav>

	<header class="profile-header">
		<div class="user-info">
			{#if profile.avatar_url}
				<img src={profile.avatar_url} alt={profile.username} class="avatar" />
			{/if}
			<div>
				<h1>{profile.username}</h1>
				{#if profile.location}
					<p class="location">{profile.location}</p>
				{/if}
				<div class="badges">
					{#each badges as badge}
						<span class="badge {badge.style}">{badge.label}</span>
					{/each}
				</div>
			</div>
		</div>
		<div class="header-actions">
			<button
				class="refresh-btn"
				onclick={refreshCollection}
				disabled={refreshing}
				aria-label="Refresh collection"
			>
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spinning={refreshing}>
					<polyline points="23 4 23 10 17 10" />
					<polyline points="1 20 1 14 7 14" />
					<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
				</svg>
			</button>
			<a href="/u/{profile.username}/wantlist" class="discogs-link">
				Wantlist
			</a>
			<a href="https://www.discogs.com/user/{profile.username}" target="_blank" rel="noopener noreferrer" class="discogs-link">
				Discogs
			</a>
			<a href="/settings" class="settings-btn" aria-label="Settings">
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3" />
					<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
				</svg>
			</a>
		</div>
	</header>

	<SectionNav sections={navSections} />

	{#if isLoadingMore}
		<div class="loading-banner" aria-live="polite">
			<div class="loading-text">
				Loading collection: {items.length} of {totalDiscogsItems} items...
			</div>
			<div class="progress-track">
				<div class="progress-fill" style="width: {loadProgress * 100}%"></div>
			</div>
		</div>
	{:else if loadError}
		<div class="loading-banner load-error" role="alert">
			<div class="loading-text">
				Couldn't load the full collection — showing {items.length} of {totalDiscogsItems} items.
			</div>
			<button class="retry-btn" onclick={() => invalidateAll()}>Retry</button>
		</div>
	{/if}

	<section id="overview" class="stats-overview">
		<StatCard label="Records" value={stats.totalItems} />
		<StatCard label="Artists" value={stats.totalArtists} />
		<StatCard label="Labels" value={stats.totalLabels} />
		<StatCard label="Avg. Year" value={stats.averageYear ? String(stats.averageYear) : '—'} />
		<StatCard label="Year Span" value={stats.collectionSpan ? `${stats.collectionSpan} yrs` : '—'} />
		<StatCard label="Top Genre" value={stats.dominantGenre || '—'} />
	</section>

	<div class="grid-2col" use:reveal>
		<section class="card">
			<h2>Recently Added</h2>
			<RecentlyAdded items={stats.recentlyAdded} />
		</section>

		<section class="card">
			<h2>What Should I Listen To?</h2>
			<RandomPicker items={items} />
		</section>
	</div>

	<div id="top-lists" class="grid-2col" use:reveal>
		<section class="card">
			<h2>Top Artists</h2>
			<TopList items={stats.topArtists} clickable onItemClick={filterByArtist} />
		</section>

		<section class="card">
			<h2>Top Labels</h2>
			<TopList items={stats.topLabels} clickable onItemClick={filterByLabel} />
		</section>
	</div>

	<div class="grid-2col" use:reveal>
		<section class="card">
			<h2>Collection Highlights</h2>
			<p class="section-subtitle">A random selection from the collection</p>
			<CoverGrid items={randomHighlights} />
		</section>

		<section class="card">
			<h2>Collection DNA</h2>
			<CollectionDNA {stats} />
		</section>
	</div>

	<section id="collection" class="card" use:reveal>
		<h2>Full Collection</h2>
		<p class="section-subtitle">Browse, search, and filter the entire collection</p>
		<CollectionBrowser items={items} />
	</section>

	<div class="grid-2col" use:reveal>
		<section class="card">
			<h2>Collection Quiz</h2>
			<CollectionQuiz items={items} />
		</section>

		<section class="card">
			<h2>Milestones</h2>
			<Milestones items={items} />
		</section>
	</div>

	{#if stats.ratedCount > 0}
		<section class="card" use:reveal>
			<h2>Ratings</h2>
			<RatingsOverview {stats} />
		</section>
	{/if}

	{#if stats.addedByMonth.length > 1}
		<section class="card" use:reveal>
			<h2>Collection Growth</h2>
			<TimelineChart data={stats.addedByMonth} />
		</section>
	{/if}

	<section class="card" use:reveal>
		<h2>Collection Timeline</h2>
		<p class="section-subtitle">Additions month by month</p>
		<CollectionTimeline items={items} />
	</section>

	<div id="charts" class="grid-2col" use:reveal>
		<section class="card">
			<h2>By Decade</h2>
			<BarChart data={decadeData} colorful clickable onItemClick={filterByDecade} />
		</section>

		<section class="card">
			<h2>By Genre</h2>
			<DonutChart data={genreData} clickable onItemClick={filterByGenre} />
		</section>
	</div>

	<div class="grid-2col" use:reveal>
		<section class="card">
			<h2>Release Years</h2>
			<YearHeatmap data={stats.yearBreakdown} onYearClick={filterByYear} />
		</section>

		<section class="card">
			<h2>Artist Loyalty</h2>
			<p class="section-subtitle">Artists that keep showing up</p>
			<ArtistLoyalty items={items} />
		</section>
	</div>

	<div class="grid-2col">
		<section class="card">
			<h2>By Format</h2>
			<DonutChart data={formatData} size={180} thickness={35} clickable onItemClick={filterByFormat} />
		</section>

		<section class="card">
			<h2>Format Drill-Down</h2>
			<p class="section-subtitle">Expand to see sub-formats</p>
			<FormatDrilldown items={items} onFilter={(title, filtered) => openDrawer(title, filtered)} />
		</section>
	</div>

	<section class="card">
		<h2>Top Styles</h2>
		<BarChart data={styleData} horizontal colorful clickable onItemClick={filterByStyle} />
	</section>

	<LazySection height="300px">
		<div class="grid-2col">
			<section class="card">
				<h2>Genre Evolution</h2>
				<p class="section-subtitle">How taste has evolved over time</p>
				<GenreEvolution items={items} />
			</section>

			<section class="card">
				<h2>New vs Vintage</h2>
				<p class="section-subtitle">New releases or digging for classics?</p>
				<NewVsVintage items={items} />
			</section>
		</div>
	</LazySection>

	<LazySection height="250px">
		<section id="activity" class="card">
			<h2>Collecting Calendar</h2>
			<p class="section-subtitle">Activity over the past year</p>
			<CollectingCalendar items={items} />
		</section>
	</LazySection>

	<LazySection height="250px">
		<div class="grid-2col">
			<section class="card">
				<h2>Day Patterns</h2>
				<DayPatterns items={items} />
			</section>

			<section class="card">
				<h2>Collecting Activity</h2>
				<CollectingActivity items={items} />
			</section>
		</div>
	</LazySection>

	{#if duplicates.length > 0}
		<section class="card" use:reveal>
			<h2>Duplicates &amp; Variants</h2>
			<p class="section-subtitle">Albums you own more than one copy or pressing of</p>
			<DuplicateDetector groups={duplicates} onSelect={openDrawer} />
		</section>
	{/if}

	{#if formatUpgrades.length > 0}
		<section class="card" use:reveal>
			<h2>Vinyl Upgrade Picks</h2>
			<p class="section-subtitle">Owned on CD or cassette but not vinyl</p>
			<FormatUpgrades groups={formatUpgrades} onSelect={openDrawer} />
		</section>
	{/if}

	<section id="share" class="card">
		<h2>Share Stats</h2>
		<ShareableCard username={profile.username} {stats} {badges} />
	</section>

	<section class="card" use:reveal>
		<h2>Collection Value</h2>
		<ValueEstimate items={items} username={profile.username} />
	</section>

	<section class="card" use:reveal>
		<h2>Export Collection</h2>
		<p class="section-subtitle">Download collection data</p>
		<CollectionExport items={items} username={profile.username} />
	</section>

	<section class="card" use:reveal>
		<h2>Explore More</h2>
		<p class="section-subtitle">Recommendations based on this collection</p>
		<Recommendations {stats} />
	</section>

	{#if stats.oldestRelease || stats.newestRelease}
		<div class="grid-2col">
			{#if stats.oldestRelease}
				<section class="card highlight-card">
					<span class="highlight-label">Oldest Release</span>
					<div class="highlight-content">
						<img src={stats.oldestRelease.thumb || '/placeholder.svg'} alt="" class="highlight-thumb" />
						<div>
							<p class="highlight-title">{stats.oldestRelease.title}</p>
							<p class="highlight-year">{stats.oldestRelease.year}</p>
						</div>
					</div>
				</section>
			{/if}
			{#if stats.newestRelease}
				<section class="card highlight-card">
					<span class="highlight-label">Newest Release</span>
					<div class="highlight-content">
						<img src={stats.newestRelease.thumb || '/placeholder.svg'} alt="" class="highlight-thumb" />
						<div>
							<p class="highlight-title">{stats.newestRelease.title}</p>
							<p class="highlight-year">{stats.newestRelease.year}</p>
						</div>
					</div>
				</section>
			{/if}
		</div>
	{/if}

	<footer class="footer">
		<p>&copy; {new Date().getFullYear()} Record Shelf. Not affiliated with Discogs.</p>
	</footer>
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

	.nav-bar {
		margin-bottom: 1.5rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 600;
		font-size: 1rem;
		padding: 0.5rem 0.75rem 0.5rem 0.5rem;
		margin: -0.5rem;
		border-radius: 8px;
		transition: background-color 0.15s;
	}

	.home-link:hover {
		background: var(--color-bg-secondary);
	}

	.home-link svg {
		width: 28px;
		height: 28px;
		color: var(--color-primary);
	}

	.profile-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.user-info {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.avatar {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		object-fit: cover;
		border: 3px solid var(--color-border, #e0e0e0);
	}

	h1 {
		margin: 0;
		font-size: 1.75rem;
	}

	.location {
		margin: 0.25rem 0 0.5rem;
		color: var(--color-text-secondary, #666);
		font-size: 0.9375rem;
	}

	.badges {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.badge.primary {
		background: var(--gradient-brand);
		color: white;
	}

	.badge.era {
		background: linear-gradient(135deg, #f97316, #eab308);
		color: white;
	}

	.badge.format {
		background: linear-gradient(135deg, #10b981, #14b8a6);
		color: white;
	}

	.badge.size {
		background: linear-gradient(135deg, #ec4899, #f43f5e);
		color: white;
	}

	.badge.special {
		background: linear-gradient(135deg, #3b82f6, #06b6d4);
		color: white;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.refresh-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-tertiary);
		background: var(--color-bg-secondary, #f5f5f5);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
	}

	.refresh-btn:hover:not(:disabled) {
		color: var(--color-primary);
		background: var(--color-bg-tertiary, #e5e5e5);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh-btn svg {
		width: 18px;
		height: 18px;
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.discogs-link {
		padding: 0.5rem 1rem;
		background: var(--color-bg-secondary, #f5f5f5);
		border-radius: 6px;
		text-decoration: none;
		color: var(--color-text, #333);
		font-size: 0.875rem;
		transition: background-color 0.2s;
	}

	.discogs-link:hover {
		background: var(--color-bg-tertiary, #e5e5e5);
	}

	.settings-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-tertiary);
		background: var(--color-bg-secondary, #f5f5f5);
		border-radius: 6px;
		transition: background-color 0.2s, color 0.2s;
	}

	.settings-btn:hover {
		color: var(--color-primary);
		background: var(--color-bg-tertiary, #e5e5e5);
	}

	.settings-btn svg {
		width: 18px;
		height: 18px;
	}

	.loading-banner {
		margin-bottom: 1.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 12px;
	}

	.loading-text {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.5rem;
	}

	.load-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border-color: var(--color-danger, #ef4444);
	}

	.load-error .loading-text {
		margin-bottom: 0;
	}

	.retry-btn {
		flex-shrink: 0;
		padding: 0.375rem 0.875rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-bg-secondary);
		color: var(--color-text);
		cursor: pointer;
	}

	.retry-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.progress-track {
		height: 4px;
		background: var(--color-bg-secondary);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--gradient-brand);
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.stats-overview {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.grid-2col {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	/* Base .card styling is global (app.css); only page-specific tweaks here. */
	.card h2 {
		margin: 0 0 1.25rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-secondary, #666);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.section-subtitle {
		margin: -1rem 0 1.25rem;
		font-size: 0.875rem;
		color: var(--color-text-tertiary);
	}

	.highlight-card {
		background: linear-gradient(135deg, var(--color-bg-secondary, #f5f5f5), var(--color-bg-card, #fff));
	}

	.highlight-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-text-tertiary, #999);
	}

	.highlight-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.75rem;
	}

	.highlight-thumb {
		width: 64px;
		height: 64px;
		border-radius: 8px;
		object-fit: cover;
		background: var(--color-bg-secondary, #f5f5f5);
	}

	.highlight-title {
		margin: 0;
		font-weight: 600;
		font-size: 1rem;
	}

	.highlight-year {
		margin: 0.25rem 0 0;
		font-size: 1.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.footer {
		margin-top: 2rem;
		padding: 2rem 0;
		border-top: 1px solid var(--color-border, #e0e0e0);
	}

	.footer p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		text-align: center;
	}

	@media (max-width: 600px) {
		.profile {
			padding: 1rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.card {
			padding: 1rem;
			border-radius: 12px;
		}

		.stats-overview {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
