<script lang="ts">
	// Stands in for the profile before it is known: the title, the tab row, the lead
	// line and three empty boards, each taking the space the real one will, so the
	// page does not jump when they arrive. The tab row is placeholders rather than
	// the real links: nothing here is ready to be used yet.
	const TAB_WIDTHS = [92, 82, 70, 76, 62];
</script>

<div class="skeleton-profile" aria-hidden="true">
	<div class="title block"></div>

	<div class="tabs">
		{#each TAB_WIDTHS as w, i (i)}
			<div class="tab"><div class="block" style="width: {w}px"></div></div>
		{/each}
	</div>

	<div class="lead">
		<div class="block line"></div>
		<div class="block line short"></div>
	</div>

	<div class="boards">
		{#each [0, 1, 2] as i (i)}
			<div class="board"></div>
		{/each}
	</div>
</div>

<style>
	/* Flat, square blocks in the track colour pulse gently (the global reduced-motion
	   rule stops it). The boards are the real thing, so they stay still and ink.
	   Every size below mirrors the profile page: h1, ProfileTabs, .tab-body, .lead
	   and Shelf. The frame's .page owns the side gutters. */
	.block {
		background: var(--track);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.title {
		width: min(560px, 80%);
		height: calc(0.95 * clamp(44px, 6.9vw, 88px));
		margin-top: 56px;
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

	/* 32px under the tabs as on Overview, then the lead line at 20px / 1.4, wrapped
	   in two lines as on the page. */
	.lead {
		display: flex;
		flex-direction: column;
		justify-content: space-around;
		max-width: 44ch;
		height: 56px;
		margin-top: 32px;
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
