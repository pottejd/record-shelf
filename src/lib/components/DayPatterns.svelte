<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	let dayStats = $derived(calculateDayStats(items));
	let maxCount = $derived(Math.max(...dayStats.map(d => d.count)));
	let favoriteDay = $derived(dayStats.reduce((max, d) => d.count > max.count ? d : max, dayStats[0]));

	function calculateDayStats(items: DiscogsCollectionItem[]) {
		const counts = new Array(7).fill(0);

		for (const item of items) {
			const day = new Date(item.date_added).getDay();
			counts[day]++;
		}

		return dayNames.map((name, i) => ({
			name,
			fullName: fullDayNames[i],
			count: counts[i],
			percentage: items.length > 0 ? (counts[i] / items.length) * 100 : 0
		}));
	}
</script>

<div class="day-patterns">
	<div class="favorite-day">
		<span class="favorite-label">Favorite day to add records</span>
		<span class="favorite-value">{favoriteDay.fullName}</span>
	</div>

	<div class="day-bars">
		{#each dayStats as day}
			<div class="day-bar-item">
				<div class="day-bar-wrapper">
					<div
						class="day-bar"
						style:height="{maxCount > 0 ? (day.count / maxCount) * 100 : 0}%"
						class:is-max={day.count === maxCount && maxCount > 0}
					>
						<span class="day-count">{day.count}</span>
					</div>
				</div>
				<span class="day-name">{day.name}</span>
			</div>
		{/each}
	</div>

	<div class="pattern-insights">
		{#if dayStats[0].count + dayStats[6].count > dayStats.slice(1, 6).reduce((a, b) => a + b.count, 0) / 5 * 2}
			<span class="insight">Weekend warrior - most records added on weekends</span>
		{:else if dayStats.slice(1, 6).reduce((a, b) => a + b.count, 0) > (dayStats[0].count + dayStats[6].count) * 3}
			<span class="insight">Weekday collector - most additions happen during the week</span>
		{/if}
	</div>
</div>

<style>
	.day-patterns {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* A fact row: the label, then the day. */
	.favorite-day {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 4px 16px;
		min-height: 60px;
		border-bottom: 1px solid var(--hairline);
	}

	.favorite-label {
		font-size: 18px;
	}

	.favorite-value {
		font-size: 18px;
		font-weight: 700;
	}

	/* Seven ink columns, Sun to Sat, each with its count above it. */
	.day-bars {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		height: 180px;
		gap: 16px;
	}

	.day-bar-item {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
	}

	.day-bar-wrapper {
		flex: 1;
		width: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		padding-top: 24px;
		border-bottom: 1px solid var(--ink);
	}

	.day-bar {
		position: relative;
		width: 100%;
		min-height: 2px;
		background: var(--ink);
	}

	.day-count {
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

	.day-name {
		margin-top: 10px;
		font-size: 15px;
		color: var(--muted);
	}

	.insight {
		font-size: 15px;
		color: var(--muted);
	}

	@media (max-width: 699px) {
		.day-bars {
			gap: 8px;
		}

		.day-count,
		.day-name {
			font-size: 13px;
		}
	}
</style>
