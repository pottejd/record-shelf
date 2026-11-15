<script lang="ts">
	import { TABS, TAB_LABELS, tabHref, type TabId } from '$lib/profile/tabs';

	let { active, url }: { active: TabId; url: URL } = $props();

	/** The open tab's link stays a real link, but a plain click on it does nothing:
	 *  the address, the Records filters and the history stay as they are. */
	function stayPut(e: MouseEvent) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
	}
</script>

<nav class="tabs" aria-label="Profile sections">
	{#each TABS as id (id)}
		<a
			href={tabHref(url, id)}
			class="tab"
			class:active={id === active}
			aria-current={id === active ? 'page' : undefined}
			onclick={id === active ? stayPut : undefined}
			data-sveltekit-noscroll
		>
			{TAB_LABELS[id]}
		</a>
	{/each}
</nav>

<style>
	.tabs {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: 0 36px;
		margin-top: 48px;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		height: 52px;
		font-size: 21px;
		font-weight: 500;
		color: var(--muted);
		text-decoration: none;
	}

	.tab:hover {
		color: var(--ink);
	}

	/* The open tab: ink, bold, with a 6px accent line along its foot. */
	.tab.active {
		font-weight: 700;
		color: var(--ink);
		box-shadow: inset 0 -6px 0 var(--accent);
	}

	@media (max-width: 699px) {
		.tabs {
			justify-content: space-between;
			gap: 0 8px;
		}

		.tab {
			font-size: 16px;
		}
	}
</style>
