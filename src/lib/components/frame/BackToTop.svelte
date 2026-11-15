<script lang="ts">
	import { browser } from '$app/environment';
	import { scrollBehavior } from '$lib/utils/motion';

	let show = $state(false);

	$effect(() => {
		if (!browser) return;
		const onScroll = () => {
			show = window.scrollY > window.innerHeight;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	function toTop() {
		window.scrollTo({ top: 0, behavior: scrollBehavior() });
	}
</script>

{#if show}
	<button type="button" class="btn btn-secondary top" aria-label="Back to top" onclick={toTop}>
		<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 19V5M5 12l7-7 7 7" />
		</svg>
	</button>
{/if}

<style>
	.top {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 50;
		width: var(--touch);
		min-height: var(--touch);
		height: var(--touch);
		padding: 0;
		background: var(--ground);
	}

	.top svg {
		width: 20px;
		height: 20px;
	}
</style>
