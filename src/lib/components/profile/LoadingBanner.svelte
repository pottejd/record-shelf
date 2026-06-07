<script lang="ts">
	let { isLoadingMore, loadError, loaded, total, loadProgress, onRetry }: {
		isLoadingMore: boolean;
		loadError: boolean;
		loaded: number;
		total: number;
		loadProgress: number;
		onRetry: () => void;
	} = $props();
</script>

{#if isLoadingMore}
	<div class="loading-banner" aria-live="polite">
		<div class="loading-text">
			Loading collection: {loaded} of {total} items...
		</div>
		<div class="progress-track">
			<div class="progress-fill" style="width: {loadProgress * 100}%"></div>
		</div>
	</div>
{:else if loadError}
	<div class="loading-banner load-error" role="alert">
		<div class="loading-text">
			Couldn't load the full collection — showing {loaded} of {total} items.
		</div>
		<button class="retry-btn" onclick={onRetry}>Retry</button>
	</div>
{/if}

<style>
	.loading-banner {
		margin-bottom: 1.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 12px;
	}

	.loading-text {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.5rem;
	}

	.load-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border-color: var(--color-danger, #ef4444);
	}

	.load-error .loading-text {
		margin-bottom: 0;
	}

	.retry-btn {
		flex-shrink: 0;
		padding: 0.375rem 0.875rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-bg-secondary);
		color: var(--color-text);
		cursor: pointer;
	}

	.retry-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.progress-track {
		height: 4px;
		background: var(--color-bg-secondary);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--gradient-brand);
		border-radius: 2px;
		transition: width 0.3s ease;
	}
</style>
