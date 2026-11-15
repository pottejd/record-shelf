<script lang="ts">
	import type { PageData } from './$types';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import type { Engine, EngineState } from '$lib/sync/engine';
	import CoverGrid from '$lib/components/CoverGrid.svelte';
	import LoadingBanner from '$lib/components/profile/LoadingBanner.svelte';
	import { goto } from '$app/navigation';
	import { createLoader } from '$lib/sync/loader.svelte';
	import { compareCollections } from '$lib/utils/compare';
	import { SIMILARITY_THRESHOLDS, SHARED_RECORDS_PREVIEW } from '$lib/constants';

	type Loader = Engine<DiscogsCollectionItem>;

	let { data }: { data: PageData } = $props();

	// One loader per user, each starting from its stored copy. They never refresh
	// on their own: the sequence below decides when each one talks to Discogs.
	const loader1 = $derived(
		createLoader<DiscogsCollectionItem>({
			kind: 'collection',
			username: data.user1.username,
			initial: data.user1.stored,
			keyOf: (i) => i.instance_id,
			autoRefresh: false
		})
	);
	const loader2 = $derived(
		createLoader<DiscogsCollectionItem>({
			kind: 'collection',
			username: data.user2.username,
			initial: data.user2.stored,
			keyOf: (i) => i.instance_id,
			autoRefresh: false
		})
	);
	let s1 = $derived(loader1.state);
	let s2 = $derived(loader2.state);

	// Loads user 1 then user 2, then refreshes each if stale, never both against
	// Discogs at once. Sequences queue behind each other; one for a retired pair of
	// loaders (the route changed) does nothing further.
	let queue: Promise<void> = Promise.resolve();
	const retired = new WeakSet<Loader>();

	function enqueueSequence(a: Loader, b: Loader) {
		const live = () => !retired.has(a) && !retired.has(b);
		queue = queue
			.then(async () => {
				for (const l of [a, b]) {
					if (!live()) return;
					if (l.state.phase !== 'done') await l.run();
					if (!live() || l.state.phase !== 'done') return;
				}
				await a.refreshIfStale();
				if (live()) await b.refreshIfStale();
			})
			.catch((e) => console.error('[record-shelf] compare: unexpected error', e));
	}

	$effect(() => {
		const a = loader1;
		const b = loader2;
		enqueueSequence(a, b);
		return () => {
			retired.add(a);
			retired.add(b);
			a.stop();
			b.stop();
		};
	});

	// The last fully loaded list of each loader. A loader's items are complete only
	// when it is done: a background re-sync or a Retry must not swap in a partial
	// list, so the comparison stays on the last full one until a fresh one lands.
	let done1 = $state.raw<{ loader: Loader; items: DiscogsCollectionItem[] } | null>(null);
	let done2 = $state.raw<{ loader: Loader; items: DiscogsCollectionItem[] } | null>(null);
	$effect(() => {
		if (s1.phase === 'done') done1 = { loader: loader1, items: s1.items };
	});
	$effect(() => {
		if (s2.phase === 'done') done2 = { loader: loader2, items: s2.items };
	});
	let full1 = $derived(done1?.loader === loader1 ? done1.items : null);
	let full2 = $derived(done2?.loader === loader2 ? done2.items : null);

	let comparison = $derived(full1 && full2 ? compareCollections(full1, full2) : null);

	function userView(username: string, s: EngineState<DiscogsCollectionItem>) {
		return { profile: s.profile ?? { username, avatar_url: '' }, totalItems: s.totalItems };
	}
	let user1 = $derived(userView(data.user1.username, s1));
	let user2 = $derived(userView(data.user2.username, s2));

	// A user that does not exist or keeps the collection private: no comparison.
	let blocked = $derived(
		[
			{ username: data.user1.username, code: s1.error?.code },
			{ username: data.user2.username, code: s2.error?.code }
		].filter((u) => u.code === 'NOT_FOUND' || u.code === 'PRIVATE')
	);

	// The token cookie is missing or rejected: send the visitor to settings.
	$effect(() => {
		const codes = [s1.error?.code, s2.error?.code];
		if (codes.includes('TOKEN_REQUIRED') || codes.includes('BAD_TOKEN')) {
			goto(
				`/settings?redirect=/compare/${encodeURIComponent(data.user1.username)}/${encodeURIComponent(data.user2.username)}`,
				{ replaceState: true }
			);
		}
	});

	function getSimilarityLabel(score: number): string {
		if (score >= SIMILARITY_THRESHOLDS.TASTE_TWINS) return 'Taste twins!';
		if (score >= SIMILARITY_THRESHOLDS.SIMILAR) return 'Similar vibes';
		if (score >= SIMILARITY_THRESHOLDS.SOME_OVERLAP) return 'Some overlap';
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

{#snippet banners()}
	<LoadingBanner
		state={s1}
		label="{data.user1.username}'s collection"
		onRetry={() => enqueueSequence(loader1, loader2)}
	/>
	<LoadingBanner
		state={s2}
		label="{data.user2.username}'s collection"
		onRetry={() => enqueueSequence(loader1, loader2)}
	/>
{/snippet}

{#if blocked.length > 0}
<main id="main-content" class="compare-results">
	{#each blocked as u}
		<div class="error-note blocked" role="alert">
			{#if u.code === 'NOT_FOUND'}
				No Discogs user named "{u.username}".
			{:else}
				{u.username}'s collection is private.
			{/if}
		</div>
	{/each}
</main>
{:else if comparison}
<main id="main-content" class="compare-results">
	{@render banners()}

	<header class="matchup">
		<div class="user-card user-1">
			{#if user1.profile.avatar_url}
				<img src={user1.profile.avatar_url} alt="" class="avatar cover" />
			{/if}
			<a href="/u/{user1.profile.username}" class="username"><span class="swatch swatch-1" aria-hidden="true"></span>{user1.profile.username}</a>
			<span class="item-count">{user1.totalItems} records</span>
		</div>

		<div class="vs-badge">
			<span class="similarity-score">{comparison.similarityScore}%</span>
			<span class="similarity-label">{getSimilarityLabel(comparison.similarityScore)}</span>
		</div>

		<div class="user-card user-2">
			{#if user2.profile.avatar_url}
				<img src={user2.profile.avatar_url} alt="" class="avatar cover" />
			{/if}
			<a href="/u/{user2.profile.username}" class="username"><span class="swatch swatch-2" aria-hidden="true"></span>{user2.profile.username}</a>
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

	{#snippet legend()}
		<div class="legend">
			<span class="legend-item"><span class="swatch swatch-1" aria-hidden="true"></span>{user1.profile.username}</span>
			<span class="legend-item"><span class="swatch swatch-2" aria-hidden="true"></span>{user2.profile.username}</span>
		</div>
	{/snippet}

	{#if comparison.sharedArtists.length > 0}
		<section class="section">
			<h2>Shared artists</h2>
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
		{@const max = Math.max(1, ...comparison.genreOverlap.flatMap((g) => [g.count1, g.count2]))}
		<section class="section">
			<h2>Genre comparison</h2>
			{@render legend()}
			<div class="genre-bars">
				{#each comparison.genreOverlap as g}
					<div class="genre-row">
						<div class="genre-bar-left">
							<div class="bar bar-1" style="--v: {g.count1 / max}"></div>
							{#if g.count1 > 0}<span class="bar-label">{g.count1}</span>{/if}
						</div>
						<span class="genre-name">{g.genre}</span>
						<div class="genre-bar-right">
							<div class="bar bar-2" style="--v: {g.count2 / max}"></div>
							{#if g.count2 > 0}<span class="bar-label">{g.count2}</span>{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if comparison.decades1 && comparison.decades2}
		{@const allDecades = [...new Set([...Object.keys(comparison.decades1), ...Object.keys(comparison.decades2)])].sort()}
		{@const max = Math.max(1, ...Object.values(comparison.decades1), ...Object.values(comparison.decades2))}
		<section class="section">
			<h2>Decade comparison</h2>
			{@render legend()}
			<div class="decade-chart">
				{#each allDecades as decade}
					{@const v1 = comparison.decades1[decade] || 0}
					{@const v2 = comparison.decades2[decade] || 0}
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
						<span class="decade-values">
							<span><span class="visually-hidden">{user1.profile.username}: </span>{v1}</span>
							<span><span class="visually-hidden">{user2.profile.username}: </span>{v2}</span>
						</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if comparison.overlap.length > 0}
		<section class="section">
			<h2>Records both own</h2>
			<CoverGrid items={comparison.overlap.slice(0, SHARED_RECORDS_PREVIEW)} />
		</section>
	{/if}

	<div class="grid-2col">
		<section class="section">
			<h2>Only {user1.profile.username} has</h2>
			{#if comparison.uniqueTo1.length > 0}
				<CoverGrid items={comparison.uniqueTo1} />
			{:else}
				<p class="no-data">No unique records found</p>
			{/if}
		</section>

		<section class="section">
			<h2>Only {user2.profile.username} has</h2>
			{#if comparison.uniqueTo2.length > 0}
				<CoverGrid items={comparison.uniqueTo2} />
			{:else}
				<p class="no-data">No unique records found</p>
			{/if}
		</section>
	</div>

	<div class="actions">
		<a href="/compare" class="btn btn-secondary">Compare Different Users</a>
	</div>
</main>
{:else}
<main id="main-content" class="compare-results">
	{@render banners()}
</main>
{/if}

<style>
	.compare-results {
		padding-top: 56px;
	}

	.blocked + .blocked {
		margin-top: 16px;
	}

	.matchup {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 24px 40px;
		margin-bottom: 40px;
	}

	.user-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		min-width: 0;
	}

	.user-2 {
		align-items: flex-end;
		text-align: right;
	}

	.avatar {
		width: 64px;
		height: 64px;
	}

	.username {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		max-width: 100%;
		font-size: 32px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.item-count {
		font-size: 17px;
		color: var(--muted);
	}

	.vs-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-align: center;
	}

	.similarity-score {
		font-size: 64px;
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1;
	}

	.similarity-label {
		font-size: 17px;
		color: var(--muted);
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		margin-bottom: var(--section-gap);
		border-top: 1px solid var(--hairline);
		border-bottom: 1px solid var(--hairline);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 0;
	}

	.stat-card + .stat-card {
		padding-left: 24px;
		border-left: 1px solid var(--hairline);
	}

	.stat-value {
		font-size: 34px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.stat-label {
		font-size: 15px;
		color: var(--muted);
	}

	.grid-2col {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 0 64px;
	}

	.artist-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 28px;
	}

	.artist-tag {
		font-size: 18px;
		font-weight: 600;
	}

	.more-tag {
		font-size: 18px;
		color: var(--muted);
	}

	.swatch {
		display: inline-block;
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.swatch-1,
	.bar-1 {
		background: var(--chart-1);
	}

	.swatch-2,
	.bar-2 {
		background: var(--chart-2);
	}

	.legend {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 4px 24px;
		margin-bottom: 16px;
		font-size: 15px;
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.genre-bars {
		display: flex;
		flex-direction: column;
	}

	.genre-row {
		display: grid;
		grid-template-columns: 1fr 140px 1fr;
		gap: 12px;
		align-items: center;
		min-height: 36px;
		border-top: 1px solid var(--hairline);
	}

	.genre-row:first-child {
		border-top: 0;
	}

	.genre-bar-left,
	.genre-bar-right {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.genre-bar-left {
		flex-direction: row-reverse;
	}

	/* --v is this count over the largest count in the chart; 56px is kept for the number. */
	.bar {
		flex: 0 0 auto;
		width: calc((100% - 56px) * var(--v));
		height: 20px;
	}

	.bar-label {
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.genre-name {
		font-size: 15px;
		font-weight: 500;
		text-align: center;
		overflow-wrap: anywhere;
		line-height: 1.2;
	}

	.decade-chart {
		display: flex;
		gap: 8px;
		align-items: flex-end;
		padding-top: 8px;
		overflow-x: auto;
	}

	/* Positioned so the visually hidden names stay inside the scrolling chart. */
	.decade-col {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 44px;
		max-width: 120px;
	}

	.decade-bars {
		display: flex;
		gap: 2px;
		align-items: flex-end;
		height: 150px;
		width: 100%;
		border-bottom: 1px solid var(--ink);
	}

	.decade-bar {
		flex: 1;
	}

	.decade-label {
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
	}

	.decade-values {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 13px;
		line-height: 1.3;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.no-data {
		color: var(--muted);
		margin: 0;
	}

	.actions {
		margin-top: 8px;
	}

	@media (max-width: 699px) {
		.compare-results {
			padding-top: 32px;
		}

		.matchup {
			grid-template-columns: 1fr;
		}

		.vs-badge {
			order: -1;
			align-items: flex-start;
			text-align: left;
		}

		.user-2 {
			align-items: flex-start;
			text-align: left;
		}

		.username {
			font-size: 28px;
		}

		.stats-row {
			grid-template-columns: 1fr;
		}

		.stat-card + .stat-card {
			padding-left: 0;
			border-left: 0;
			border-top: 1px solid var(--hairline);
		}

		.genre-row {
			grid-template-columns: 1fr 76px 1fr;
			gap: 6px;
		}

		.genre-name {
			font-size: 13px;
		}

		.bar {
			width: calc((100% - 40px) * var(--v));
		}

		.bar-label {
			font-size: 13px;
		}

		.decade-chart {
			gap: 4px;
		}

		.decade-col {
			min-width: 36px;
		}

		.decade-label {
			font-size: 13px;
		}

		.actions .btn {
			width: 100%;
		}
	}
</style>
