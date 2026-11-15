<script lang="ts">
	/** Under the grid: "Show more" while some are hidden, and how many are on show. */
	let { shown, total, onMore }: { shown: number; total: number; onMore: () => void } = $props();
</script>

{#if total > 0}
	<div class="pagination">
		{#if shown < total}
			<button type="button" class="btn btn-secondary" onclick={onMore}>Show more</button>
		{/if}
		<span class="page-info">{shown.toLocaleString()} of {total.toLocaleString()} shown</span>
	</div>
{/if}

<style>
	.pagination {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 12px 24px;
		margin-top: 40px;
	}

	.pagination .btn {
		font-size: 17px;
	}

	.page-info {
		font-size: 17px;
		color: var(--muted);
	}
</style>
