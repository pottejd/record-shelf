<script lang="ts">
	// Skeleton loading placeholder for the profile page
</script>

<div class="skeleton-profile">
	<div class="skeleton-header">
		<div class="skeleton-avatar"></div>
		<div class="skeleton-header-text">
			<div class="skeleton-line w-200 h-48"></div>
			<div class="skeleton-line w-120 h-16"></div>
			<div class="skeleton-badges">
				<div class="skeleton-badge"></div>
				<div class="skeleton-badge"></div>
				<div class="skeleton-badge"></div>
			</div>
		</div>
	</div>

	<div class="skeleton-stats">
		{#each Array(6) as _}
			<div class="skeleton-stat-card">
				<div class="skeleton-line w-80 h-20"></div>
				<div class="skeleton-line w-60 h-12"></div>
			</div>
		{/each}
	</div>

	<div class="skeleton-grid">
		<div class="skeleton-card">
			<div class="skeleton-line w-140 h-16"></div>
			<div class="skeleton-cover-grid">
				{#each Array(4) as _}
					<div class="skeleton-cover"></div>
				{/each}
			</div>
		</div>
		<div class="skeleton-card">
			<div class="skeleton-line w-200 h-16"></div>
			<div class="skeleton-line w-full h-120"></div>
		</div>
	</div>

	<div class="skeleton-grid">
		<div class="skeleton-card">
			<div class="skeleton-line w-120 h-16"></div>
			{#each Array(5) as _}
				<div class="skeleton-list-item">
					<div class="skeleton-line w-140 h-14"></div>
					<div class="skeleton-line w-40 h-14"></div>
				</div>
			{/each}
		</div>
		<div class="skeleton-card">
			<div class="skeleton-line w-120 h-16"></div>
			{#each Array(5) as _}
				<div class="skeleton-list-item">
					<div class="skeleton-line w-140 h-14"></div>
					<div class="skeleton-line w-40 h-14"></div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	/* Flat, square blocks in the track colour standing in for the profile. The
	   frame's .page owns the side gutters. A plain opacity pulse; the global
	   reduced-motion rule stops it. */
	.skeleton-profile {
		padding-top: 56px;
	}

	/* Inside the profile page's <main>, which already gives the top space. */
	:global(main) > .skeleton-profile {
		padding-top: 0;
	}

	.skeleton-header {
		display: flex;
		align-items: flex-start;
		gap: 20px;
		margin-bottom: 40px;
	}

	.skeleton-avatar,
	.skeleton-line,
	.skeleton-badge,
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
	.w-60 { width: 60px; }
	.w-80 { width: 80px; }
	.w-120 { width: 120px; }
	.w-140 { width: 140px; }
	.w-200 { width: 200px; max-width: 100%; }
	.w-full { width: 100%; }
	.h-12 { height: 12px; }
	.h-14 { height: 14px; }
	.h-16 { height: 16px; }
	.h-20 { height: 20px; }
	.h-48 { height: 48px; }
	.h-120 { height: 120px; }

	.skeleton-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.skeleton-badge {
		width: 80px;
		height: 28px;
	}

	.skeleton-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 24px;
		margin-bottom: 56px;
	}

	.skeleton-stat-card {
		border-top: 1px solid var(--hairline);
		padding-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 0 64px;
	}

	/* A section to come: the thick rule in the track colour, then its blocks. */
	.skeleton-card {
		border-top: var(--rule) solid var(--track);
		padding-top: 16px;
		margin-bottom: var(--section-gap);
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.skeleton-cover-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
	}

	.skeleton-cover {
		aspect-ratio: 1;
	}

	.skeleton-list-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@media (max-width: 699px) {
		.skeleton-profile {
			padding-top: 32px;
		}

		:global(main) > .skeleton-profile {
			padding-top: 0;
		}

		.skeleton-stats {
			grid-template-columns: repeat(2, 1fr);
		}

		.skeleton-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
