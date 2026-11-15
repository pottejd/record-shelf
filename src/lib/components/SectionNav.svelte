<script lang="ts">
	import { browser } from '$app/environment';
	import { scrollBehavior } from '$lib/utils/motion';

	interface Section {
		id: string;
		label: string;
	}

	let { sections }: { sections: Section[] } = $props();
	let activeSection = $state('');
	let navEl: HTMLElement | undefined = $state();
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	function updateScrollIndicators() {
		if (!navEl) return;
		canScrollLeft = navEl.scrollLeft > 4;
		canScrollRight = navEl.scrollLeft + navEl.clientWidth < navEl.scrollWidth - 4;
	}

	$effect(() => {
		if (!browser) return;

		const observer = new IntersectionObserver(
			(entries) => {
				// Among the sections intersecting in this batch, make the topmost one
				// active. Iterating and taking the last would let a lower section win
				// during fast scrolls, causing the highlight to flicker.
				const visible = entries.filter((e) => e.isIntersecting);
				if (visible.length === 0) return;
				const topmost = visible.reduce((a, b) =>
					a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
				);
				activeSection = topmost.target.id;
			},
			{ rootMargin: '-20% 0px -60% 0px' }
		);

		for (const section of sections) {
			const el = document.getElementById(section.id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});

	// Auto-scroll active nav item into view
	$effect(() => {
		if (!browser || !navEl || !activeSection) return;
		const activeEl = navEl.querySelector(`[href="#${activeSection}"]`);
		if (activeEl) {
			activeEl.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest', inline: 'center' });
		}
	});

	// Track scroll indicators
	$effect(() => {
		if (!browser || !navEl) return;
		updateScrollIndicators();
		const el = navEl;
		el.addEventListener('scroll', updateScrollIndicators, { passive: true });
		const ro = new ResizeObserver(updateScrollIndicators);
		ro.observe(el);
		return () => {
			el.removeEventListener('scroll', updateScrollIndicators);
			ro.disconnect();
		};
	});
</script>

<div class="section-nav-wrapper" class:fade-left={canScrollLeft} class:fade-right={canScrollRight}>
	<nav class="section-nav" bind:this={navEl}>
		{#each sections as section}
			<a
				href="#{section.id}"
				class="nav-item"
				class:active={activeSection === section.id}
				aria-current={activeSection === section.id ? "true" : undefined}
			>
				{section.label}
			</a>
		{/each}
	</nav>
</div>

<style>
	/* Sticks to the top while the page scrolls: names in ink on the ground, the
	   current one bold with an ink line under it. */
	.section-nav-wrapper {
		position: sticky;
		top: 0;
		z-index: 50;
		margin: 0 0 24px;
		background: var(--ground);
		border-bottom: 1px solid var(--hairline);
	}

	.section-nav {
		display: flex;
		gap: 24px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.section-nav::-webkit-scrollbar {
		display: none;
	}

	.nav-item {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-size: 17px;
		font-weight: 500;
		color: var(--ink);
		text-decoration: none;
		white-space: nowrap;
	}

	.nav-item:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.nav-item.active {
		font-weight: 700;
		box-shadow: inset 0 -3px 0 var(--ink);
	}
</style>
