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
			<h4>Yearly activity</h4>
			<div class="year-bars">
				{#each activityByYear as year}
					<div class="year-bar-container">
						<div class="year-bar" style:--v={year.percentage / 100}>
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
		gap: 24px;
	}

	/* Three facts side by side, divided by hairlines. */
	.activity-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 1px solid var(--hairline);
		border-bottom: 1px solid var(--hairline);
	}

	.stat-box {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 0;
		min-width: 0;
	}

	.stat-box + .stat-box {
		padding-left: 24px;
		border-left: 1px solid var(--hairline);
	}

	.stat-value {
		font-size: 34px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 15px;
		color: var(--muted);
	}

	.stat-detail {
		font-size: 15px;
		color: var(--muted);
	}

	.stat-badge {
		font-size: 15px;
		font-weight: 700;
	}

	.yearly-activity h4 {
		margin: 0 0 16px;
		font-size: 18px;
		font-weight: 700;
	}

	/* Yearly ink columns, each with its count above it. */
	.year-bars {
		display: flex;
		align-items: flex-end;
		height: 160px;
		gap: 16px;
	}

	.year-bar-container {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		padding-top: 24px;
	}

	.year-bar {
		position: relative;
		width: 100%;
		/* 30px is kept below the bar for the year. */
		height: calc((100% - 30px) * var(--v));
		min-height: 2px;
		margin-top: auto;
		background: var(--ink);
	}

	.year-count {
		position: absolute;
		bottom: 100%;
		left: 0;
		right: 0;
		padding-bottom: 4px;
		text-align: center;
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.year-label {
		width: 100%;
		flex-shrink: 0;
		margin-top: 0;
		padding-top: 8px;
		line-height: 20px;
		border-top: 1px solid var(--ink);
		text-align: center;
		font-size: 15px;
		color: var(--muted);
	}

	@media (max-width: 400px) {
		.activity-stats {
			grid-template-columns: 1fr;
		}

		.stat-box + .stat-box {
			padding-left: 0;
			border-left: 0;
			border-top: 1px solid var(--hairline);
		}
	}
</style>
