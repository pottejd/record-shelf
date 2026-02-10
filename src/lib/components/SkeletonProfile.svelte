<script lang="ts">
	// Skeleton loading placeholder for the profile page
</script>

<div class="skeleton-profile">
	<div class="skeleton-header">
		<div class="skeleton-avatar"></div>
		<div class="skeleton-header-text">
			<div class="skeleton-line w-200 h-24"></div>
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
				<div class="skeleton-line w-60 h-12"></div>
				<div class="skeleton-line w-80 h-20"></div>
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
	.skeleton-profile {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.skeleton-header {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.skeleton-avatar {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: var(--color-bg-secondary, #f0f0f0);
		animation: pulse 1.5s ease-in-out infinite;
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
	.w-60 { width: 60px; }
	.w-80 { width: 80px; }
	.w-120 { width: 120px; }
	.w-140 { width: 140px; }
	.w-200 { width: 200px; }
	.w-full { width: 100%; }
	.h-12 { height: 12px; }
	.h-14 { height: 14px; }
	.h-16 { height: 16px; }
	.h-20 { height: 20px; }
	.h-24 { height: 24px; }
	.h-120 { height: 120px; }

	.skeleton-badges {
		display: flex;
		gap: 0.5rem;
	}

	.skeleton-badge {
		width: 80px;
		height: 24px;
		border-radius: 12px;
		background: var(--color-bg-secondary, #f0f0f0);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.skeleton-stat-card {
		background: var(--color-bg-card, #fff);
		border: 1px solid var(--color-border, #e0e0e0);
		border-radius: 16px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}

	.skeleton-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.skeleton-card {
		background: var(--color-bg-card, #fff);
		border: 1px solid var(--color-border, #e0e0e0);
		border-radius: 16px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.skeleton-cover-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	.skeleton-cover {
		aspect-ratio: 1;
		border-radius: 8px;
		background: var(--color-bg-secondary, #f0f0f0);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-list-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	@media (max-width: 600px) {
		.skeleton-profile {
			padding: 1rem;
		}

		.skeleton-stats {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
