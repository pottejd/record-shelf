<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	interface Milestone {
		count: number;
		label: string;
		date: Date | null;
		reached: boolean;
	}

	const milestoneTargets = [
		{ count: 10, label: 'First Ten' },
		{ count: 50, label: 'Fifty Club' },
		{ count: 100, label: 'Century' },
		{ count: 250, label: 'Collector' },
		{ count: 500, label: 'Serious' },
		{ count: 1000, label: 'Millennial' },
		{ count: 2500, label: 'Elite' },
		{ count: 5000, label: 'Legend' },
		{ count: 10000, label: 'Mythic' }
	];

	let milestones = $derived(calculateMilestones(items));

	function calculateMilestones(items: DiscogsCollectionItem[]): Milestone[] {
		// Sort items by date added (oldest first)
		const sorted = [...items].sort(
			(a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime()
		);

		return milestoneTargets.map(({ count, label }) => {
			const reached = sorted.length >= count;
			let date: Date | null = null;

			if (reached && sorted[count - 1]) {
				date = new Date(sorted[count - 1].date_added);
			}

			return { count, label, date, reached };
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
	/** The milestones reached, the biggest first. */
	let reached = $derived(milestones.filter((m) => m.reached).reverse());
</script>

{#if nextMilestone}
	<div class="next">
		<div class="next-header">
			<span class="next-label">Next: {nextMilestone.label}, at {nextMilestone.count.toLocaleString()} records</span>
			<span class="next-count">{items.length.toLocaleString()} of {nextMilestone.count.toLocaleString()}</span>
		</div>
		<div class="track" aria-hidden="true">
			<div class="fill" style:width="{progress}%"></div>
		</div>
		<p class="to-go">{(nextMilestone.count - items.length).toLocaleString()} to go</p>
	</div>
{/if}

{#if reached.length > 0}
	<ul class="reached">
		{#each reached as milestone (milestone.count)}
			<li class="milestone">
				<span class="milestone-count">{milestone.count.toLocaleString()}</span>
				<span class="milestone-label">{milestone.label}</span>
				{#if milestone.date}
					<span class="milestone-date">{formatDate(milestone.date)}</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	/* The next milestone: its name and count, an ink bar on the track, what is left. */
	.next {
		padding: 16px 0;
		border-bottom: 1px solid var(--hairline);
	}

	.next-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 16px;
	}

	.next-label {
		font-size: 18px;
	}

	.next-count {
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.track {
		height: 8px;
		margin-top: 12px;
		background: var(--track);
	}

	.fill {
		height: 100%;
		background: var(--ink);
	}

	.to-go {
		margin: 8px 0 0;
		font-size: 15px;
		color: var(--muted);
	}

	/* A row per milestone reached, the biggest first, each under a hairline. */
	.reached {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.milestone {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 52px;
		border-bottom: 1px solid var(--hairline);
	}

	.milestone-count {
		min-width: 56px;
		flex-shrink: 0;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.milestone-label {
		flex: 1;
		min-width: 0;
		font-size: 18px;
	}

	.milestone-date {
		flex-shrink: 0;
		font-size: 15px;
		color: var(--muted);
	}
</style>
