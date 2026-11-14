<script lang="ts">
	import type { EngineState } from '$lib/sync/engine';

	let { state: s, label = 'collection', onRetry }: {
		state: EngineState<unknown>;
		label?: string;
		onRetry: () => void;
	} = $props();

	const RETRYABLE = ['NETWORK', 'UPSTREAM', 'SNAPSHOT_EXPIRED'];

	// Ticks once a second for the wait countdown, the copy's age and the cooldown line.
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	/** Whole units, floored: minutes under an hour (at least 1), hours under a day, then days. */
	function formatAge(ms: number): string {
		const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? '' : 's'}`;
		const minutes = Math.floor(ms / 60_000);
		if (minutes < 60) return unit(Math.max(1, minutes), 'minute');
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return unit(hours, 'hour');
		return unit(Math.floor(hours / 24), 'day');
	}

	let progress = $derived(s.totalItems > 0 ? Math.min(s.loaded / s.totalItems, 1) : 0);
	let seconds = $derived(s.resumeAt === null ? 0 : Math.max(0, Math.ceil((s.resumeAt - now) / 1000)));
	let coolingDown = $derived(s.cooldownUntil !== null && s.cooldownUntil > now);
	let retryable = $derived(s.phase === 'error' && s.error !== null && RETRYABLE.includes(s.error.code));
</script>

{#if s.phase === 'loading' || s.phase === 'refreshing'}
	<div class="loading-banner" aria-live="polite">
		<div class="loading-text">
			{#if s.phase === 'loading'}
				Loading {label}: {s.loaded} of {s.totalItems} records…
			{:else if s.asOf !== null}
				Showing a copy from {formatAge(now - s.asOf)} ago — updating ({s.loaded} of {s.totalItems})…
			{:else}
				Updating ({s.loaded} of {s.totalItems})…
			{/if}
		</div>
		<div class="progress-track">
			<div class="progress-fill" style="width: {progress * 100}%"></div>
		</div>
	</div>
{:else if s.phase === 'waiting'}
	<div class="loading-banner" aria-live="polite">
		<div class="loading-text banner-only">Discogs is busy — resuming in {seconds}s.</div>
	</div>
{:else if retryable}
	<div class="loading-banner load-error" role="alert">
		<div class="loading-text">
			Couldn't reach Discogs — showing {s.items.length} of {s.totalItems} records.
		</div>
		<button class="retry-btn" onclick={onRetry}>Retry</button>
	</div>
{/if}

{#if coolingDown}
	<div class="loading-banner" aria-live="polite">
		<div class="loading-text banner-only">Already refreshed in the last 10 minutes.</div>
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

	.load-error .loading-text,
	.loading-text.banner-only {
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
