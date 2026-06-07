<script lang="ts">
	interface Release {
		thumb?: string;
		title: string;
		year: number;
	}
	let { stats }: {
		stats: { oldestRelease?: Release | null; newestRelease?: Release | null };
	} = $props();
</script>

{#if stats.oldestRelease}
	<section class="card highlight-card">
		<span class="highlight-label">Oldest Release</span>
		<div class="highlight-content">
			<img src={stats.oldestRelease.thumb || '/placeholder.svg'} alt="" class="highlight-thumb" />
			<div>
				<p class="highlight-title">{stats.oldestRelease.title}</p>
				<p class="highlight-year">{stats.oldestRelease.year}</p>
			</div>
		</div>
	</section>
{/if}
{#if stats.newestRelease}
	<section class="card highlight-card">
		<span class="highlight-label">Newest Release</span>
		<div class="highlight-content">
			<img src={stats.newestRelease.thumb || '/placeholder.svg'} alt="" class="highlight-thumb" />
			<div>
				<p class="highlight-title">{stats.newestRelease.title}</p>
				<p class="highlight-year">{stats.newestRelease.year}</p>
			</div>
		</div>
	</section>
{/if}

<style>
	.highlight-card {
		background: linear-gradient(135deg, var(--color-bg-secondary, #f5f5f5), var(--color-bg-card, #fff));
	}

	.highlight-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-text-tertiary, #999);
	}

	.highlight-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.75rem;
	}

	.highlight-thumb {
		width: 64px;
		height: 64px;
		border-radius: 8px;
		object-fit: cover;
		background: var(--color-bg-secondary, #f5f5f5);
	}

	.highlight-title {
		margin: 0;
		font-weight: 600;
		font-size: 1rem;
	}

	.highlight-year {
		margin: 0.25rem 0 0;
		font-size: 1.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	/* Preserve the profile page's mobile card override, which no longer reaches
	   these cards now that they live in a child component (Svelte scopes it). */
	@media (max-width: 600px) {
		.highlight-card {
			padding: 1rem;
			border-radius: 12px;
		}
	}
</style>
