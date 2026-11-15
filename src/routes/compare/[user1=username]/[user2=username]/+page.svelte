<script lang="ts">
	import type { PageData } from './$types';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import type { Engine, EngineState } from '$lib/sync/engine';
	import CoverGrid from '$lib/components/CoverGrid.svelte';
	import LoadingBanner from '$lib/components/profile/LoadingBanner.svelte';
	import { goto } from '$app/navigation';
	import { createLoader } from '$lib/sync/loader.svelte';
	import { compareCollections } from '$lib/utils/compare';
	import { chartColour } from '$lib/utils/chart';
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

	// The first person is always chart colour 1 and the second chart colour 2.
	const COLOUR_1 = chartColour(0);
	const COLOUR_2 = chartColour(1);

	type PairRow = { label: string; v1: number; v2: number };

	let genreRows = $derived<PairRow[]>(
		(comparison?.genreOverlap ?? []).map((g) => ({ label: g.genre, v1: g.count1, v2: g.count2 }))
	);
	let decadeRows = $derived.by<PairRow[]>(() => {
		if (!comparison?.decades1 || !comparison?.decades2) return [];
		const d1 = comparison.decades1;
		const d2 = comparison.decades2;
		return [...new Set([...Object.keys(d1), ...Object.keys(d2)])]
			.sort()
			.map((decade) => ({ label: decade, v1: d1[decade] || 0, v2: d2[decade] || 0 }));
	});
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

