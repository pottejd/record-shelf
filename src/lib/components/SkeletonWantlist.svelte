<script lang="ts">
	// Skeleton loading placeholder for the wantlist page
</script>

<div class="skeleton-wantlist">
	<header class="skeleton-header">
		<div class="skeleton-avatar"></div>
		<div class="skeleton-header-text">
			<div class="skeleton-line w-200 h-48"></div>
			<div class="skeleton-line w-80 h-14"></div>
		</div>
	</header>

	<div class="skeleton-controls">
		<div class="skeleton-search"></div>
		<div class="skeleton-sort-bar">
			<div class="skeleton-line w-40 h-14"></div>
			<div class="skeleton-pill"></div>
			<div class="skeleton-pill"></div>
			<div class="skeleton-pill"></div>
			<div class="skeleton-pill"></div>
		</div>
	</div>

	<div class="skeleton-grid">
		{#each Array(12) as _}
			<div class="skeleton-card">
				<div class="skeleton-cover"></div>
				<div class="skeleton-info">
					<div class="skeleton-line w-full h-14"></div>
					<div class="skeleton-line w-80 h-12"></div>
					<div class="skeleton-line w-40 h-12"></div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	/* Flat, square blocks in the track colour standing in for the wantlist. The
	   frame's .page owns the side gutters. A plain opacity pulse; the global
	   reduced-motion rule stops it. */
	.skeleton-wantlist {
		padding-top: 56px;
	}

	/* Inside the wantlist page's <main>, which already gives the top space. */
	:global(main) > .skeleton-wantlist {
		padding-top: 0;
	}

	.skeleton-header {
		display: flex;
		align-items: center;
		gap: 20px;
		margin-bottom: 40px;
	}

	.skeleton-avatar,
	.skeleton-line,
	.skeleton-pill,
	.skeleton-cover {
		background: var(--track);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-avatar {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
	}

	.skeleton-header-text {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}

	.w-40 { width: 40px; }
	.w-80 { width: 80px; }
	.w-200 { width: 200px; max-width: 100%; }
	.w-full { width: 100%; }
	.h-12 { height: 12px; }
	.h-14 { height: 14px; }
	.h-48 { height: 48px; }

	.skeleton-controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 32px;
	}

	/* The search field to come: an underline in the track colour. */
	.skeleton-search {
		height: 52px;
		border-bottom: 2px solid var(--track);
	}

	.skeleton-sort-bar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 28px;
		min-height: 48px;
	}

	.skeleton-pill {
		width: 56px;
		height: 14px;
	}

	.skeleton-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 32px 24px;
	}

	.skeleton-card {
		min-width: 0;
	}

	.skeleton-cover {
		width: 100%;
		aspect-ratio: 1;
	}

	.skeleton-info {
		padding-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@media (max-width: 699px) {
		.skeleton-wantlist {
			padding-top: 32px;
		}

		:global(main) > .skeleton-wantlist {
			padding-top: 0;
		}

		.skeleton-avatar {
			width: 48px;
			height: 48px;
		}

		.skeleton-sort-bar {
			gap: 0 18px;
		}

		.skeleton-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 24px 16px;
		}
	}
</style>
