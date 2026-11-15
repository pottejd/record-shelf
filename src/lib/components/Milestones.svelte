<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	interface Milestone {
		count: number;
		label: string;
		date: Date | null;
		reached: boolean;
		icon: string;
	}

	const milestoneTargets = [
		{ count: 10, label: 'First Ten', icon: '1' },
		{ count: 50, label: 'Fifty Club', icon: '50' },
		{ count: 100, label: 'Century', icon: '100' },
		{ count: 250, label: 'Collector', icon: '250' },
		{ count: 500, label: 'Serious', icon: '500' },
		{ count: 1000, label: 'Millennial', icon: '1K' },
		{ count: 2500, label: 'Elite', icon: '2.5K' },
		{ count: 5000, label: 'Legend', icon: '5K' },
		{ count: 10000, label: 'Mythic', icon: '10K' }
	];

	let milestones = $derived(calculateMilestones(items));

	function calculateMilestones(items: DiscogsCollectionItem[]): Milestone[] {
		// Sort items by date added (oldest first)
		const sorted = [...items].sort(
			(a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime()
		);

		return milestoneTargets.map(({ count, label, icon }) => {
			const reached = sorted.length >= count;
			let date: Date | null = null;

			if (reached && sorted[count - 1]) {
				date = new Date(sorted[count - 1].date_added);
			}

			return { count, label, date, reached, icon };
		});
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric'
		});
	}

	// Find the next milestone to reach
	let nextMilestone = $derived(milestones.find(m => !m.reached));
	let progress = $derived(nextMilestone
		? (items.length / nextMilestone.count) * 100
		: 100);
</script>

<div class="milestones">
	{#if nextMilestone}
		<div class="progress-section">
			<div class="progress-header">
				<span class="progress-label">Next: {nextMilestone.label}</span>
				<span class="progress-count">{items.length} / {nextMilestone.count}</span>
			</div>
			<div class="progress-bar">
				<div class="progress-fill" style:width="{progress}%"></div>
			</div>
			<p class="progress-hint">{nextMilestone.count - items.length} more to go!</p>
		</div>
	{/if}

	<div class="milestone-grid rows">
		{#each milestones.filter(m => m.reached || m === nextMilestone) as milestone}
			<div class="milestone" class:reached={milestone.reached} class:next={milestone === nextMilestone}>
				<div class="milestone-icon">
					{milestone.icon}
				</div>
				<div class="milestone-info">
					<span class="milestone-label">{milestone.label}</span>
					{#if milestone.reached && milestone.date}
						<span class="milestone-date">{formatDate(milestone.date)}</span>
					{:else}
						<span class="milestone-date pending">In progress</span>
					{/if}
				</div>
				{#if milestone.reached}
					<svg aria-hidden="true" class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
						<polyline points="20 6 9 17 4 12" />
					</svg>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.milestones {
		display: flex;
		flex-direction: column;
	}

	/* The next milestone: its name and count, an ink bar on the track, what is left. */
	.progress-section {
		padding: 0 0 16px;
		border-bottom: 1px solid var(--hairline);
	}

	.progress-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 16px;
	}

	.progress-label {
		font-size: 18px;
	}

	.progress-count {
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.progress-bar {
		height: 8px;
		margin-top: 12px;
		background: var(--track);
	}

	.progress-fill {
		height: 100%;
		background: var(--ink);
	}

	.progress-hint {
		margin: 8px 0 0;
		font-size: 15px;
		color: var(--muted);
	}

	/* A row per milestone, divided by hairlines. */
	.milestone {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 52px;
		padding: 6px 0;
	}

	.milestone-icon {
		width: 56px;
		flex-shrink: 0;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.milestone.next .milestone-icon {
		color: var(--muted);
	}

	.milestone-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 2px 16px;
	}

	.milestone-label {
		font-size: 18px;
	}

	.milestone-date {
		font-size: 15px;
		color: var(--muted);
	}

	.check-icon {
		width: 20px;
		height: 20px;
		color: var(--ink);
		flex-shrink: 0;
	}
</style>
