<script lang="ts">
	import { browser } from '$app/environment';

	interface Section {
		id: string;
		label: string;
	}

	let { sections }: { sections: Section[] } = $props();
	let activeSection = $state('');

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
</script>

<nav class="section-nav">
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

<style>
	.section-nav {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		margin: 0 -2rem 1.5rem;
		padding-left: 2rem;
		padding-right: 2rem;
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
		.section-nav {
			margin: 0 -1rem 1rem;
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}
</style>
