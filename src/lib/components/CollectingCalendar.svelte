<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { localDayKey, parseLocalDayKey } from '$lib/utils/dates';
	import { shadeStep } from '$lib/utils/chart';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	interface DayData {
		date: string;
		count: number;
		level: number;
		title: string;
	}

	// One shared formatter reused for every cell title (vs. a new Intl format per
	// cell on every render).
	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	let calendarData = $derived(generateCalendarData(items));
	let totalThisYear = $derived(calendarData.reduce((sum, d) => sum + d.count, 0));

	function generateCalendarData(items: DiscogsCollectionItem[]): DayData[] {
		const now = new Date();
		const oneYearAgo = new Date(now);
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

		// Count items per day
		const dayCounts = new Map<string, number>();
		for (const item of items) {
			const date = new Date(item.date_added);
			if (date >= oneYearAgo && date <= now) {
				const key = localDayKey(date);
				dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
			}
		}

		const maxCount = Math.max(0, ...dayCounts.values());

		// Generate all days in the past year
		const days: DayData[] = [];
		const current = new Date(oneYearAgo);

		// Start from the beginning of the week
		current.setDate(current.getDate() - current.getDay());

		while (current <= now) {
			const key = localDayKey(current);
			const count = dayCounts.get(key) || 0;
			days.push({
				date: key,
				count,
				level: shadeStep(count, maxCount),
				title: `${count} record${count !== 1 ? 's' : ''} on ${dateFormatter.format(parseLocalDayKey(key))}`
			});
			current.setDate(current.getDate() + 1);
		}

		return days;
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
			const month = parseLocalDayKey(day.date).getMonth();
			if (month !== lastMonth && i % 7 === 0) {
				labels.push({
					label: parseLocalDayKey(day.date).toLocaleDateString('en-US', { month: 'short' }),
					index: Math.floor(i / 7)
				});
				lastMonth = month;
			}
		});

		return labels;
	}

	let weeks = $derived(getWeeks(calendarData));
	let monthLabels = $derived(getMonthLabels(calendarData));
</script>

<div class="collecting-calendar">
	<div class="calendar-header">
		<span class="year-total">{totalThisYear} records added this year</span>
	</div>

	<div class="calendar-scroll">
		<div class="calendar-container" style:--weeks={weeks.length}>
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
					{#each weeks as week}
						<div class="week">
							{#each week as day}
								<div
									class="day level-{day.level}"
									title={day.title}
								></div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<div class="calendar-legend">
		<span>Less</span>
		<div class="legend-squares">
			<div class="day level-1"></div>
			<div class="day level-2"></div>
			<div class="day level-3"></div>
			<div class="day level-4"></div>
			<div class="day level-5"></div>
		</div>
		<span>More</span>
	</div>
</div>

<style>
	/* A year of day cells, a column per week, shaded by count on the five-step
	   ramp. A day with nothing is an empty cell with a hairline edge. */
	.collecting-calendar {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.year-total {
		font-size: 17px;
		color: var(--muted);
	}

	.calendar-scroll {
		overflow-x: auto;
	}

	.calendar-container {
		display: flex;
		gap: 12px;
		min-width: 720px;
	}

	/* The labels' rows line up with the seven day rows beside them. */
	.day-labels {
		width: 36px;
		flex-shrink: 0;
		display: grid;
		grid-template-rows: repeat(7, minmax(0, 1fr));
		gap: 2px;
		align-items: center;
		padding-top: 28px;
		font-size: 13px;
		line-height: 1;
		color: var(--muted);
	}

	.calendar-grid {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.month-labels,
	.weeks {
		display: grid;
		grid-template-columns: repeat(var(--weeks), minmax(0, 1fr));
		gap: 2px;
	}

	.month-labels {
		height: 20px;
		font-size: 15px;
		line-height: 20px;
		color: var(--muted);
	}

	.month-labels span {
		white-space: nowrap;
	}

	.week {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.day {
		aspect-ratio: 1;
	}

	.day.level-0 {
		box-shadow: inset 0 0 0 1px var(--hairline);
	}

	.day.level-1 { background: var(--shade-1); }
	.day.level-2 { background: var(--shade-2); }
	.day.level-3 { background: var(--shade-3); }
	.day.level-4 { background: var(--shade-4); }
	.day.level-5 { background: var(--shade-5); }

	.calendar-legend {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: flex-end;
		font-size: 15px;
		color: var(--muted);
	}

	.legend-squares {
		display: flex;
		gap: 4px;
	}

	.legend-squares .day {
		width: 16px;
		height: 16px;
	}
</style>
