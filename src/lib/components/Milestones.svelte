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

	<div class="milestone-grid">
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
					<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
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
		gap: 1.25rem;
	}

	.progress-section {
		padding: 1rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
		border-radius: 12px;
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.progress-label {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.progress-count {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.progress-bar {
		height: 8px;
		background: var(--color-bg-tertiary);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #6366f1, #8b5cf6);
		border-radius: 4px;
		transition: width 0.5s ease;
	}

	.progress-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.milestone-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.milestone {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border-radius: 10px;
		background: var(--color-bg-secondary);
		opacity: 0.5;
		transition: opacity 0.2s, transform 0.2s;
	}

	.milestone.reached {
		opacity: 1;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
	}

	.milestone.next {
		opacity: 1;
		border: 2px dashed var(--color-primary);
		background: transparent;
	}

	.milestone-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: white;
		font-weight: 700;
		font-size: 0.75rem;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.milestone.next .milestone-icon {
		background: var(--color-bg-tertiary);
		color: var(--color-text-secondary);
	}

	.milestone-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.milestone-label {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.milestone-date {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.milestone-date.pending {
		color: var(--color-primary);
		font-style: italic;
	}

	.check-icon {
		width: 20px;
		height: 20px;
		color: #10b981;
		flex-shrink: 0;
	}
</style>
