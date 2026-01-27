<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	export let items: DiscogsCollectionItem[];

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	$: dayStats = calculateDayStats(items);
	$: maxCount = Math.max(...dayStats.map(d => d.count));
	$: favoriteDay = dayStats.reduce((max, d) => d.count > max.count ? d : max, dayStats[0]);

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
			<span class="insight">Weekend warrior - you add most records on weekends</span>
		{:else if dayStats.slice(1, 6).reduce((a, b) => a + b.count, 0) > (dayStats[0].count + dayStats[6].count) * 3}
			<span class="insight">Weekday collector - most additions happen during the week</span>
		{/if}
	</div>
</div>

<style>
	.day-patterns {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.favorite-day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
		border-radius: 10px;
	}

	.favorite-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.favorite-value {
		font-size: 1.25rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.day-bars {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		height: 120px;
		gap: 0.5rem;
		padding: 0 0.5rem;
	}

	.day-bar-item {
		flex: 1;
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
	}

	.day-bar {
		width: 100%;
		max-width: 32px;
		min-height: 4px;
		background: var(--color-bg-tertiary);
		border-radius: 4px 4px 0 0;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 0.25rem;
		transition: height 0.3s ease;
	}

	.day-bar.is-max {
		background: linear-gradient(180deg, #6366f1, #8b5cf6);
	}

	.day-count {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.day-bar.is-max .day-count {
		color: white;
	}

	.day-name {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.pattern-insights {
		text-align: center;
	}

	.insight {
		font-size: 0.8125rem;
		color: var(--color-text-tertiary);
		font-style: italic;
	}
</style>
