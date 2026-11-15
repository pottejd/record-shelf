<script lang="ts">
	// Skeleton loading placeholder for the wantlist page
</script>

<div class="skeleton-wantlist">
	<div class="skeleton-line w-title h-title"></div>
	<div class="skeleton-line w-80 h-18 lead-line"></div>

	<div class="skeleton-section">
		<div class="skeleton-search"></div>
		<div class="skeleton-sort-bar">
			<div class="skeleton-line w-56 h-14"></div>
			<div class="skeleton-pill"></div>
			<div class="skeleton-pill"></div>
			<div class="skeleton-pill"></div>
			<div class="skeleton-pill"></div>
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
</div>

<style>
	/* Flat, square blocks in the track colour standing in for the wantlist: the
	   title, the count, then the section's rule, search, sort and six-column grid.
	   The frame's .page owns the side gutters. A plain opacity pulse; the global
	   reduced-motion rule stops it. */
	.skeleton-wantlist {
		padding-top: 56px;
	}

	/* Inside the wantlist page's <main>, which already gives the top space. */
	:global(main) > .skeleton-wantlist {
		padding-top: 0;
	}

	.skeleton-line,
	.skeleton-pill,
	.skeleton-cover {
		background: var(--track);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.w-40 { width: 40px; }
	.w-56 { width: 56px; }
	.w-80 { width: 80px; }
	.w-title { width: 520px; max-width: 100%; }
	.w-full { width: 100%; }
	.h-12 { height: 12px; }
	.h-14 { height: 14px; }
	.h-18 { height: 18px; }
	.h-title { height: clamp(44px, 6.9vw, 88px); }

	.lead-line {
		margin-top: 16px;
	}

	/* The section to come: a rule in the track colour. */
	.skeleton-section {
		margin-top: 48px;
		padding-top: 16px;
		border-top: var(--rule) solid var(--track);
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
		margin-top: 8px;
	}

	.skeleton-pill {
		width: 56px;
		height: 14px;
	}

	.skeleton-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 32px 24px;
		margin-top: 32px;
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

		.h-title { height: 40px; }

		.skeleton-section {
			margin-top: 32px;
		}

		.skeleton-sort-bar {
			gap: 0 12px;
		}

		.skeleton-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 24px 16px;
		}
	}
</style>
