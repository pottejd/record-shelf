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

	export let data: PageData;

	$: ({ collection } = data);
	$: ({ profile, stats } = collection);

	// Drawer state
	let drawerOpen = false;
	let drawerTitle = '';
	let drawerItems: DiscogsCollectionItem[] = [];

	function openDrawer(title: string, items: DiscogsCollectionItem[]) {
		drawerTitle = title;
		drawerItems = items;
		drawerOpen = true;
	}

	function closeDrawer() {
		drawerOpen = false;
	}

	// Filter functions
	function filterByDecade(label: string) {
		const decade = label.replace('s', '');
		const decadeStart = parseInt(decade);
		const filtered = collection.items.filter((item) => {
			const year = item.basic_information.year;
			return year >= decadeStart && year < decadeStart + 10;
		});
		openDrawer(`${label}`, filtered);
	}

	function filterByGenre(genre: string) {
		const filtered = collection.items.filter((item) =>
			item.basic_information.genres?.includes(genre)
		);
		openDrawer(genre, filtered);
	}

	function filterByFormat(format: string) {
		const filtered = collection.items.filter((item) =>
			item.basic_information.formats?.some((f) => f.name === format)
		);
		openDrawer(format, filtered);
	}

	function filterByStyle(style: string) {
		const filtered = collection.items.filter((item) =>
			item.basic_information.styles?.includes(style)
		);
		openDrawer(style, filtered);
	}

	function filterByFormatDetail(detail: string) {
		const filtered = collection.items.filter((item) =>
			item.basic_information.formats?.some((f) =>
				f.descriptions?.includes(detail) || f.text === detail
			)
		);
		openDrawer(detail, filtered);
	}

	function filterByArtist(artistName: string) {
		const filtered = collection.items.filter((item) =>
			item.basic_information.artists.some((a) => a.name === artistName)
		);
		openDrawer(artistName, filtered);
	}

	function filterByLabel(labelName: string) {
		const filtered = collection.items.filter((item) =>
			item.basic_information.labels?.some((l) => l.name === labelName)
		);
		openDrawer(labelName, filtered);
	}

	function filterByYear(year: number) {
		const filtered = collection.items.filter((item) =>
			item.basic_information.year === year
		);
		openDrawer(String(year), filtered);
	}

	$: decadeData = Object.entries(stats.decadeBreakdown)
		.map(([decade, count]) => ({ label: `${decade}s`, value: count }))
		.sort((a, b) => a.label.localeCompare(b.label));

	$: genreData = Object.entries(stats.genreBreakdown)
		.map(([genre, count]) => ({ label: genre, value: count }))
		.sort((a, b) => b.value - a.value)
		.slice(0, 8);

	$: formatData = Object.entries(stats.formatBreakdown)
		.map(([format, count]) => ({ label: format, value: count }))
		.sort((a, b) => b.value - a.value);

	$: styleData = Object.entries(stats.styleBreakdown)
		.map(([style, count]) => ({ label: style, value: count }))
		.sort((a, b) => b.value - a.value)
		.slice(0, 12);

	$: formatDetailData = Object.entries(stats.formatDetailBreakdown)
		.map(([format, count]) => ({ label: format, value: count }))
		.sort((a, b) => b.value - a.value)
		.slice(0, 10);

	// Random highlights - shuffle the collection for variety
	function shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	$: randomHighlights = shuffleArray(collection.items).slice(0, 12);

	// Calculate fun personality badges
	interface Badge {
		label: string;
		style: 'primary' | 'era' | 'format' | 'size' | 'special';
	}

	$: badges = calculateBadges(stats, collection.items);

	function calculateBadges(s: typeof stats, items: typeof collection.items): Badge[] {
		const result: Badge[] = [];

		// Collector type (Explorer, Devotee, Eclectic, Curator)
		if (s.uniqueArtistRatio > 0.8) result.push({ label: 'Explorer', style: 'primary' });
		else if (s.uniqueArtistRatio < 0.4) result.push({ label: 'Devotee', style: 'primary' });
		else if (Object.keys(s.genreBreakdown).length > 10) result.push({ label: 'Eclectic', style: 'primary' });
		else result.push({ label: 'Curator', style: 'primary' });

		// Era badge
		if (s.dominantDecade) {
			const decade = parseInt(s.dominantDecade);
			if (decade >= 2010) result.push({ label: 'Modern era', style: 'era' });
			else if (decade >= 2000) result.push({ label: 'Y2K era', style: 'era' });
			else if (decade >= 1990) result.push({ label: '90s kid', style: 'era' });
			else if (decade >= 1980) result.push({ label: '80s fan', style: 'era' });
			else if (decade >= 1970) result.push({ label: '70s purist', style: 'era' });
			else if (decade >= 1960) result.push({ label: '60s head', style: 'era' });
			else result.push({ label: 'Vintage hunter', style: 'era' });
		}

		// Collection size badge
		if (s.totalItems >= 1000) result.push({ label: 'Hoarder', style: 'size' });
		else if (s.totalItems >= 500) result.push({ label: 'Serious collector', style: 'size' });
		else if (s.totalItems >= 100) result.push({ label: 'Growing collection', style: 'size' });
		else if (s.totalItems >= 25) result.push({ label: 'Getting started', style: 'size' });

		// Format badge
		const vinylCount = s.formatBreakdown['Vinyl'] || 0;
		const cdCount = s.formatBreakdown['CD'] || 0;
		const cassetteCount = s.formatBreakdown['Cassette'] || 0;
		const vinylRatio = vinylCount / s.totalItems;
		const cdRatio = cdCount / s.totalItems;

		if (vinylRatio > 0.8) result.push({ label: 'Vinyl purist', style: 'format' });
		else if (vinylRatio > 0.5) result.push({ label: 'Vinyl lover', style: 'format' });
		else if (cdRatio > 0.5) result.push({ label: 'CD collector', style: 'format' });
		else if (cassetteCount > 10) result.push({ label: 'Tape head', style: 'format' });

		// Genre focus badge
		if (s.dominantGenre) {
			const topGenreCount = s.genreBreakdown[s.dominantGenre] || 0;
			const genreRatio = topGenreCount / s.totalItems;
			if (genreRatio > 0.5) {
				result.push({ label: `${s.dominantGenre} specialist`, style: 'special' });
			}
		}

		// Year span badge
		if (s.collectionSpan && s.collectionSpan >= 50) {
			result.push({ label: 'Time traveler', style: 'special' });
		}

		// Oldest release badge
		if (s.oldestRelease && s.oldestRelease.year && s.oldestRelease.year < 1970) {
			result.push({ label: 'Crate digger', style: 'special' });
		}

		// Label diversity
		if (s.totalLabels > 100) {
			result.push({ label: 'Label explorer', style: 'special' });
		}

		return result;
	}
