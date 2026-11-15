<script lang="ts">
	let { page = $bindable(1), totalPages }: { page: number; totalPages: number } = $props();
</script>

{#if totalPages > 1}
	<div class="pagination">
		<button
			class="btn btn-secondary"
			disabled={page === 1}
			onclick={() => page = 1}
		>
			First
		</button>
		<button
			class="btn btn-secondary"
			disabled={page === 1}
			onclick={() => page--}
		>
			Prev
		</button>

		<span class="page-info">
			Page {page} of {totalPages}
		</span>

		<button
			class="btn btn-secondary"
			disabled={page === totalPages}
			onclick={() => page++}
		>
			Next
		</button>
		<button
			class="btn btn-secondary"
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
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 12px;
		margin-top: 32px;
	}

	.page-info {
		font-size: 17px;
		color: var(--muted);
		padding: 0 12px;
	}
</style>
