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
	<section class="section highlight-card">
		<span class="highlight-label small">Oldest release</span>
		<div class="highlight-content">
			<img src={stats.oldestRelease.thumb || '/placeholder.svg'} alt="" class="highlight-thumb cover" />
			<div>
				<p class="highlight-title">{stats.oldestRelease.title}</p>
				<p class="highlight-year figure">{stats.oldestRelease.year}</p>
			</div>
		</div>
	</section>
{/if}
{#if stats.newestRelease}
	<section class="section highlight-card">
		<span class="highlight-label small">Newest release</span>
		<div class="highlight-content">
			<img src={stats.newestRelease.thumb || '/placeholder.svg'} alt="" class="highlight-thumb cover" />
			<div>
				<p class="highlight-title">{stats.newestRelease.title}</p>
				<p class="highlight-year figure">{stats.newestRelease.year}</p>
			</div>
		</div>
	</section>
{/if}

<style>
	.highlight-content {
		display: flex;
		align-items: center;
		gap: 20px;
		margin-top: 12px;
	}

	.highlight-thumb {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		background: var(--track);
	}

	.highlight-title {
		margin: 0;
		font-weight: 600;
		font-size: 18px;
		line-height: 1.25;
	}

	.highlight-year {
		margin: 4px 0 0;
	}
</style>
