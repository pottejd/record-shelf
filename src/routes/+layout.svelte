<script lang="ts">
	import '../app.css';
	import '@fontsource-variable/bricolage-grotesque/wght.css';
	import { theme, applyTheme } from '$lib/stores/theme';
	import { navigating } from '$app/stores';
	import { browser } from '$app/environment';
	import { initFrame } from '$lib/frame/frame.svelte';
	import TopBar from '$lib/components/frame/TopBar.svelte';
	import SiteFooter from '$lib/components/frame/SiteFooter.svelte';
	import BackToTop from '$lib/components/frame/BackToTop.svelte';
	import SkeletonWantlist from '$lib/components/SkeletonWantlist.svelte';

	let { children } = $props();

	initFrame();

	let isNavigatingToWantlist = $derived(
		$navigating?.to?.url.pathname.match(/^\/u\/[^/]+\/wantlist$/) != null
	);

	// Apply saved theme on mount
	if (browser) {
		applyTheme($theme);
	}
</script>

<a href="#main-content" class="skip-link">Skip to content</a>

{#if $navigating}
	<div class="loading-bar"></div>
{/if}

<div class="page">
	<TopBar />
	{#if isNavigatingToWantlist}
		<SkeletonWantlist />
	{:else}
		{@render children()}
	{/if}
	<SiteFooter />
</div>

<BackToTop />

<style>
	.loading-bar {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 3px;
		background: var(--ink);
		z-index: 200;
		animation: loading 1.5s ease-in-out infinite;
	}

	@keyframes loading {
		0% { transform: translateX(-100%); }
		50% { transform: translateX(0%); }
		100% { transform: translateX(100%); }
	}
</style>
