<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import type { ChartDatum } from '$lib/utils/chart';
	import BarChart from '$lib/components/BarChart.svelte';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	let activityByYear = $derived(calculateYearlyActivity(items));
	let peakMonth = $derived(findPeakMonth(items));
	let averagePerMonth = $derived(items.length > 0 ? calculateAveragePerMonth(items) : 0);
	let currentStreak = $derived(calculateStreak(items));

	/** Records added in each of the last five years that had any, oldest first. */
	function calculateYearlyActivity(items: DiscogsCollectionItem[]): ChartDatum[] {
		const yearMap = new Map<number, number>();

		for (const item of items) {
			const year = new Date(item.date_added).getFullYear();
			yearMap.set(year, (yearMap.get(year) || 0) + 1);
		}

		return Array.from(yearMap.entries())
			.sort((a, b) => a[0] - b[0])
			.slice(-5)
			.map(([year, count]) => ({ label: String(year), value: count }));
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

<dl class="facts">
	<div class="fact">
		<dt>Average per month</dt>
		<dd>{averagePerMonth.toFixed(1)}</dd>
	</div>
	{#if peakMonth}
		<div class="fact">
			<dt>Peak month</dt>
			<dd>{peakMonth.count.toLocaleString()} in {peakMonth.month}</dd>
		</div>
	{/if}
	<div class="fact">
		<dt>Month streak</dt>
		<dd>
			{#if currentStreak.ongoing}<span class="note">Active</span>{/if}
			{currentStreak.months}
		</dd>
	</div>
</dl>

{#if activityByYear.length > 0}
	<div class="yearly">
		<h3>Yearly activity</h3>
		<BarChart data={activityByYear} />
	</div>
{/if}

<style>
	/* Three fact rows: label left, value right, 60px high, under a hairline. */
	.facts {
		margin: 0;
	}

	.fact {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		min-height: 60px;
		border-bottom: 1px solid var(--hairline);
	}

	dt {
		font-size: 18px;
	}

	dd {
		margin: 0;
		min-width: 0;
		text-align: right;
		font-size: 18px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.note {
		margin-right: 8px;
		font-size: 15px;
		font-weight: 400;
		color: var(--muted);
	}

	h3 {
		margin: 24px 0 16px;
		font-size: 18px;
		font-weight: 700;
	}

	/* Yearly ink columns, each with its count above it and its year under it. */
	.yearly {
		--bar-chart-height: 180px;
	}
</style>
