<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { itemSearchFields } from '$lib/utils/discogs';
	import { replaceState } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { recordsHref } from '$lib/profile/tabs';
	import SearchBar from './browser/SearchBar.svelte';
	import FilterControls from './browser/FilterControls.svelte';
	import SortToolbar from './browser/SortToolbar.svelte';
	import RecordCard from './browser/RecordCard.svelte';

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
	let showFilters = $state(false);
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

	// Debounce search input
	$effect(() => {
		const timeout = setTimeout(() => {
			debouncedQuery = searchQuery;
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
	let hasMore = $derived(visibleCount < filteredItems.length);

	// Reset to page 1 when filters change
	$effect(() => {
		debouncedQuery; selectedGenre; selectedFormat; selectedDecade; sortBy; sortOrder;
		page = 1;
	});

	function clearFilters() {
		searchQuery = '';
		debouncedQuery = '';
		selectedGenre = '';
		selectedFormat = '';
		selectedDecade = '';
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

<div class="collection-browser">
	<div class="browser-header">
		<SearchBar bind:value={searchQuery} placeholder="Search by title, artist, label, or catalog #..." />
		<FilterControls
			{genres}
			{formats}
			{decades}
			{selectedGenre}
			{selectedFormat}
			{selectedDecade}
			visible={showFilters}
			onToggle={() => showFilters = !showFilters}
			onGenreChange={(v) => selectedGenre = v}
			onFormatChange={(v) => selectedFormat = v}
			onDecadeChange={(v) => selectedDecade = v}
			onClear={clearFilters}
		/>
	</div>

	{#if selectedGenre || selectedFormat || selectedDecade}
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

	<SortToolbar
		resultCount={filteredItems.length}
		totalCount={items.length}
		{sortBy}
		{sortOrder}
		onToggleSort={toggleSort}
	/>

	<div class="items-grid">
		{#each visibleItems as item (item.id)}
			<RecordCard {item} />
		{/each}
	</div>

	{#if filteredItems.length === 0}
		<div class="no-results">
			<p>No records found matching the search.</p>
			<button class="btn btn-secondary" onclick={clearFilters}>Clear Filters</button>
		</div>
	{/if}

	{#if hasMore}
		<div class="load-more">
			<button class="btn btn-secondary" onclick={() => page = page + 1}>
				Show more ({filteredItems.length - visibleCount} remaining)
			</button>
		</div>
	{/if}
</div>

<style>
	.collection-browser {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.browser-header {
		display: flex;
		align-items: center;
		gap: 16px 24px;
		flex-wrap: wrap;
	}

	.active-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	/* A chosen filter: ink text with a hairline edge, square. */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--touch);
		padding: 0 14px;
		border: 1px solid var(--hairline);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		font-weight: 500;
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
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 32px 24px;
		margin-top: 16px;
	}

	.no-results {
		text-align: center;
		padding: 48px 0;
		color: var(--muted);
	}

	.no-results p {
		margin: 0;
	}

	.no-results button {
		margin-top: 16px;
	}

	.load-more {
		text-align: center;
		padding-top: 24px;
	}

	@media (max-width: 699px) {
		.items-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 24px 16px;
		}
	}
</style>
