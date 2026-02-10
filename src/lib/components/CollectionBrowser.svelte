<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import SearchBar from './browser/SearchBar.svelte';
	import FilterControls from './browser/FilterControls.svelte';
	import SortToolbar from './browser/SortToolbar.svelte';
	import Pagination from './browser/Pagination.svelte';
	import RecordCard from './browser/RecordCard.svelte';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	let searchQuery = $state('');
	let debouncedQuery = $state('');
	let selectedGenre = $state('');
	let selectedFormat = $state('');
	let selectedDecade = $state('');
	let sortBy: 'added' | 'artist' | 'title' | 'year' = $state('added');
	let sortOrder: 'asc' | 'desc' = $state('desc');
	let showFilters = $state(false);
	let page = $state(1);
	const perPage = 18;

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

	// Filter and sort items
	let filteredItems = $derived(items
		.filter(item => {
			if (debouncedQuery) {
				const query = debouncedQuery.toLowerCase();
				const title = item.basic_information.title.toLowerCase();
				const artists = item.basic_information.artists.map(a => a.name.toLowerCase()).join(' ');
				const labels = item.basic_information.labels?.map(l => l.name.toLowerCase()).join(' ') || '';
				const catno = item.basic_information.labels?.map(l => l.catno.toLowerCase()).join(' ') || '';

				if (!title.includes(query) && !artists.includes(query) && !labels.includes(query) && !catno.includes(query)) {
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

	let totalPages = $derived(Math.ceil(filteredItems.length / perPage));
	let pagedItems = $derived(filteredItems.slice((page - 1) * perPage, page * perPage));

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

	<SortToolbar
		resultCount={filteredItems.length}
		totalCount={items.length}
		{sortBy}
		{sortOrder}
		onToggleSort={toggleSort}
	/>

	<div class="items-grid">
		{#each pagedItems as item (item.id)}
			<RecordCard {item} />
		{/each}
	</div>

	{#if filteredItems.length === 0}
		<div class="no-results">
			<p>No records found matching your search.</p>
			<button onclick={clearFilters}>Clear Filters</button>
		</div>
	{/if}

	<Pagination bind:page {totalPages} />
</div>

<style>
	.collection-browser {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.browser-header {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.items-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1rem;
	}

	.no-results {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--color-text-tertiary);
	}

	.no-results button {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		background: var(--color-bg-secondary);
		border: none;
		border-radius: 6px;
		color: var(--color-text);
		cursor: pointer;
	}

	@media (max-width: 600px) {
		.items-grid {
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
			gap: 0.75rem;
		}
	}
</style>
