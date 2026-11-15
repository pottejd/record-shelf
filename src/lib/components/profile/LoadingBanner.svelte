<script lang="ts">
	import type { EngineState } from '$lib/sync/engine';

	let { state: s, label = 'collection', reserve = false, onRetry }: {
		state: EngineState<unknown>;
		label?: string;
		/** Hold one line's room whether or not there is anything to say, so the
		 *  one-line states come and go without moving anything under them. Only the
		 *  error, with its button, takes more room. */
		reserve?: boolean;
		onRetry: () => void;
	} = $props();

	// The page shows its own message or redirect for these; every other error gets the Retry alert.
	const PAGE_HANDLED = ['NOT_FOUND', 'PRIVATE', 'TOKEN_REQUIRED', 'BAD_TOKEN'];

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
	let retryable = $derived(s.phase === 'error' && s.error !== null && !PAGE_HANDLED.includes(s.error.code));
	let loading = $derived(s.phase === 'loading' || s.phase === 'refreshing');
</script>

<!-- Always present, so a reserved line keeps its room when there is nothing to say. -->
<div class="status" class:reserve>
	{#if loading}
		<div class="loading-banner" aria-live="polite">
			<div class="loading-text">
				{#if s.phase === 'loading' && s.totalItems === 0}
					Loading {label}…
				{:else if s.phase === 'loading'}
					Loading {label}: {s.loaded} of {s.totalItems} records…
				{:else if s.asOf !== null}
					Showing a copy from {formatAge(now - s.asOf)} ago — updating ({s.loaded} of {s.totalItems})…
				{:else}
					Updating ({s.loaded} of {s.totalItems})…
				{/if}
			</div>
			{#if s.totalItems > 0}
				<div class="progress-track">
					<div class="progress-fill" style="width: {progress * 100}%"></div>
				</div>
			{/if}
		</div>
	{:else if s.phase === 'waiting'}
		<div class="loading-banner" aria-live="polite">
			<div class="loading-text banner-only">Discogs is busy or unreachable — retrying in {seconds}s.</div>
		</div>
	{:else if retryable}
		<div class="loading-banner load-error error-note" role="alert">
			<div class="loading-text">
				Couldn't reach Discogs — showing {s.items.length} of {s.totalItems} records.
			</div>
			<button class="retry-btn btn btn-secondary" onclick={onRetry}>Retry</button>
		</div>
	{/if}

	<!-- A reserved line has room for one line: the cooldown waits for the line above to go. -->
	{#if coolingDown && !(reserve && (loading || s.phase === 'waiting' || retryable))}
		<div class="loading-banner" aria-live="polite">
			<div class="loading-text banner-only">Already refreshed in the last 10 minutes.</div>
		</div>
	{/if}
</div>

<style>
	/* Open on the ground: a muted line and, while loading, a thin ink bar on the track. */
	.loading-banner {
		margin-bottom: 32px;
	}

	.loading-text {
		font-size: 15px;
		color: var(--muted);
		margin-bottom: 8px;
	}

	/* The error takes the global .error-note: ink text beside an accent rule. */
	.load-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px 24px;
		margin-bottom: 32px;
	}

	.load-error .loading-text {
		font-size: 17px;
		color: var(--ink);
	}

	.load-error .loading-text,
	.loading-text.banner-only {
		margin-bottom: 0;
	}

	.retry-btn {
		flex-shrink: 0;
	}

	.progress-track {
		height: 4px;
		background: var(--track);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--ink);
		transition: width 0.3s ease;
	}

	/* The reserved line: 32px, all of it inside the gap under the tab row. 5px, a
	   20px line of text, 5px, then a 2px progress line. A line too long for the
	   width ends in an ellipsis rather than wrapping onto a second line. */
	.reserve {
		min-height: 32px;
	}

	/* Unreserved, the wrapper makes no box of its own, so an empty line takes no
	   place in a parent's flex gap (Compare stacks its lines that way). */
	.status:not(.reserve) {
		display: contents;
	}

	.reserve .loading-banner {
		margin-bottom: 0;
	}

	.reserve .loading-text {
		margin: 0;
		padding-top: 5px;
		line-height: 20px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.reserve .progress-track {
		width: min(100%, 360px);
		height: 2px;
		margin-top: 5px;
	}

	/* The error may take the room it needs, with space above and below (Overview's
	   lead line sits 16px higher than the other tabs' first section, so it keeps 16px). */
	.reserve .load-error {
		margin: 8px 0 32px;
	}

	.reserve .load-error .loading-text {
		padding-top: 0;
		line-height: 1.4;
		white-space: normal;
	}
</style>
