<script lang="ts">
	import { theme } from '$lib/stores/theme';
	import { useFrame } from '$lib/frame/frame.svelte';

	const frame = useFrame();

	function cycleTheme() {
		const order: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];
		theme.set(order[(order.indexOf($theme) + 1) % order.length]);
	}
</script>

<footer class="footer">
	<p class="copy">&copy; {new Date().getFullYear()} Record Shelf. Not affiliated with Discogs.</p>
	<div class="controls">
		<button type="button" class="theme-toggle" onclick={cycleTheme}>Theme: {$theme}</button>
		{#if frame.help}
			<button type="button" class="help" onclick={() => frame.help?.()}>Keyboard shortcuts</button>
		{/if}
	</div>
</footer>

<style>
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px 24px;
		margin-top: 72px;
		padding: 16px 0 40px;
		border-top: 1px solid var(--hairline);
	}

	.copy {
		margin: 0;
		font-size: 15px;
		color: var(--muted);
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0 24px;
	}

	.controls button {
		min-height: var(--touch);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		text-decoration: underline;
		text-underline-offset: 4px;
		cursor: pointer;
	}

	.controls button:hover {
		color: var(--accent);
	}
</style>
