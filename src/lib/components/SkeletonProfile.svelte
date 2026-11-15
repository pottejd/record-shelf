<script lang="ts">
	import type { Snippet } from 'svelte';

	// Stands in for the profile before it is known: the title, the tab row, the
	// status line, the lead line and three empty boards, each taking the space the
	// real one will, so the page does not move when they arrive. The tab row is
	// placeholders rather than the real links: nothing here is ready to be used yet.
	let { title, status }: {
		/** The title the page will have. Drawn as a placeholder of its exact size, so a
		 *  title that wraps onto two lines takes two lines here too. */
		title?: string;
		/** The page's status line, shown in its place under the tab row. */
		status?: Snippet;
	} = $props();

	const TAB_WIDTHS = [92, 82, 70, 76, 62];
</script>

<div class="skeleton-profile">
	{#if title}
		<p class="title text block" aria-hidden="true">{title}</p>
	{:else}
		<div class="title block" aria-hidden="true"></div>
	{/if}

	<div class="tabs" aria-hidden="true">
		{#each TAB_WIDTHS as w, i (i)}
			<div class="tab"><div class="block" style="width: {w}px"></div></div>
		{/each}
	</div>

	{#if status}
		{@render status()}
	{:else}
		<div class="status-room"></div>
	{/if}

	<div class="lead" aria-hidden="true">
		<div class="block line"></div>
		<div class="block line short"></div>
	</div>

	<div class="boards" aria-hidden="true">
		{#each [0, 1, 2] as i (i)}
			<div class="board"></div>
		{/each}
	</div>
</div>

<style>
	/* Flat, square blocks in the track colour pulse gently (the global reduced-motion
	   rule stops it). The boards are the real thing, so they stay still and ink.
	   Every size below mirrors the profile page: h1, ProfileTabs, the reserved
	   status line, .tab-body, .lead and Shelf. The frame's .page owns the side
	   gutters. */
	.block {
		background: var(--track);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.title {
		width: min(560px, 80%);
		height: calc(0.95 * clamp(44px, 6.9vw, 88px));
		margin-top: 56px;
	}

	/* The title's own words, set as the page's h1 sets them but in the track colour,
	   so the block is exactly as wide and as many lines tall as the title will be. */
	.title.text {
		width: fit-content;
		max-width: 100%;
		height: auto;
		margin-bottom: 0;
		font-size: clamp(44px, 6.9vw, 88px);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 0.95;
		overflow-wrap: anywhere;
		color: transparent;
		user-select: none;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0 36px;
		margin-top: 48px;
	}

	.tab {
		display: flex;
		align-items: center;
		height: 52px;
	}

	.tab .block {
		height: 16px;
	}

	/* The status line's reserved room (LoadingBanner's .reserve), when the page
	   gives no line of its own. */
	.status-room {
		height: var(--status-room);
	}

	/* Straight under the status line, as on Overview, then the lead line at
	   20px / 1.4, wrapped in two lines as on the page. */
	.lead {
		display: flex;
		flex-direction: column;
		justify-content: space-around;
		max-width: 44ch;
		height: 56px;
		font-size: 20px;
	}

	.line {
		height: 16px;
	}

	.line.short {
		width: 55%;
	}

	.boards {
		margin-top: 40px;
	}

	.board {
		box-sizing: content-box;
		height: 104px;
		margin-top: 18px;
		border-bottom: 8px solid var(--ink);
	}

	.board:first-child {
		margin-top: 0;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@media (max-width: 699px) {
		.title {
			height: calc(0.95 * 40px);
			margin-top: 32px;
		}

		.title.text {
			height: auto;
			font-size: 40px;
		}

		.tabs {
			justify-content: space-between;
			gap: 0 8px;
		}

		.tab .block {
			height: 13px;
			max-width: 56px;
		}

		.lead {
			height: 50px;
			font-size: 18px;
		}

		.boards {
			margin-top: 32px;
		}

		.board {
			height: 44px;
			margin-top: 10px;
			border-bottom-width: 5px;
		}
	}
</style>
