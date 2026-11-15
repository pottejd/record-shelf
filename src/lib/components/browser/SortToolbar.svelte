<script lang="ts">
	interface Props {
		resultCount: number;
		totalCount: number;
		sortBy: 'added' | 'artist' | 'title' | 'year';
		sortOrder: 'asc' | 'desc';
		onToggleSort: (field: 'added' | 'artist' | 'title' | 'year') => void;
	}

	let { resultCount, totalCount, sortBy, sortOrder, onToggleSort }: Props = $props();
</script>

<div class="browser-toolbar">
	<span class="result-count" aria-live="polite" role="status">
		{resultCount} {resultCount === 1 ? 'record' : 'records'}
		{#if resultCount !== totalCount}
			<span class="filtered-note">(filtered from {totalCount})</span>
		{/if}
	</span>

	<div class="sort-options">
		<span class="sort-label">Sort:</span>
		<button class="sort-btn" class:active={sortBy === 'added'} aria-pressed={sortBy === 'added'} onclick={() => onToggleSort('added')}>
			Date Added {#if sortBy === 'added'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
		</button>
		<button class="sort-btn" class:active={sortBy === 'artist'} aria-pressed={sortBy === 'artist'} onclick={() => onToggleSort('artist')}>
			Artist {#if sortBy === 'artist'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
		</button>
		<button class="sort-btn" class:active={sortBy === 'title'} aria-pressed={sortBy === 'title'} onclick={() => onToggleSort('title')}>
			Title {#if sortBy === 'title'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
		</button>
		<button class="sort-btn" class:active={sortBy === 'year'} aria-pressed={sortBy === 'year'} onclick={() => onToggleSort('year')}>
			Year {#if sortBy === 'year'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
		</button>
	</div>
</div>

<style>
	.browser-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 24px;
	}

	.result-count {
		font-size: 17px;
		color: var(--muted);
	}

	.sort-options {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 28px;
	}

	.sort-label {
		font-size: 17px;
		color: var(--muted);
	}

	/* Plain words; the chosen one is ink and bold and carries its arrow. */
	.sort-btn {
		min-height: 48px;
		padding: 0;
		background: transparent;
		border: 0;
		color: var(--muted);
		font: inherit;
		font-size: 17px;
		font-weight: 500;
		cursor: pointer;
	}

	.sort-btn:hover {
		color: var(--ink);
	}

	.sort-btn.active {
		color: var(--ink);
		font-weight: 700;
	}

	@media (max-width: 699px) {
		.browser-toolbar {
			flex-direction: column;
			align-items: flex-start;
		}

		.sort-options {
			gap: 0 18px;
		}
	}
</style>
