<script lang="ts">
	import { browser } from '$app/environment';
	import { scrollBehavior } from '$lib/utils/motion';

	let { onHelp }: { onHelp: () => void } = $props();

	let showTop = $state(false);

	$effect(() => {
		if (!browser) return;
		const onScroll = () => {
			showTop = window.scrollY > 600;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	function toTop() {
		window.scrollTo({ top: 0, behavior: scrollBehavior() });
	}
</script>

<div class="fab-group">
	<button class="fab" onclick={onHelp} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
		?
	</button>
	{#if showTop}
		<button class="fab" onclick={toTop} aria-label="Back to top" title="Back to top">↑</button>
	{/if}
</div>

<style>
	.fab-group {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		z-index: 50;
	}

	.fab {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--color-border);
		background: var(--color-bg-card);
		color: var(--color-text);
		font-size: 1.125rem;
		line-height: 1;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.fab:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}
</style>
