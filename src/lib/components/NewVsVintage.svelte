<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	interface AgeCategory {
		label: string;
		count: number;
		percentage: number;
		description: string;
	}

	let categories = $derived(calculateCategories(items));
	let averageAge = $derived(calculateAverageAge(items));
	let buyingStyle = $derived(getBuyingStyle(categories));

	function calculateCategories(items: DiscogsCollectionItem[]): AgeCategory[] {
		const now = new Date();
		const counts = { newRelease: 0, recent: 0, classic: 0, vintage: 0 };

		for (const item of items) {
			const releaseYear = item.basic_information.year;
			const addedYear = new Date(item.date_added).getFullYear();

			if (!releaseYear || releaseYear === 0) continue;

			const ageWhenAdded = addedYear - releaseYear;

			if (ageWhenAdded <= 1) counts.newRelease++;
			else if (ageWhenAdded <= 5) counts.recent++;
			else if (ageWhenAdded <= 20) counts.classic++;
			else counts.vintage++;
		}

		const total = counts.newRelease + counts.recent + counts.classic + counts.vintage;

		return [
			{
				label: 'New Releases',
				count: counts.newRelease,
				percentage: total > 0 ? (counts.newRelease / total) * 100 : 0,
				description: 'Bought within 1 year of release'
			},
			{
				label: 'Recent',
				count: counts.recent,
				percentage: total > 0 ? (counts.recent / total) * 100 : 0,
				description: '1-5 years after release'
			},
			{
				label: 'Classic',
				count: counts.classic,
				percentage: total > 0 ? (counts.classic / total) * 100 : 0,
				description: '5-20 years after release'
			},
			{
				label: 'Vintage',
				count: counts.vintage,
				percentage: total > 0 ? (counts.vintage / total) * 100 : 0,
				description: '20+ years after release'
			}
		];
	}

	function calculateAverageAge(items: DiscogsCollectionItem[]): number {
		let totalAge = 0;
		let count = 0;

		for (const item of items) {
			const releaseYear = item.basic_information.year;
			const addedYear = new Date(item.date_added).getFullYear();

			if (releaseYear && releaseYear > 0) {
				totalAge += addedYear - releaseYear;
				count++;
			}
		}

		return count > 0 ? Math.round(totalAge / count) : 0;
	}

	function getBuyingStyle(categories: AgeCategory[]): { label: string; description: string } {
		const newRecent = (categories[0]?.percentage || 0) + (categories[1]?.percentage || 0);
		const classicVintage = (categories[2]?.percentage || 0) + (categories[3]?.percentage || 0);

		if (newRecent > 70) {
			return { label: 'Trend Follower', description: 'Mostly new and recent releases' };
		} else if (classicVintage > 70) {
			return { label: 'Crate Digger', description: 'Lots of older releases' };
		} else if (categories[3]?.percentage > 40) {
			return { label: 'Vintage Hunter', description: 'Specializes in records 20+ years old' };
		} else {
			return { label: 'Balanced Collector', description: 'A mix across all eras' };
		}
	}
</script>

<div class="new-vs-vintage">
	<div class="summary-stats">
		<div class="stat-item">
			<span class="stat-value">{averageAge}</span>
			<span class="stat-label">Avg years old when bought</span>
		</div>
		<div class="stat-item highlight">
			<span class="stat-value">{buyingStyle.label}</span>
			<span class="stat-label">{buyingStyle.description}</span>
		</div>
	</div>

	<div class="category-bars">
		{#each categories as category}
			<div class="category-row">
				<div class="category-info">
					<span class="category-label">{category.label}</span>
					<span class="category-count">{category.count}</span>
				</div>
				<div class="bar-container">
					<div
						class="bar"
						style:width="{category.percentage}%"
					></div>
				</div>
				<span class="percentage">{category.percentage.toFixed(0)}%</span>
			</div>
		{/each}
	</div>

	<div class="category-legend">
		{#each categories as category}
			<div class="legend-item">
				<span class="legend-name">{category.label}</span>
				<span class="legend-text">{category.description}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.new-vs-vintage {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* Two facts side by side, divided by a hairline. */
	.summary-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border-top: 1px solid var(--hairline);
		border-bottom: 1px solid var(--hairline);
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 0;
		min-width: 0;
	}

	.stat-item + .stat-item {
		padding-left: 24px;
		border-left: 1px solid var(--hairline);
	}

	.stat-value {
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.stat-label {
		font-size: 15px;
		color: var(--muted);
	}

	/* Four ink bars on the track, each with its count and share. */
	.category-bars {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.category-row {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 36px;
	}

	.category-info {
		width: 172px;
		display: flex;
		justify-content: space-between;
		gap: 8px;
		flex-shrink: 0;
	}

	.category-label {
		font-size: 17px;
		font-weight: 600;
		white-space: nowrap;
	}

	.category-count {
		font-size: 15px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.bar-container {
		flex: 1;
		min-width: 0;
		height: 16px;
		background: var(--track);
	}

	.bar {
		height: 100%;
		background: var(--ink);
	}

	.percentage {
		width: 44px;
		text-align: right;
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.category-legend {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px 24px;
		padding-top: 16px;
		border-top: 1px solid var(--hairline);
	}

	.legend-item {
		display: flex;
		flex-direction: column;
		font-size: 15px;
		line-height: 1.3;
	}

	.legend-name {
		font-weight: 600;
	}

	.legend-text {
		color: var(--muted);
	}

	@media (max-width: 699px) {
		.stat-value {
			font-size: 24px;
		}

		.stat-item + .stat-item {
			padding-left: 16px;
		}

		.category-row {
			gap: 12px;
		}

		.category-info {
			width: 138px;
		}

		.category-label {
			font-size: 15px;
		}
	}

	@media (max-width: 400px) {
		.category-legend {
			grid-template-columns: 1fr;
		}
	}
</style>
