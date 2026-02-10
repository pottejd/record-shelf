<script lang="ts">
	import { browser } from '$app/environment';

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
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeSection = entry.target.id;
					}
				}
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
			activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
			>
				{section.label}
			</a>
		{/each}
	</nav>
</div>

<style>
	.section-nav-wrapper {
		position: sticky;
		top: 0;
		z-index: 50;
		margin: 0 -2rem 1.5rem;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
	}

	.section-nav-wrapper::before,
	.section-nav-wrapper::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2rem;
		z-index: 1;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.section-nav-wrapper::before {
		left: 0;
		background: linear-gradient(to right, var(--color-bg), transparent);
	}

	.section-nav-wrapper::after {
		right: 0;
		background: linear-gradient(to left, var(--color-bg), transparent);
	}

	.section-nav-wrapper.fade-left::before {
		opacity: 1;
	}

	.section-nav-wrapper.fade-right::after {
		opacity: 1;
	}

	.section-nav {
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem 2rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.section-nav::-webkit-scrollbar {
		display: none;
	}

	.nav-item {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-tertiary);
		text-decoration: none;
		border-radius: 6px;
		white-space: nowrap;
		transition: color 0.15s, background-color 0.15s;
	}

	.nav-item:hover {
		color: var(--color-text-secondary);
		background: var(--color-bg-secondary);
	}

	.nav-item.active {
		color: var(--color-primary);
		background: rgba(99, 102, 241, 0.1);
		font-weight: 600;
	}

	@media (max-width: 600px) {
		.section-nav-wrapper {
			margin: 0 -1rem 1rem;
		}

		.section-nav {
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}
</style>
