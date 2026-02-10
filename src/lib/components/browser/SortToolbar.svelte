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
	<span class="result-count">
		{resultCount} {resultCount === 1 ? 'record' : 'records'}
		{#if resultCount !== totalCount}
			<span class="filtered-note">(filtered from {totalCount})</span>
		{/if}
	</span>

	<div class="sort-options">
		<span class="sort-label">Sort:</span>
		<button class="sort-btn" class:active={sortBy === 'added'} onclick={() => onToggleSort('added')}>
			Date Added {#if sortBy === 'added'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
		</button>
		<button class="sort-btn" class:active={sortBy === 'artist'} onclick={() => onToggleSort('artist')}>
			Artist {#if sortBy === 'artist'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
		</button>
		<button class="sort-btn" class:active={sortBy === 'title'} onclick={() => onToggleSort('title')}>
			Title {#if sortBy === 'title'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
		</button>
		<button class="sort-btn" class:active={sortBy === 'year'} onclick={() => onToggleSort('year')}>
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

	@media (max-width: 600px) {
		.browser-toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.sort-options {
			justify-content: center;
			flex-wrap: wrap;
		}
	}
</style>
