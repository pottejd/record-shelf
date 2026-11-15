<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import BarChart from '$lib/components/BarChart.svelte';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	let dayStats = $derived(calculateDayStats(items));
	let favoriteDay = $derived(dayStats.reduce((max, d) => d.count > max.count ? d : max, dayStats[0]));
	let columns = $derived(dayStats.map((d) => ({ label: d.name, value: d.count })));

	function calculateDayStats(items: DiscogsCollectionItem[]) {
		const counts = new Array(7).fill(0);

		for (const item of items) {
			const day = new Date(item.date_added).getDay();
			counts[day]++;
		}

		return dayNames.map((name, i) => ({
			name,
			fullName: fullDayNames[i],
			count: counts[i]
		}));
	}
</script>

<dl class="facts">
	<div class="fact">
		<dt>Favorite day to add records</dt>
		<dd>{favoriteDay.fullName}</dd>
	</div>
</dl>

{#if items.length > 0}
	<!-- Seven ink columns, Sun to Sat, each with its count above it. -->
	<div class="days">
		<BarChart data={columns} />
	</div>
{/if}

{#if dayStats[0].count + dayStats[6].count > dayStats.slice(1, 6).reduce((a, b) => a + b.count, 0) / 5 * 2}
	<p class="insight">Weekend warrior - most records added on weekends</p>
{:else if dayStats.slice(1, 6).reduce((a, b) => a + b.count, 0) > (dayStats[0].count + dayStats[6].count) * 3}
	<p class="insight">Weekday collector - most additions happen during the week</p>
{/if}

<style>
	/* A fact row: the label, then the day. */
	.facts {
		margin: 0;
	}

	.fact {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 4px 16px;
		min-height: 60px;
		border-bottom: 1px solid var(--hairline);
	}

	dt {
		font-size: 18px;
	}

	dd {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}

	.days {
		margin-top: 24px;
	}

	.days :global(.chart) {
		height: 200px;
	}

	.insight {
		margin: 16px 0 0;
		font-size: 15px;
		color: var(--muted);
	}
</style>