{#snippet title()}
	<h1>{user1.profile.username} <span class="vs">vs</span> {user2.profile.username}</h1>
{/snippet}

<!-- Two people side by side: a heading row names each half beside its swatch, and
     every number sits in its person's half (and is named for screen readers), so
     no number depends on colour to say whose it is. -->
{#snippet pairChart(caption: string, rows: PairRow[])}
	{@const max = Math.max(1, ...rows.flatMap((r) => [r.v1, r.v2]))}
	<div class="pair-chart">
		<p class="visually-hidden">{caption}</p>
		<div class="pair-head legend">
			<span class="who who-1"><span class="swatch" aria-hidden="true" style:background={COLOUR_1}></span>{user1.profile.username}</span>
			<span></span>
			<span class="who who-2">{user2.profile.username}<span class="swatch" aria-hidden="true" style:background={COLOUR_2}></span></span>
		</div>
		{#each rows as r (r.label)}
			<div class="pair-row">
				<div class="side side-1">
					<span class="num"><span class="visually-hidden">{`${user1.profile.username}: `}</span>{r.v1.toLocaleString()}</span>
					<div class="track"><div class="bar" style:--v={r.v1 / max} style:background={COLOUR_1}></div></div>
				</div>
				<span class="pair-label">{r.label}</span>
				<div class="side side-2">
					<div class="track"><div class="bar" style:--v={r.v2 / max} style:background={COLOUR_2}></div></div>
					<span class="num"><span class="visually-hidden">{`${user2.profile.username}: `}</span>{r.v2.toLocaleString()}</span>
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#if blocked.length > 0}
<main id="main-content" class="compare-results">
	<div class="section notice" role="alert">
		{#each blocked as u}
			<p>
				{#if u.code === 'NOT_FOUND'}
					No Discogs user named "{u.username}".
				{:else}
					{u.username}'s collection is private.
				{/if}
			</p>
		{/each}
	</div>
</main>
{:else if comparison}
<main id="main-content" class="compare-results">
	{@render title()}
	<p class="lead">{getSimilarityLabel(comparison.similarityScore)}</p>

	<div class="body">
		{@render banners()}

		<div class="cols">
			<section class="section col-narrow">
				<h2>Head-to-head</h2>
				<dl class="facts">
					<div class="row">
						<dt>Similarity</dt>
						<dd class="figure">{comparison.similarityScore}%</dd>
					</div>
					<div class="row">
						<dt class="who"><span class="swatch" aria-hidden="true" style:background={COLOUR_1}></span><a href="/u/{user1.profile.username}">{user1.profile.username}</a></dt>
						<dd>{user1.totalItems.toLocaleString()} records</dd>
					</div>
					<div class="row">
						<dt class="who"><span class="swatch" aria-hidden="true" style:background={COLOUR_2}></span><a href="/u/{user2.profile.username}">{user2.profile.username}</a></dt>
						<dd>{user2.totalItems.toLocaleString()} records</dd>
					</div>
					<div class="row">
						<dt>Records in common</dt>
						<dd>{comparison.overlapCount.toLocaleString()}</dd>
					</div>
					<div class="row">
						<dt>Shared artists</dt>
						<dd>{comparison.sharedArtistsCount.toLocaleString()}</dd>
					</div>
					<div class="row">
						<dt>Shared genres</dt>
						<dd>{comparison.sharedGenres.length}</dd>
					</div>
				</dl>
			</section>

			{#if genreRows.length > 0}
				<section class="section col-wide">
					<h2>Genre comparison</h2>
					{@render pairChart('Records per genre for each collector', genreRows)}
				</section>
			{/if}
		</div>

		{#if decadeRows.length > 0 || comparison.sharedArtists.length > 0}
			<div class="cols">
				{#if decadeRows.length > 0}
					<section class="section col-wide">
						<h2>Decade comparison</h2>
						{@render pairChart('Records per decade for each collector', decadeRows)}
					</section>
				{/if}

				{#if comparison.sharedArtists.length > 0}
					<section class="section col-narrow">
						<h2>Shared artists</h2>
						<ul class="artists rows">
							{#each comparison.sharedArtists as artist}
								<li>{artist}</li>
							{/each}
							{#if comparison.sharedArtistsCount > comparison.sharedArtists.length}
								<li class="more">+{comparison.sharedArtistsCount - comparison.sharedArtists.length} more</li>
							{/if}
						</ul>
					</section>
				{/if}
			</div>
		{/if}

		{#if comparison.overlap.length > 0}
			<section class="section">
				<h2>Records both own</h2>
				<CoverGrid items={comparison.overlap.slice(0, SHARED_RECORDS_PREVIEW)} columns={6} />
			</section>
		{/if}

		<div class="cols">
			<section class="section col-half">
				<h2 class="only"><span class="swatch" aria-hidden="true" style:background={COLOUR_1}></span><span>Only {user1.profile.username} has</span></h2>
				{#if comparison.uniqueTo1.length > 0}
					<CoverGrid items={comparison.uniqueTo1} columns={5} />
				{:else}
					<p class="muted no-data">No unique records found</p>
				{/if}
			</section>

			<section class="section col-half">
				<h2 class="only"><span class="swatch" aria-hidden="true" style:background={COLOUR_2}></span><span>Only {user2.profile.username} has</span></h2>
				{#if comparison.uniqueTo2.length > 0}
					<CoverGrid items={comparison.uniqueTo2} columns={5} />
				{:else}
					<p class="muted no-data">No unique records found</p>
				{/if}
			</section>
		</div>

		<div class="actions">
			<a href="/compare" class="btn btn-secondary">Compare different users</a>
		</div>
	</div>
</main>
{:else}
<main id="main-content" class="compare-results">
	{@render title()}
	<div class="body">
		{@render banners()}
	</div>
</main>
{/if}

<style>
	.compare-results {
		padding-top: 56px;
		padding-bottom: var(--section-gap);
	}

	h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}

	h1 .vs {
		color: var(--muted);
		font-weight: 500;
	}

	.lead {
		margin-top: 16px;
	}

	.notice p {
		margin: 0;
	}

	.notice p + p {
		margin-top: 8px;
	}

	/* Sections and column rows sit one section gap apart, as on the profile. */
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--section-gap);
		margin-top: 48px;
	}

	.body :global(.section) {
		margin-bottom: 0;
	}

	.body :global(.loading-banner) {
		margin-bottom: 0;
	}

	.col-half {
		flex: 1 1 400px;
		min-width: 0;
	}

	.section h2 {
		overflow-wrap: anywhere;
	}

	.swatch {
		display: inline-block;
	}

	/* Fact rows: label left, value right, under a hairline (as At a glance). */
	.facts {
		margin: 0;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		min-height: 60px;
		border-bottom: 1px solid var(--hairline);
	}

	dt {
		min-width: 0;
		font-size: 18px;
		overflow-wrap: anywhere;
	}

	dt.who {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
	}

	dd {
		margin: 0;
		flex-shrink: 0;
		text-align: right;
	}

	dd:not(.figure) {
		font-size: 18px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* The two-person chart: the first person's half on the left, growing out from
	   the middle; the second's on the right. Numbers at the outer ends. */
	.pair-head,
	.pair-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 140px minmax(0, 1fr);
		gap: 12px;
		align-items: center;
	}

	.pair-head {
		align-items: end;
		padding-bottom: 8px;
		font-size: 15px;
		font-weight: 600;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.who-2 {
		justify-content: flex-end;
		text-align: right;
	}

	.pair-row {
		min-height: 40px;
		border-top: 1px solid var(--hairline);
	}

	.side {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.track {
		display: flex;
		flex: 1;
		min-width: 0;
		height: 16px;
		background: var(--track);
	}

	.side-1 .track {
		justify-content: flex-end;
	}

	.bar {
		width: calc(100% * var(--v));
		height: 100%;
	}

	.num {
		min-width: 4ch;
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.side-1 .num {
		text-align: right;
	}

	.pair-label {
		font-size: 15px;
		text-align: center;
		overflow-wrap: anywhere;
		line-height: 1.2;
	}

	.artists {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.artists li {
		padding: 10px 0;
		font-size: 18px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.artists .more {
		font-weight: 400;
		color: var(--muted);
	}

	.only {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.only span:last-child {
		min-width: 0;
	}

	.no-data {
		margin: 0;
	}

	@media (max-width: 699px) {
		.compare-results {
			padding-top: 32px;
		}

		.body {
			margin-top: 32px;
		}

		.pair-head,
		.pair-row {
			grid-template-columns: minmax(0, 1fr) 76px minmax(0, 1fr);
			gap: 6px;
		}

		.pair-label {
			font-size: 13px;
		}

		.num {
			min-width: 3ch;
			font-size: 13px;
		}

		.actions .btn {
			width: 100%;
		}
	}
</style>
