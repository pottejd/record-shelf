<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	export let items: DiscogsCollectionItem[];

	interface DayData {
		date: string;
		count: number;
		level: number;
	}

	$: calendarData = generateCalendarData(items);
	$: totalThisYear = calendarData.reduce((sum, d) => sum + d.count, 0);

	function generateCalendarData(items: DiscogsCollectionItem[]): DayData[] {
		const now = new Date();
		const oneYearAgo = new Date(now);
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

		// Count items per day
		const dayCounts = new Map<string, number>();
		for (const item of items) {
			const date = new Date(item.date_added);
			if (date >= oneYearAgo && date <= now) {
				const key = date.toISOString().split('T')[0];
				dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
			}
		}

		// Generate all days in the past year
		const days: DayData[] = [];
		const current = new Date(oneYearAgo);

		// Start from the beginning of the week
		current.setDate(current.getDate() - current.getDay());

		while (current <= now) {
			const key = current.toISOString().split('T')[0];
			const count = dayCounts.get(key) || 0;
			days.push({
				date: key,
				count,
				level: getLevel(count)
			});
			current.setDate(current.getDate() + 1);
		}

		return days;
	}

	function getLevel(count: number): number {
		if (count === 0) return 0;
		if (count === 1) return 1;
		if (count <= 3) return 2;
		if (count <= 6) return 3;
		return 4;
	}

	function getWeeks(days: DayData[]): DayData[][] {
		const weeks: DayData[][] = [];
		for (let i = 0; i < days.length; i += 7) {
			weeks.push(days.slice(i, i + 7));
		}
		return weeks;
	}

	function getMonthLabels(days: DayData[]): { label: string; index: number }[] {
		const labels: { label: string; index: number }[] = [];
		let lastMonth = -1;

		days.forEach((day, i) => {
			const month = new Date(day.date).getMonth();
			if (month !== lastMonth && i % 7 === 0) {
				labels.push({
					label: new Date(day.date).toLocaleDateString('en-US', { month: 'short' }),
					index: Math.floor(i / 7)
				});
				lastMonth = month;
			}
		});

		return labels;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	$: weeks = getWeeks(calendarData);
	$: monthLabels = getMonthLabels(calendarData);
</script>

<div class="collecting-calendar">
	<div class="calendar-header">
		<span class="year-total">{totalThisYear} records added this year</span>
	</div>

	<div class="calendar-container">
		<div class="day-labels">
			<span></span>
			<span>Mon</span>
			<span></span>
			<span>Wed</span>
			<span></span>
			<span>Fri</span>
			<span></span>
		</div>

		<div class="calendar-grid">
			<div class="month-labels">
				{#each monthLabels as { label, index }}
					<span style:grid-column={index + 1}>{label}</span>
				{/each}
			</div>

			<div class="weeks">
				{#each weeks as week, weekIndex}
					<div class="week">
						{#each week as day}
							<div
								class="day level-{day.level}"
								title="{day.count} record{day.count !== 1 ? 's' : ''} on {formatDate(day.date)}"
							></div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="calendar-legend">
		<span>Less</span>
		<div class="legend-squares">
			<div class="day level-0"></div>
			<div class="day level-1"></div>
			<div class="day level-2"></div>
			<div class="day level-3"></div>
			<div class="day level-4"></div>
		</div>
		<span>More</span>
	</div>
</div>

<style>
	.collecting-calendar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.calendar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.year-total {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.calendar-container {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.day-labels {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 20px;
	}

	.day-labels span {
		height: 12px;
		font-size: 0.625rem;
		color: var(--color-text-tertiary);
		line-height: 12px;
	}

	.calendar-grid {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.month-labels {
		display: grid;
		grid-auto-columns: 14px;
		grid-auto-flow: column;
		gap: 2px;
		height: 18px;
	}

	.month-labels span {
		font-size: 0.625rem;
		color: var(--color-text-tertiary);
	}

	.weeks {
		display: flex;
		gap: 2px;
	}

	.week {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.day {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		background: var(--color-bg-secondary);
	}

	.day.level-0 {
		background: var(--color-bg-secondary);
	}

	.day.level-1 {
		background: #c6e48b;
	}

	.day.level-2 {
		background: #7bc96f;
	}

	.day.level-3 {
		background: #449b3e;
	}

	.day.level-4 {
		background: #2c6e2f;
	}

	:global(.dark) .day.level-1 {
		background: #0e4429;
	}

	:global(.dark) .day.level-2 {
		background: #006d32;
	}

	:global(.dark) .day.level-3 {
		background: #26a641;
	}

	:global(.dark) .day.level-4 {
		background: #39d353;
	}

	.calendar-legend {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		justify-content: flex-end;
		font-size: 0.625rem;
		color: var(--color-text-tertiary);
	}

	.legend-squares {
		display: flex;
		gap: 2px;
	}

	.legend-squares .day {
		width: 10px;
		height: 10px;
	}
</style>
