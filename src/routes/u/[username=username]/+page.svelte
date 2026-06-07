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
	import DuplicateDetector from '$lib/components/DuplicateDetector.svelte';
	import FormatUpgrades from '$lib/components/FormatUpgrades.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import FloatingActions from '$lib/components/FloatingActions.svelte';
	import ProfileHeader from '$lib/components/profile/ProfileHeader.svelte';
	import LoadingBanner from '$lib/components/profile/LoadingBanner.svelte';
	import OldestNewestHighlights from '$lib/components/profile/OldestNewestHighlights.svelte';
	import ProfileActivity from '$lib/components/profile/ProfileActivity.svelte';
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

	<ProfileActivity {items} />

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
			<OldestNewestHighlights {stats} />
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

		:global(.profile .card) {
			padding: 1rem;
			border-radius: 12px;
		}

		:global(.profile .stats-overview) {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
