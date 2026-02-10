<script lang="ts">
	import '../app.css';
	import { theme, applyTheme } from '$lib/stores/theme';
	import { navigating } from '$app/stores';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Apply saved theme on mount
	if (browser) {
		applyTheme($theme);
	}

	function cycleTheme() {
		const order: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];
		const current = order.indexOf($theme);
		const next = order[(current + 1) % order.length];
		theme.set(next);
	}
</script>

<svelte:head>
	<meta name="theme-color" content={$theme === 'dark' ? '#0a0a0a' : '#1a1a1a'} />
</svelte:head>

{#if $navigating}
	<div class="loading-bar"></div>
{/if}

<button class="theme-toggle" onclick={cycleTheme} aria-label="Toggle theme: {$theme}">
	{#if $theme === 'light'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
		</svg>
	{:else if $theme === 'dark'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
			<line x1="8" y1="21" x2="16" y2="21" />
			<line x1="12" y1="17" x2="12" y2="21" />
		</svg>
	{/if}
</button>

{@render children()}

<style>
	.loading-bar {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 3px;
		background: var(--gradient-primary);
		z-index: 200;
		animation: loading 1.5s ease-in-out infinite;
	}

	@keyframes loading {
		0% { transform: translateX(-100%); }
		50% { transform: translateX(0%); }
		100% { transform: translateX(100%); }
	}

	.theme-toggle {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		color: var(--color-text-secondary);
		cursor: pointer;
		z-index: 100;
		transition: color 0.2s, background-color 0.2s, border-color 0.2s;
		box-shadow: var(--shadow-md);
	}

	.theme-toggle:hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.theme-toggle svg {
		width: 18px;
		height: 18px;
	}
</style>
