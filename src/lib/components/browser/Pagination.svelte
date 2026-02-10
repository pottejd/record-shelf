<script lang="ts">
	let { page = $bindable(1), totalPages }: { page: number; totalPages: number } = $props();
</script>

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

<style>
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
		.pagination {
			flex-wrap: wrap;
		}
	}
</style>
