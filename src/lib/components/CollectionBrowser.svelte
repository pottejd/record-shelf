<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { itemSearchFields } from '$lib/utils/discogs';
	import { replaceState } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import { recordsHref } from '$lib/profile/tabs';
	import SearchBar from './browser/SearchBar.svelte';
	import FilterControls from './browser/FilterControls.svelte';
	import SortToolbar from './browser/SortToolbar.svelte';
	import RecordCard from './browser/RecordCard.svelte';
	import Pagination from './browser/Pagination.svelte';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	// Read initial state from URL params
	function getInitialParam(key: string, fallback: string): string {
		if (!browser) return fallback;
		return new URLSearchParams(window.location.search).get(key) || fallback;
	}

	let searchQuery = $state(getInitialParam('search', ''));
	let debouncedQuery = $state(getInitialParam('search', ''));
	let selectedGenre = $state(getInitialParam('genre', ''));
	let selectedFormat = $state(getInitialParam('format', ''));
	let selectedDecade = $state(getInitialParam('decade', ''));
	let sortBy: 'added' | 'artist' | 'title' | 'year' = $state(
		(getInitialParam('sort', 'added') as 'added' | 'artist' | 'title' | 'year')
	);
	let sortOrder: 'asc' | 'desc' = $state(
		(getInitialParam('order', 'desc') as 'asc' | 'desc')
	);
	let page = $state(parseInt(getInitialParam('page', '1'), 10) || 1);
	const perPage = 24;
	// SvelteKit's replaceState throws if its router has not started yet, which it
	// may not have while the page is still hydrating. Hold the first write until a
	// task after mount.
	let routerReady = $state(false);
	onMount(() => {
		const timer = setTimeout(() => (routerReady = true));
		return () => clearTimeout(timer);
	});

	// Keep the filters in the address, next to `tab=records`, replacing the current
	// history step rather than adding one. Read from and written to the browser's own
	// address: a shallow replaceState does not change SvelteKit's page.url.
	$effect(() => {
		if (!browser) return;
		const href = recordsHref(new URL(location.href), {
			search: debouncedQuery,
			genre: selectedGenre,
			format: selectedFormat,
			decade: selectedDecade,
			sort: sortBy,
			order: sortOrder,
			page
		});
		if (!routerReady) return;
		if (href !== `${location.pathname}${location.search}`) {
			replaceState(href, {});
		}
	});

	// Debounce search input. Read the query here, not in the timer: a read inside
	// the timer is not tracked, and the effect would never run again.
	$effect(() => {
		const query = searchQuery;
		const timeout = setTimeout(() => {
			debouncedQuery = query;
		}, 300);
		return () => clearTimeout(timeout);
	});

	// Extract unique values for filters
	let genres = $derived([...new Set(items.flatMap(i => i.basic_information.genres || []))].sort());
	let formats = $derived([...new Set(items.flatMap(i => i.basic_information.formats?.map(f => f.name) || []))].sort());
	let decades = $derived([...new Set(items
		.map(i => i.basic_information.year)
		.filter(y => y > 0)
		.map(y => Math.floor(y / 10) * 10)
	)].sort((a, b) => b - a));

	// Precompute lowercased searchable fields once per item (recomputed only when
	// `items` changes), so per-keystroke filtering is a cheap lookup + includes
	// instead of re-lowercasing/joining every item's fields on every render.
	let searchIndex = $derived(new Map(items.map((item) => [item, itemSearchFields(item)])));

	// Filter and sort items
	let filteredItems = $derived(items
		.filter(item => {
			if (debouncedQuery) {
				const query = debouncedQuery.toLowerCase();
				// Fall back to computing fields on the fly if an item somehow isn't in
				// the index, so a missing entry can't bypass the search filter.
				const idx = searchIndex.get(item) ?? itemSearchFields(item);
				if (
					!idx.title.includes(query) &&
					!idx.artists.includes(query) &&
					!idx.labels.includes(query) &&
					!idx.catno.includes(query)
				) {
					return false;
				}
			}

			if (selectedGenre && !item.basic_information.genres?.includes(selectedGenre)) {
				return false;
			}

			if (selectedFormat && !item.basic_information.formats?.some(f => f.name === selectedFormat)) {
				return false;
			}

			if (selectedDecade) {
				const decade = parseInt(selectedDecade);
				const year = item.basic_information.year;
				if (year < decade || year >= decade + 10) {
					return false;
				}
			}

			return true;
		})
		.sort((a, b) => {
			let cmp = 0;
			switch (sortBy) {
				case 'added':
					cmp = new Date(a.date_added).getTime() - new Date(b.date_added).getTime();
					break;
				case 'artist':
					cmp = (a.basic_information.artists[0]?.name || '').localeCompare(b.basic_information.artists[0]?.name || '');
					break;
				case 'title':
					cmp = a.basic_information.title.localeCompare(b.basic_information.title);
					break;
				case 'year':
					cmp = (a.basic_information.year || 0) - (b.basic_information.year || 0);
					break;
			}
			return sortOrder === 'desc' ? -cmp : cmp;
		}));

	let visibleCount = $derived(page * perPage);
	let visibleItems = $derived(filteredItems.slice(0, visibleCount));
	let isFiltered = $derived(filteredItems.length !== items.length);
	let hasFilter = $derived(Boolean(selectedGenre || selectedFormat || selectedDecade));

	function recordCount(n: number): string {
		return `${n.toLocaleString()} ${n === 1 ? 'record' : 'records'}`;
	}

	// Back to page 1 when the search, a filter or the sort changes. Only on a change
	// after mount: the list remounts each time Records opens, and a page number from
	// the address must survive that.
	let lastFilters: string | null = null;
	$effect(() => {
		const filters = JSON.stringify([debouncedQuery, selectedGenre, selectedFormat, selectedDecade, sortBy, sortOrder]);
		if (lastFilters !== null && filters !== lastFilters) page = 1;
		lastFilters = filters;
	});

	function clearFilters() {
		searchQuery = '';
		debouncedQuery = '';
		selectedGenre = '';
		selectedFormat = '';
		selectedDecade = '';
	}

	let gridEl: HTMLDivElement | undefined = $state();

	/** Shows the next 24. The last press removes the button, so focus moves on to the
	 *  first record it brought in rather than falling to the page. */
	async function showMore() {
		const first = visibleItems.length;
		page = page + 1;
		if (visibleItems.length < filteredItems.length) return;
		await tick();
		(gridEl?.children[first] as HTMLElement | undefined)?.focus();
	}

	function toggleSort(field: typeof sortBy) {
		if (sortBy === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = field;
			sortOrder = field === 'added' ? 'desc' : 'asc';
		}
	}
