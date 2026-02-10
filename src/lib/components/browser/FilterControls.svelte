<script lang="ts">
	interface Props {
		genres: string[];
		formats: string[];
		decades: number[];
		selectedGenre: string;
		selectedFormat: string;
		selectedDecade: string;
		visible: boolean;
		onToggle: () => void;
		onGenreChange: (value: string) => void;
		onFormatChange: (value: string) => void;
		onDecadeChange: (value: string) => void;
		onClear: () => void;
	}

	let {
		genres, formats, decades,
		selectedGenre, selectedFormat, selectedDecade,
		visible, onToggle,
		onGenreChange, onFormatChange, onDecadeChange,
		onClear
	}: Props = $props();

	let activeFilterCount = $derived([selectedGenre, selectedFormat, selectedDecade].filter(Boolean).length);
</script>

<button class="filter-toggle" class:active={visible} onclick={onToggle}>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
	</svg>
	Filters
	{#if activeFilterCount > 0}
		<span class="filter-count">{activeFilterCount}</span>
	{/if}
</button>

{#if visible}
	<div class="filters">
		<div class="filter-group">
			<label for="genre-filter">Genre</label>
			<select id="genre-filter" value={selectedGenre} onchange={(e) => onGenreChange(e.currentTarget.value)}>
				<option value="">All Genres</option>
				{#each genres as genre}
					<option value={genre}>{genre}</option>
				{/each}
			</select>
		</div>

		<div class="filter-group">
			<label for="format-filter">Format</label>
			<select id="format-filter" value={selectedFormat} onchange={(e) => onFormatChange(e.currentTarget.value)}>
				<option value="">All Formats</option>
				{#each formats as format}
					<option value={format}>{format}</option>
				{/each}
			</select>
		</div>

		<div class="filter-group">
			<label for="decade-filter">Decade</label>
			<select id="decade-filter" value={selectedDecade} onchange={(e) => onDecadeChange(e.currentTarget.value)}>
				<option value="">All Decades</option>
				{#each decades as decade}
					<option value={String(decade)}>{decade}s</option>
				{/each}
			</select>
		</div>

		{#if activeFilterCount > 0}
			<button class="clear-filters" onclick={onClear}>Clear All</button>
		{/if}
	</div>
{/if}

<style>
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
</style>
