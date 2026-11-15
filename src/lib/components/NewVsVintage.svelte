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
	let maxCount = $derived(Math.max(1, ...categories.map((c) => c.count)));

	function calculateCategories(items: DiscogsCollectionItem[]): AgeCategory[] {
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
		const share = (n: number) => (total > 0 ? (n / total) * 100 : 0);

		return [
			{
				label: 'New releases',
				count: counts.newRelease,
				percentage: share(counts.newRelease),
				description: 'Bought within 1 year of release'
			},
			{
				label: 'Recent',
				count: counts.recent,
				percentage: share(counts.recent),
				description: '1 to 5 years after release'
			},
			{
				label: 'Classic',
				count: counts.classic,
				percentage: share(counts.classic),
				description: '5 to 20 years after release'
			},
			{
				label: 'Vintage',
				count: counts.vintage,
				percentage: share(counts.vintage),
				description: '20 or more years after release'
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
			return { label: 'Trend follower', description: 'Mostly new and recent releases' };
		} else if (classicVintage > 70) {
			return { label: 'Crate digger', description: 'Lots of older releases' };
		} else if (categories[3]?.percentage > 40) {
			return { label: 'Vintage hunter', description: 'Specializes in records 20 or more years old' };
		} else {
			return { label: 'Balanced collector', description: 'A mix across all eras' };
		}
	}
</script>

<dl class="facts">
	<div class="fact">
		<dt>Average age when bought</dt>
		<dd>{averageAge} {averageAge === 1 ? 'year' : 'years'}</dd>
	</div>
	<div class="fact">
		<dt>Buying style</dt>
		<dd>
			<span class="style">{buyingStyle.label}</span>
			<span class="style-note">{buyingStyle.description}</span>
		</dd>
	</div>
</dl>

<ul class="categories">
	{#each categories as category (category.label)}
		<li class="category">
			<span class="category-info">
				<span class="category-label">{category.label}</span>
				<span class="category-text">{category.description}</span>
			</span>
			<span class="bar-cell">
				<span class="bar" style:--v={category.count / maxCount}></span>
				<span class="value">{category.count.toLocaleString()} ({category.percentage.toFixed(0)}%)</span>
			</span>
		</li>
	{/each}
</ul>

<style>
	/* Two fact rows: label left, value right, 60px high, under a hairline. */
	.facts {
		margin: 0;
	}

	.fact {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		min-height: 60px;
		padding: 6px 0;
		border-bottom: 1px solid var(--hairline);
	}

	dt {
		font-size: 18px;
	}

	dd {
		margin: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
		font-size: 18px;
		font-weight: 600;
	}

	.style-note {
		font-size: 15px;
		font-weight: 400;
		color: var(--muted);
	}

	/* Four rows: the name and what it means, then an ink bar with its count and
	   share after it. The longest bar is the biggest group. */
	.categories {
		margin: 16px 0 0;
		padding: 0;
		list-style: none;
	}

	.category {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 56px;
		/* Keeps rows apart when a description wraps on a phone. */
		padding: 6px 0;
	}

	.category-info {
		width: 46%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}

	.category-label {
		font-size: 17px;
		font-weight: 600;
	}

	.category-text {
		font-size: 15px;
		color: var(--muted);
	}

	.bar-cell {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.bar {
		height: 16px;
		/* 88px is kept after the longest bar for its count and share. */
		width: calc((100% - 88px) * var(--v));
		min-width: 2px;
		background: var(--ink);
	}

	.value {
		flex-shrink: 0;
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
</style>
