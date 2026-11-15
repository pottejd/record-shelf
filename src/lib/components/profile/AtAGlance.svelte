<script lang="ts">
	import type { CollectionStats } from '$lib/types/discogs';
	import type { Badge } from '$lib/utils/badges';

	let { stats, badges }: { stats: CollectionStats; badges: Badge[] } = $props();

	// A value of 0 or '' means the collection does not say (no years, no genres).
	let facts = $derived([
		{ label: 'Artists', value: stats.totalArtists.toLocaleString() },
		{ label: 'Labels', value: stats.totalLabels.toLocaleString() },
		{ label: 'Average year', value: stats.averageYear ? String(stats.averageYear) : '—' },
		{
			label: 'Year span',
			value: stats.collectionSpan ? `${stats.collectionSpan} ${stats.collectionSpan === 1 ? 'year' : 'years'}` : '—'
		},
		{ label: 'Top genre', value: stats.dominantGenre || '—' }
	]);
</script>

<dl class="glance">
	<div class="row">
		<dt>Records</dt>
		<dd class="figure">{stats.totalItems.toLocaleString()}</dd>
	</div>
	{#each facts as fact (fact.label)}
		<div class="row">
			<dt>{fact.label}</dt>
			<dd>{fact.value}</dd>
		</div>
	{/each}
</dl>

{#if badges.length > 0}
	<p class="badges small">{badges.map((b) => b.label).join(', ')}</p>
{/if}

<style>
	.glance {
		margin: 0;
	}

	/* Label left, value right, 60px high, under a hairline. */
	.row {
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
		overflow-wrap: anywhere;
	}

	dd:not(.figure) {
		font-size: 18px;
		font-weight: 600;
	}

	.badges {
		margin: 16px 0 0;
	}
</style>