</script>

<svelte:head>
	<title>{profile.username}'s Collection - Record Shelf</title>
	<meta
		name="description"
		content="Explore {profile.username}'s record collection: {stats.totalItems} items across {stats.totalArtists} artists"
	/>
</svelte:head>

<main class="profile">
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
			<a href="https://www.discogs.com/user/{profile.username}" target="_blank" rel="noopener" class="discogs-link">
				View on Discogs
			</a>
			<a href="/settings" class="settings-btn" aria-label="Settings">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3" />
					<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
				</svg>
			</a>
		</div>
	</header>

	<section class="stats-overview">
		<StatCard label="Records" value={stats.totalItems} />
		<StatCard label="Artists" value={stats.totalArtists} />
		<StatCard label="Labels" value={stats.totalLabels} />
		<StatCard label="Avg. Year" value={stats.averageYear ? String(stats.averageYear) : '—'} />
		<StatCard label="Year Span" value={stats.collectionSpan ? `${stats.collectionSpan} yrs` : '—'} />
		<StatCard label="Top Genre" value={stats.dominantGenre || '—'} />
	</section>

	<div class="grid-2col">
		<section class="card">
			<h2>Recently Added</h2>
			<RecentlyAdded items={stats.recentlyAdded} />
		</section>

		<section class="card">
			<h2>What Should I Listen To?</h2>
			<RandomPicker items={collection.items} />
		</section>
	</div>

	<div class="grid-2col">
		<section class="card">
			<h2>Top Artists</h2>
			<TopList items={stats.topArtists} clickable onItemClick={filterByArtist} />
		</section>

		<section class="card">
			<h2>Top Labels</h2>
			<TopList items={stats.topLabels} clickable onItemClick={filterByLabel} />
		</section>
	</div>

	<div class="grid-2col">
		<section class="card">
			<h2>Collection Highlights</h2>
			<p class="section-subtitle">A random selection from your collection</p>
			<CoverGrid items={randomHighlights} />
		</section>

		<section class="card">
			<h2>Collection DNA</h2>
			<CollectionDNA {stats} />
		</section>
	</div>

	<section class="card">
		<h2>Full Collection</h2>
		<p class="section-subtitle">Browse, search, and filter the entire collection</p>
		<CollectionBrowser items={collection.items} />
	</section>

	<div class="grid-2col">
		<section class="card">
			<h2>Collection Quiz</h2>
			<CollectionQuiz items={collection.items} />
		</section>

		<section class="card">
			<h2>Milestones</h2>
			<Milestones items={collection.items} />
		</section>
	</div>

	{#if stats.addedByMonth.length > 1}
		<section class="card">
			<h2>Collection Growth</h2>
			<TimelineChart data={stats.addedByMonth} />
		</section>
	{/if}

	<div class="grid-2col">
		<section class="card">
			<h2>By Decade</h2>
			<BarChart data={decadeData} colorful clickable onItemClick={filterByDecade} />
		</section>

		<section class="card">
			<h2>By Genre</h2>
			<DonutChart data={genreData} clickable onItemClick={filterByGenre} />
		</section>
	</div>

	<div class="grid-2col">
		<section class="card">
			<h2>Release Years</h2>
			<YearHeatmap data={stats.yearBreakdown} onYearClick={filterByYear} />
		</section>

		<section class="card">
			<h2>Artist Loyalty</h2>
			<p class="section-subtitle">Artists you keep coming back to</p>
			<ArtistLoyalty items={collection.items} />
		</section>
	</div>

	<div class="grid-2col">
		<section class="card">
			<h2>By Format</h2>
			<DonutChart data={formatData} size={180} thickness={35} clickable onItemClick={filterByFormat} />
		</section>

		<section class="card">
			<h2>Format Details</h2>
			<BarChart data={formatDetailData} horizontal colorful clickable onItemClick={filterByFormatDetail} />
		</section>
	</div>

	<section class="card">
		<h2>Top Styles</h2>
		<BarChart data={styleData} horizontal colorful clickable onItemClick={filterByStyle} />
	</section>

	<div class="grid-2col">
		<section class="card">
			<h2>Genre Evolution</h2>
			<p class="section-subtitle">How your taste has evolved over time</p>
			<GenreEvolution items={collection.items} />
		</section>

		<section class="card">
			<h2>New vs Vintage</h2>
			<p class="section-subtitle">Are you buying new releases or digging for classics?</p>
			<NewVsVintage items={collection.items} />
		</section>
	</div>

	<section class="card">
		<h2>Collecting Calendar</h2>
		<p class="section-subtitle">Your activity over the past year</p>
		<CollectingCalendar items={collection.items} />
	</section>

	<div class="grid-2col">
		<section class="card">
			<h2>Day Patterns</h2>
			<DayPatterns items={collection.items} />
		</section>

		<section class="card">
			<h2>Collecting Activity</h2>
			<CollectingActivity items={collection.items} />
		</section>
	</div>

	<section class="card">
		<h2>Share Your Stats</h2>
		<ShareableCard username={profile.username} {stats} {badges} />
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
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
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

	.card {
		background: var(--color-bg-card, #fff);
		border: 1px solid var(--color-border, #e0e0e0);
		border-radius: 16px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

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
