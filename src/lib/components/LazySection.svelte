<script lang="ts">
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';

	let { children, height = '200px' }: { children: Snippet; height?: string } = $props();

	let visible = $state(!browser);
	let el: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!browser || !el || visible) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					visible = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '100px' }
		);
		observer.observe(el);
		return () => observer.disconnect();
	});
</script>

<div bind:this={el}>
	{#if visible}
		{@render children()}
	{:else}
		<div class="placeholder" style:min-height={height}></div>
	{/if}
</div>

<style>
	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-secondary);
		border-radius: 8px;
		opacity: 0.3;
	}
</style>
