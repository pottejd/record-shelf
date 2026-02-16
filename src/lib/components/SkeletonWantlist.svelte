<script lang="ts">
	// Skeleton loading placeholder for the wantlist page
</script>

<div class="skeleton-wantlist">
	<div class="skeleton-nav">
		<div class="skeleton-line w-140 h-16"></div>
	</div>

	<header class="skeleton-header">
		<div class="skeleton-avatar"></div>
		<div class="skeleton-header-text">
			<div class="skeleton-line w-200 h-24"></div>
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
	.skeleton-wantlist {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.skeleton-nav {
		margin-bottom: 1.5rem;
	}

	.skeleton-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.skeleton-avatar {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--color-bg-secondary, #f0f0f0);
		animation: pulse 1.5s ease-in-out infinite;
		flex-shrink: 0;
	}

	.skeleton-header-text {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.skeleton-line {
		border-radius: 6px;
		background: var(--color-bg-secondary, #f0f0f0);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.w-40 { width: 40px; }
	.w-80 { width: 80px; }
	.w-140 { width: 140px; }
	.w-200 { width: 200px; }
	.w-full { width: 100%; }
	.h-12 { height: 12px; }
	.h-14 { height: 14px; }
	.h-16 { height: 16px; }
	.h-24 { height: 24px; }

	.skeleton-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.skeleton-search {
		height: 46px;
		border-radius: 10px;
		background: var(--color-bg-secondary, #f0f0f0);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-sort-bar {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.skeleton-pill {
		width: 72px;
		height: 30px;
		border-radius: 6px;
		background: var(--color-bg-secondary, #f0f0f0);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
	}

	.skeleton-card {
		border-radius: 10px;
		overflow: hidden;
		background: var(--color-bg-card, #fff);
		border: 1px solid var(--color-border, #e0e0e0);
	}

	.skeleton-cover {
		width: 100%;
		aspect-ratio: 1;
		background: var(--color-bg-secondary, #f0f0f0);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-info {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	@media (max-width: 600px) {
		.skeleton-wantlist {
			padding: 1rem;
		}

		.skeleton-grid {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
			gap: 0.75rem;
		}
	}
</style>
