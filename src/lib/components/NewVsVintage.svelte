<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	export let items: DiscogsCollectionItem[];

	interface AgeCategory {
		label: string;
		count: number;
		percentage: number;
		color: string;
		description: string;
	}

	$: categories = calculateCategories(items);
	$: averageAge = calculateAverageAge(items);
	$: buyingStyle = getBuyingStyle(categories);

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
				color: '#10b981',
				description: 'Bought within 1 year of release'
			},
			{
				label: 'Recent',
				count: counts.recent,
				percentage: total > 0 ? (counts.recent / total) * 100 : 0,
				color: '#3b82f6',
				description: '1-5 years after release'
			},
			{
				label: 'Classic',
				count: counts.classic,
				percentage: total > 0 ? (counts.classic / total) * 100 : 0,
				color: '#f59e0b',
				description: '5-20 years after release'
			},
			{
				label: 'Vintage',
				count: counts.vintage,
				percentage: total > 0 ? (counts.vintage / total) * 100 : 0,
				color: '#8b5cf6',
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
			return { label: 'Trend Follower', description: 'You mostly buy new and recent releases' };
		} else if (classicVintage > 70) {
			return { label: 'Crate Digger', description: 'You love hunting for older releases' };
		} else if (categories[3]?.percentage > 40) {
			return { label: 'Vintage Hunter', description: 'You specialize in records 20+ years old' };
		} else {
			return { label: 'Balanced Collector', description: 'You collect across all eras' };
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
						style:background={category.color}
					></div>
				</div>
				<span class="percentage">{category.percentage.toFixed(0)}%</span>
			</div>
		{/each}
	</div>

	<div class="category-legend">
		{#each categories as category}
			<div class="legend-item">
				<span class="legend-dot" style:background={category.color}></span>
				<span class="legend-text">{category.description}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.new-vs-vintage {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.summary-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 1rem 0.5rem;
		background: var(--color-bg-secondary);
		border-radius: 10px;
	}

	.stat-item.highlight {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(236, 72, 153, 0.15));
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.stat-label {
		font-size: 0.6875rem;
		color: var(--color-text-secondary);
		margin-top: 0.25rem;
	}

	.category-bars {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.category-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.category-info {
		width: 100px;
		display: flex;
		justify-content: space-between;
		flex-shrink: 0;
	}

	.category-label {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.category-count {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.bar-container {
		flex: 1;
		height: 20px;
		background: var(--color-bg-secondary);
		border-radius: 4px;
		overflow: hidden;
	}

	.bar {
		height: 100%;
		border-radius: 4px;
		transition: width 0.5s ease;
	}

	.percentage {
		width: 36px;
		text-align: right;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.category-legend {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-border);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-text {
		font-size: 0.6875rem;
		color: var(--color-text-tertiary);
	}

	@media (max-width: 400px) {
		.category-legend {
			grid-template-columns: 1fr;
		}
	}
</style>
