<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	interface ActivityPeriod {
		label: string;
		count: number;
		percentage: number;
	}

	let activityByYear = $derived(calculateYearlyActivity(items));
	let peakMonth = $derived(findPeakMonth(items));
	let averagePerMonth = $derived(items.length > 0 ? calculateAveragePerMonth(items) : 0);
	let currentStreak = $derived(calculateStreak(items));

	function calculateYearlyActivity(items: DiscogsCollectionItem[]): ActivityPeriod[] {
		const yearMap = new Map<number, number>();

		for (const item of items) {
			const year = new Date(item.date_added).getFullYear();
			yearMap.set(year, (yearMap.get(year) || 0) + 1);
		}

		const maxCount = Math.max(...yearMap.values());

		return Array.from(yearMap.entries())
			.sort((a, b) => a[0] - b[0])
			.slice(-5)
			.map(([year, count]) => ({
				label: String(year),
				count,
				percentage: (count / maxCount) * 100
			}));
	}

	function findPeakMonth(items: DiscogsCollectionItem[]): { month: string; count: number } | null {
		if (items.length === 0) return null;

		const monthMap = new Map<string, number>();

		for (const item of items) {
			const date = new Date(item.date_added);
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			monthMap.set(key, (monthMap.get(key) || 0) + 1);
		}

		let maxKey = '';
		let maxCount = 0;
		for (const [key, count] of monthMap) {
			if (count > maxCount) {
				maxKey = key;
				maxCount = count;
			}
		}

		if (!maxKey) return null;

		const [year, month] = maxKey.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1);
		const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

		return { month: monthName, count: maxCount };
	}

	function calculateAveragePerMonth(items: DiscogsCollectionItem[]): number {
		if (items.length === 0) return 0;

		const dates = items.map(i => new Date(i.date_added).getTime());
		const oldest = Math.min(...dates);
		const newest = Math.max(...dates);
		const monthsSpan = Math.max(1, (newest - oldest) / (1000 * 60 * 60 * 24 * 30));

		return items.length / monthsSpan;
	}

	function calculateStreak(items: DiscogsCollectionItem[]): { months: number; ongoing: boolean } {
		if (items.length === 0) return { months: 0, ongoing: false };

		const monthSet = new Set<string>();
		for (const item of items) {
			const date = new Date(item.date_added);
			monthSet.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
		}

		const months = Array.from(monthSet).sort().reverse();
		const now = new Date();
		const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

		let streak = 0;
		let checkMonth = currentMonth;

		for (let i = 0; i < 24; i++) {
			if (monthSet.has(checkMonth)) {
				streak++;
				const [year, month] = checkMonth.split('-').map(Number);
				const prevDate = new Date(year, month - 2);
				checkMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
			} else if (i === 0) {
				// Check if last month had activity (current month might just be starting)
				const [year, month] = checkMonth.split('-').map(Number);
				const prevDate = new Date(year, month - 2);
				checkMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
				continue;
			} else {
				break;
			}
		}

		return { months: streak, ongoing: monthSet.has(currentMonth) };
	}
</script>

<div class="collecting-activity">
	<div class="activity-stats">
		<div class="stat-box">
			<span class="stat-value">{averagePerMonth.toFixed(1)}</span>
			<span class="stat-label">Avg per month</span>
		</div>
		{#if peakMonth}
			<div class="stat-box highlight">
				<span class="stat-value">{peakMonth.count}</span>
				<span class="stat-label">Peak month</span>
				<span class="stat-detail">{peakMonth.month}</span>
			</div>
		{/if}
		<div class="stat-box">
			<span class="stat-value">{currentStreak.months}</span>
			<span class="stat-label">Month streak</span>
			{#if currentStreak.ongoing}
				<span class="stat-badge">Active</span>
			{/if}
		</div>
	</div>

	{#if activityByYear.length > 0}
		<div class="yearly-activity">
			<h4>Yearly Activity</h4>
			<div class="year-bars">
				{#each activityByYear as year}
					<div class="year-bar-container">
						<div class="year-bar" style:height="{year.percentage}%">
							<span class="year-count">{year.count}</span>
						</div>
						<span class="year-label">{year.label}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.collecting-activity {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.activity-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.stat-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 0.5rem;
		background: var(--color-bg-secondary);
		border-radius: 10px;
		text-align: center;
	}

	.stat-box.highlight {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(236, 72, 153, 0.15));
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.stat-label {
		font-size: 0.6875rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 0.25rem;
	}

	.stat-detail {
		font-size: 0.6875rem;
		color: var(--color-text-tertiary);
		margin-top: 0.25rem;
	}

	.stat-badge {
		margin-top: 0.375rem;
		padding: 0.125rem 0.5rem;
		background: #10b981;
		color: white;
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		border-radius: 8px;
	}

	.yearly-activity h4 {
		margin: 0 0 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}

	.year-bars {
		display: flex;
		align-items: flex-end;
		justify-content: space-around;
		height: 120px;
		gap: 0.5rem;
	}

	.year-bar-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
	}

	.year-bar {
		width: 100%;
		max-width: 40px;
		background: linear-gradient(180deg, #6366f1, #8b5cf6);
		border-radius: 4px 4px 0 0;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 0.375rem;
		min-height: 20px;
		margin-top: auto;
		transition: height 0.5s ease;
	}

	.year-count {
		font-size: 0.6875rem;
		font-weight: 700;
		color: white;
	}

	.year-label {
		margin-top: 0.375rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	@media (max-width: 400px) {
		.activity-stats {
			grid-template-columns: 1fr;
		}
	}
</style>
