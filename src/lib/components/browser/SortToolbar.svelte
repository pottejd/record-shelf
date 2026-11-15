<script lang="ts">
	type SortField = 'added' | 'artist' | 'title' | 'year';

	interface Props {
		sortBy: SortField;
		sortOrder: 'asc' | 'desc';
		onToggleSort: (field: SortField) => void;
	}

	let { sortBy, sortOrder, onToggleSort }: Props = $props();

	/** Each field's words, and how its two directions read aloud. */
	const FIELDS: { field: SortField; label: string; asc: string; desc: string }[] = [
		{ field: 'added', label: 'Date added', asc: 'oldest first', desc: 'newest first' },
		{ field: 'artist', label: 'Artist', asc: 'A to Z', desc: 'Z to A' },
		{ field: 'title', label: 'Title', asc: 'A to Z', desc: 'Z to A' },
		{ field: 'year', label: 'Year', asc: 'oldest first', desc: 'newest first' }
	];
</script>

<div class="sort-options">
	<span class="sort-label">Sort by</span>
	{#each FIELDS as { field, label, asc, desc } (field)}
		{@const active = sortBy === field}
		<button
			type="button"
			class="sort-btn"
			class:active
			aria-pressed={active}
			aria-label={active ? `${label}, ${sortOrder === 'desc' ? desc : asc}` : undefined}
			onclick={() => onToggleSort(field)}
		>
			{label}
			{#if active}
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="12" y1="5" x2="12" y2="19" />
					{#if sortOrder === 'desc'}
						<polyline points="6 13 12 19 18 13" />
					{:else}
						<polyline points="6 11 12 5 18 11" />
					{/if}
				</svg>
			{/if}
		</button>
	{/each}
</div>

<style>
	.sort-options {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 28px;
		margin-top: 8px;
	}

	.sort-label {
		font-size: 17px;
		color: var(--muted);
	}

	/* Plain words; the chosen one is ink and bold and carries its arrow. */
	.sort-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 48px;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 0;
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

	.sort-btn svg {
		width: 16px;
		height: 16px;
	}

	@media (max-width: 699px) {
		.sort-options {
			gap: 0 12px;
		}
	}
</style>
