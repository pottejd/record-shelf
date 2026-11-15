<script lang="ts">
	import { page } from '$app/state';
	import { useFrame } from '$lib/frame/frame.svelte';
	import { barLinks, hasRefresh } from '$lib/frame/links';

	const frame = useFrame();

	let links = $derived(barLinks(page.route.id, page.params));
	let refresh = $derived(hasRefresh(page.route.id));
</script>

<header class="bar">
	<a href="/" class="brand" aria-label="Record Shelf home">
		<svg aria-hidden="true" viewBox="0 0 48 48" fill="none" class="mark">
			<circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="3" />
			<circle cx="24" cy="24" r="4" fill="currentColor" />
		</svg>
		<span class="words">Record Shelf</span>
	</a>
	<nav class="links" aria-label="Site">
		{#each links as link (link.href)}
			{#if link.external}
				<a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
			{:else}
				<a href={link.href}>{link.label}</a>
			{/if}
		{/each}
		{#if refresh}
			<button
				type="button"
				class="refresh"
				aria-label="Refresh collection"
				disabled={!frame.refresh.run || frame.refresh.busy}
				onclick={() => frame.refresh.run?.()}
			>
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class:turning={frame.refresh.busy}
				>
					<polyline points="23 4 23 10 17 10" />
					<polyline points="1 20 1 14 7 14" />
					<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
				</svg>
			</button>
		{/if}
	</nav>
</header>

<style>
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px 24px;
		padding-top: 32px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-width: var(--touch);
		height: var(--touch);
		text-decoration: none;
		font-size: 18px;
		font-weight: 700;
	}

	.mark {
		width: 30px;
		height: 30px;
	}

	.links {
		display: flex;
		align-items: center;
		gap: 24px;
		flex-wrap: wrap;
	}

	.links a {
		display: inline-flex;
		align-items: center;
		height: var(--touch);
		font-size: 17px;
		font-weight: 500;
	}

	.refresh {
		width: var(--touch);
		height: var(--touch);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		color: var(--ink);
		background: transparent;
		border: 2px solid var(--ink);
		border-radius: 50%;
		cursor: pointer;
	}

	.refresh:hover:not(:disabled) {
		color: var(--accent);
		border-color: var(--accent);
	}

	.refresh:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh svg {
		width: 18px;
		height: 18px;
	}

	.turning {
		animation: spin 1s linear infinite;
	}

	@media (max-width: 699px) {
		.words {
			display: none;
		}

		.bar {
			gap: 12px;
		}

		.links {
			gap: 10px;
		}
	}
</style>
