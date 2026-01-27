<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	export let items: DiscogsCollectionItem[];

	let searchQuery = '';
	let selectedGenre = '';
	let selectedFormat = '';
	let selectedDecade = '';
	let sortBy: 'added' | 'artist' | 'title' | 'year' = 'added';
	let sortOrder: 'asc' | 'desc' = 'desc';
	let showFilters = false;
	let page = 1;
	const perPage = 18;

	// Extract unique values for filters
	$: genres = [...new Set(items.flatMap(i => i.basic_information.genres || []))].sort();
	$: formats = [...new Set(items.flatMap(i => i.basic_information.formats?.map(f => f.name) || []))].sort();
	$: decades = [...new Set(items
		.map(i => i.basic_information.year)
		.filter(y => y > 0)
		.map(y => Math.floor(y / 10) * 10)
	)].sort((a, b) => b - a);

	// Filter and sort items
	$: filteredItems = items
		.filter(item => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const title = item.basic_information.title.toLowerCase();
				const artists = item.basic_information.artists.map(a => a.name.toLowerCase()).join(' ');
				const labels = item.basic_information.labels?.map(l => l.name.toLowerCase()).join(' ') || '';
				const catno = item.basic_information.labels?.map(l => l.catno.toLowerCase()).join(' ') || '';

				if (!title.includes(query) && !artists.includes(query) && !labels.includes(query) && !catno.includes(query)) {
					return false;
				}
			}

			// Genre filter
			if (selectedGenre && !item.basic_information.genres?.includes(selectedGenre)) {
				return false;
			}

			// Format filter
			if (selectedFormat && !item.basic_information.formats?.some(f => f.name === selectedFormat)) {
				return false;
			}

			// Decade filter
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
		});

	$: totalPages = Math.ceil(filteredItems.length / perPage);
	$: pagedItems = filteredItems.slice((page - 1) * perPage, page * perPage);

	// Reset to page 1 when filters change
	$: if (searchQuery || selectedGenre || selectedFormat || selectedDecade || sortBy || sortOrder) {
		page = 1;
	}

	function getArtistName(item: DiscogsCollectionItem): string {
		return item.basic_information.artists.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
	}

	function clearFilters() {
		searchQuery = '';
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
		<div class="search-box">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.35-4.35" />
			</svg>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search by title, artist, label, or catalog #..."
			/>
			{#if searchQuery}
				<button class="clear-search" onclick={() => searchQuery = ''}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>

		<button class="filter-toggle" class:active={showFilters} onclick={() => showFilters = !showFilters}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
			</svg>
			Filters
			{#if selectedGenre || selectedFormat || selectedDecade}
				<span class="filter-count">{[selectedGenre, selectedFormat, selectedDecade].filter(Boolean).length}</span>
			{/if}
		</button>
	</div>

	{#if showFilters}
		<div class="filters">
			<div class="filter-group">
				<label for="genre-filter">Genre</label>
				<select id="genre-filter" bind:value={selectedGenre}>
					<option value="">All Genres</option>
					{#each genres as genre}
						<option value={genre}>{genre}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="format-filter">Format</label>
				<select id="format-filter" bind:value={selectedFormat}>
					<option value="">All Formats</option>
					{#each formats as format}
						<option value={format}>{format}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="decade-filter">Decade</label>
				<select id="decade-filter" bind:value={selectedDecade}>
					<option value="">All Decades</option>
					{#each decades as decade}
						<option value={decade}>{decade}s</option>
					{/each}
				</select>
			</div>

			{#if selectedGenre || selectedFormat || selectedDecade}
				<button class="clear-filters" onclick={clearFilters}>Clear All</button>
			{/if}
		</div>
	{/if}

	<div class="browser-toolbar">
		<span class="result-count">
			{filteredItems.length} {filteredItems.length === 1 ? 'record' : 'records'}
			{#if filteredItems.length !== items.length}
				<span class="filtered-note">(filtered from {items.length})</span>
			{/if}
		</span>

		<div class="sort-options">
			<span class="sort-label">Sort:</span>
			<button class="sort-btn" class:active={sortBy === 'added'} onclick={() => toggleSort('added')}>
				Date Added {#if sortBy === 'added'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
			</button>
			<button class="sort-btn" class:active={sortBy === 'artist'} onclick={() => toggleSort('artist')}>
				Artist {#if sortBy === 'artist'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
			</button>
			<button class="sort-btn" class:active={sortBy === 'title'} onclick={() => toggleSort('title')}>
				Title {#if sortBy === 'title'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
			</button>
			<button class="sort-btn" class:active={sortBy === 'year'} onclick={() => toggleSort('year')}>
				Year {#if sortBy === 'year'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
			</button>
		</div>
	</div>

	<div class="items-grid">
		{#each pagedItems as item}
			<a
				href="https://www.discogs.com/release/{item.basic_information.id}"
				target="_blank"
				rel="noopener"
				class="item-card"
			>
				<img
					src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
					alt=""
					loading="lazy"
					class="item-cover"
				/>
				<div class="item-info">
					<p class="item-title">{item.basic_information.title}</p>
					<p class="item-artist">{getArtistName(item)}</p>
					<div class="item-meta">
						{#if item.basic_information.year}
							<span class="item-year">{item.basic_information.year}</span>
						{/if}
						{#if item.basic_information.formats?.[0]}
							<span class="item-format">{item.basic_information.formats[0].name}</span>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>

	{#if filteredItems.length === 0}
		<div class="no-results">
			<p>No records found matching your search.</p>
			<button onclick={clearFilters}>Clear Filters</button>
		</div>
	{/if}

	{#if totalPages > 1}
		<div class="pagination">
			<button
				class="page-btn"
				disabled={page === 1}
				onclick={() => page = 1}
			>
				First
			</button>
			<button
				class="page-btn"
				disabled={page === 1}
				onclick={() => page--}
			>
				Prev
			</button>

			<span class="page-info">
				Page {page} of {totalPages}
			</span>

			<button
				class="page-btn"
				disabled={page === totalPages}
				onclick={() => page++}
			>
				Next
			</button>
			<button
				class="page-btn"
				disabled={page === totalPages}
				onclick={() => page = totalPages}
			>
				Last
			</button>
		</div>
	{/if}
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

	.search-box {
		flex: 1;
		min-width: 200px;
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0.875rem;
		width: 18px;
		height: 18px;
		color: var(--color-text-tertiary);
		pointer-events: none;
	}

	.search-box input {
		width: 100%;
		padding: 0.75rem 2.5rem 0.75rem 2.75rem;
		font-size: 0.9375rem;
		border: 2px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg-card);
		color: var(--color-text);
	}

	.search-box input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.clear-search {
		position: absolute;
		right: 0.5rem;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-secondary);
		border: none;
		border-radius: 6px;
		color: var(--color-text-tertiary);
		cursor: pointer;
	}

	.clear-search:hover {
		color: var(--color-text);
	}

	.clear-search svg {
		width: 14px;
		height: 14px;
	}

	.filter-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-bg-secondary);
		color: var(--color-text);
		border: 2px solid var(--color-border);
		border-radius: 10px;
		cursor: pointer;
		transition: border-color 0.15s, background-color 0.15s;
	}

	.filter-toggle:hover, .filter-toggle.active {
		border-color: var(--color-primary);
	}

	.filter-toggle.active {
		background: rgba(99, 102, 241, 0.1);
	}

	.filter-toggle svg {
		width: 18px;
		height: 18px;
	}

	.filter-count {
		background: var(--color-primary);
		color: white;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: 10px;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter-group label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.filter-group select {
		padding: 0.5rem 2rem 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-bg-card);
		color: var(--color-text);
		cursor: pointer;
	}

	.clear-filters {
		align-self: flex-end;
		padding: 0.5rem 1rem;
		font-size: 0.8125rem;
		background: none;
		border: none;
		color: var(--color-primary);
		cursor: pointer;
	}

	.clear-filters:hover {
		text-decoration: underline;
	}

	.browser-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.result-count {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.filtered-note {
		color: var(--color-text-tertiary);
	}

	.sort-options {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.sort-label {
		font-size: 0.8125rem;
		color: var(--color-text-tertiary);
		margin-right: 0.25rem;
	}

	.sort-btn {
		padding: 0.375rem 0.625rem;
		font-size: 0.75rem;
		font-weight: 500;
		background: none;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.15s, color 0.15s;
	}

	.sort-btn:hover {
		background: var(--color-bg-secondary);
	}

	.sort-btn.active {
		background: var(--color-primary);
		color: white;
	}

	.items-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1rem;
	}

	.item-card {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: inherit;
		border-radius: 10px;
		overflow: hidden;
		background: var(--color-bg-secondary);
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.item-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.item-cover {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		background: var(--color-bg-tertiary);
	}

	.item-info {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.item-title {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.item-artist {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.item-year, .item-format {
		font-size: 0.6875rem;
		color: var(--color-text-tertiary);
	}

	.item-year {
		font-weight: 600;
		color: var(--color-primary);
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

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.page-btn {
		padding: 0.5rem 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		background: var(--color-bg-secondary);
		border: none;
		border-radius: 6px;
		color: var(--color-text);
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.page-btn:hover:not(:disabled) {
		background: var(--color-bg-tertiary);
	}

	.page-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		padding: 0 0.5rem;
	}

	@media (max-width: 600px) {
		.browser-toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.sort-options {
			justify-content: center;
			flex-wrap: wrap;
		}

		.items-grid {
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
			gap: 0.75rem;
		}

		.item-info {
			padding: 0.5rem;
		}

		.pagination {
			flex-wrap: wrap;
		}
	}
</style>
