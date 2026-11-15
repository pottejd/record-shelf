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

<button
	class="filter-toggle btn"
	class:btn-primary={visible}
	class:btn-secondary={!visible}
	onclick={onToggle}
>
	<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
			<label for="genre-filter" class="small">Genre</label>
			<span class="select-wrap">
				<select id="genre-filter" class="field" value={selectedGenre} onchange={(e) => onGenreChange(e.currentTarget.value)}>
					<option value="">All Genres</option>
					{#each genres as genre}
						<option value={genre}>{genre}</option>
					{/each}
				</select>
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
			</span>
		</div>

		<div class="filter-group">
			<label for="format-filter" class="small">Format</label>
			<span class="select-wrap">
				<select id="format-filter" class="field" value={selectedFormat} onchange={(e) => onFormatChange(e.currentTarget.value)}>
					<option value="">All Formats</option>
					{#each formats as format}
						<option value={format}>{format}</option>
					{/each}
				</select>
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
			</span>
		</div>

		<div class="filter-group">
			<label for="decade-filter" class="small">Decade</label>
			<span class="select-wrap">
				<select id="decade-filter" class="field" value={selectedDecade} onchange={(e) => onDecadeChange(e.currentTarget.value)}>
					<option value="">All Decades</option>
					{#each decades as decade}
						<option value={String(decade)}>{decade}s</option>
					{/each}
				</select>
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
			</span>
		</div>

		{#if activeFilterCount > 0}
			<button class="clear-filters" onclick={onClear}>Clear All</button>
		{/if}
	</div>
{/if}

<style>
	.filter-toggle svg {
		width: 18px;
		height: 18px;
	}

	/* The count as plain text with a thin edge, never a coloured pill. */
	.filter-count {
		min-width: 24px;
		padding: 2px 6px;
		border: 1px solid currentColor;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.2;
		text-align: center;
	}

	.filters {
		flex: 1 1 100%;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 16px 32px;
	}

	.filter-group {
		flex: 1 1 160px;
		max-width: 260px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.select-wrap {
		position: relative;
		display: block;
	}

	.select-wrap select {
		padding-right: 30px;
		font-weight: 500;
		-webkit-appearance: none;
		appearance: none;
		cursor: pointer;
	}

	/* Options open in the browser's own list; keep them readable in dark mode. */
	.select-wrap option {
		background: var(--ground);
		color: var(--ink);
	}

	.select-wrap svg {
		position: absolute;
		right: 2px;
		top: 50%;
		width: 18px;
		height: 18px;
		margin-top: -9px;
		pointer-events: none;
	}

	.clear-filters {
		min-height: var(--touch);
		padding: 0;
		background: none;
		border: 0;
		color: var(--ink);
		font: inherit;
		font-size: 17px;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 4px;
		cursor: pointer;
	}

	.clear-filters:hover {
		text-decoration-thickness: 2px;
	}

	@media (max-width: 699px) {
		.filter-group {
			max-width: none;
		}
	}
</style>