</script>

<div class="head">
	<h2>All records</h2>
	<span class="count" role="status" aria-live="polite">
		{#if isFiltered}
			{filteredItems.length.toLocaleString()} of {recordCount(items.length)}
		{:else}
			{recordCount(items.length)}
		{/if}
	</span>
</div>

<div class="controls">
	<div class="search">
		<SearchBar
			bind:value={searchQuery}
			label="Search the collection"
			placeholder="Search by title, artist, label or catalog number"
		/>
	</div>
	<FilterControls
		{genres}
		{formats}
		{decades}
		{selectedGenre}
		{selectedFormat}
		{selectedDecade}
		onGenreChange={(v) => (selectedGenre = v)}
		onFormatChange={(v) => (selectedFormat = v)}
		onDecadeChange={(v) => (selectedDecade = v)}
	/>
</div>

{#if hasFilter}
	<div class="active-filters">
		{#if selectedGenre}
			<button class="chip" onclick={() => (selectedGenre = '')} aria-label="Remove {selectedGenre} genre filter">
				{selectedGenre} <span aria-hidden="true">✕</span>
			</button>
		{/if}
		{#if selectedFormat}
			<button class="chip" onclick={() => (selectedFormat = '')} aria-label="Remove {selectedFormat} format filter">
				{selectedFormat} <span aria-hidden="true">✕</span>
			</button>
		{/if}
		{#if selectedDecade}
			<button class="chip" onclick={() => (selectedDecade = '')} aria-label="Remove {selectedDecade}s decade filter">
				{selectedDecade}s <span aria-hidden="true">✕</span>
			</button>
		{/if}
		<button class="chip clear-all" onclick={clearFilters}>Clear all</button>
	</div>
{/if}

<SortToolbar {sortBy} {sortOrder} onToggleSort={toggleSort} />

{#if filteredItems.length === 0}
	<div class="no-results">
		<p>No records match.</p>
		{#if hasFilter || debouncedQuery}
			<button class="btn btn-secondary" onclick={clearFilters}>Clear filters</button>
		{/if}
	</div>
{:else}
	<div class="items-grid" bind:this={gridEl}>
		<!-- Keyed by the copy, not the release: two copies of one pressing are two cards. -->
		{#each visibleItems as item (item.instance_id)}
			<RecordCard {item} />
		{/each}
	</div>
{/if}

<Pagination
	shown={visibleItems.length}
	total={filteredItems.length}
	onMore={showMore}
/>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 24px;
	}

	.head h2 {
		margin: 0;
	}

	.count {
		font-size: 17px;
		color: var(--muted);
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px 32px;
		margin-top: 16px;
	}

	.search {
		flex: 999 1 300px;
		min-width: 0;
		display: flex;
	}

	.active-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 16px;
	}

	/* A chosen filter: ink text with a hairline edge, square. */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		min-height: var(--touch);
		padding: 0 14px;
		border: 1px solid var(--hairline);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		font-weight: 500;
		overflow-wrap: anywhere;
		cursor: pointer;
	}

	.chip:hover {
		border-color: var(--ink);
	}

	.chip.clear-all {
		border-color: transparent;
		color: var(--muted);
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.chip.clear-all:hover {
		color: var(--ink);
	}

	.items-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 32px 24px;
		margin-top: 32px;
	}

	.no-results {
		margin-top: 32px;
		padding: 48px 0;
		text-align: center;
		color: var(--muted);
	}

	.no-results p {
		margin: 0;
	}

	.no-results button {
		margin-top: 16px;
	}

	@media (max-width: 699px) {
		.items-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 24px 16px;
		}
	}
</style>
