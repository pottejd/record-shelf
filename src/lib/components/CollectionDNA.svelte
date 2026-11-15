<script lang="ts">
	import type { CollectionStats } from '$lib/types/discogs';
	import { chartColour, foldSeries } from '$lib/utils/chart';

	let { stats }: { stats: CollectionStats } = $props();

	// Generate a unique "DNA" based on collection characteristics
	let dnaSegments = $derived(generateDNA(stats));

	// The genres as parts of a whole: the five biggest in the chart colours, the
	// rest together as "Other".
	function generateDNA(s: CollectionStats) {
		const totalGenres = Object.values(s.genreBreakdown).reduce((a, b) => a + b, 0);
		const parts = foldSeries(
			Object.entries(s.genreBreakdown).map(([label, value]) => ({ label, value }))
		);
		return parts.map((part, i) => ({
			color: chartColour(i),
			size: (part.value / totalGenres) * 100,
			label: part.label
		}));
	}

	// Calculate decade distribution for the rings
	let decadeRings = $derived(Object.entries(stats.decadeBreakdown)
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([decade, count]) => ({
			decade,
			percentage: (count / stats.totalItems) * 100
		})));

	// Calculate the collection's "personality traits"
	let traits = $derived(calculateTraits(stats));

	function calculateTraits(s: CollectionStats) {
		const traits: Array<{ name: string; value: number }> = [];

		// Diversity (unique artists / total)
		traits.push({
			name: 'Diversity',
			value: Math.min(s.uniqueArtistRatio * 100, 100)
		});

		// Vintage factor (% of pre-1990 releases)
		const vintageCount = Object.entries(s.decadeBreakdown)
			.filter(([decade]) => parseInt(decade) < 1990)
			.reduce((sum, [, count]) => sum + count, 0);
		traits.push({
			name: 'Vintage',
			value: (vintageCount / s.totalItems) * 100
		});

		// Vinyl dedication (% that are vinyl)
		const vinylCount = s.formatBreakdown['Vinyl'] || 0;
		traits.push({
			name: 'Vinyl',
			value: (vinylCount / s.totalItems) * 100
		});

		// Genre focus (inverse of genre count - fewer genres = more focused)
		const genreCount = Object.keys(s.genreBreakdown).length;
		const focusScore = Math.max(0, 100 - (genreCount - 1) * 10);
		traits.push({
			name: 'Focus',
			value: focusScore
		});

		return traits;
	}
</script>

<div class="collection-dna">
	<div class="dna-visual">
		<svg aria-hidden="true" viewBox="0 0 200 200" class="dna-ring">
			<!-- Background ring -->
			<circle cx="100" cy="100" r="85" fill="none" stroke="var(--track)" stroke-width="20" />

			<!-- Genre segments -->
			{#each dnaSegments as segment, i}
				{@const prevTotal = dnaSegments.slice(0, i).reduce((sum, s) => sum + s.size, 0)}
				{@const dashArray = `${(segment.size / 100) * 534} 534`}
				{@const rotation = (prevTotal / 100) * 360 - 90}
				<circle
					cx="100"
					cy="100"
					r="85"
					fill="none"
					stroke={segment.color}
					stroke-width="20"
					stroke-dasharray={dashArray}
					stroke-linecap="butt"
					transform="rotate({rotation} 100 100)"
					class="segment"
				>
					<title>{segment.label}: {segment.size.toFixed(1)}%</title>
				</circle>
			{/each}

			<!-- Center count -->
			<g transform="translate(100, 100)">
				<text
					y="1"
					text-anchor="middle"
					dominant-baseline="middle"
					class="dna-count"
				>
					{stats.totalItems}
				</text>
				<text
					y="20"
					text-anchor="middle"
					class="dna-label"
				>
					Records
				</text>
			</g>
		</svg>
	</div>

	<div class="dna-traits">
		<h4>Collection traits</h4>
		<div class="rows">
			{#each traits as trait}
				<div class="trait">
					<div class="trait-header">
						<span class="trait-name">{trait.name}</span>
						<span class="trait-value">{Math.round(trait.value)}%</span>
					</div>
					<div class="trait-bar">
						<div class="trait-fill" style:width="{trait.value}%"></div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="dna-legend">
		{#each dnaSegments as segment}
			<div class="legend-item">
				<span class="swatch" style:background={segment.color}></span>
				<span class="legend-label">{segment.label}</span>
				<span class="legend-value">{Math.round(segment.size)}%</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.collection-dna {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
	}

	.dna-visual {
		width: 200px;
		height: 200px;
	}

	.dna-ring {
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.dna-count {
		font-size: 28px;
		font-weight: 800;
		fill: var(--ink);
	}

	.dna-label {
		font-size: 13px;
		fill: var(--muted);
	}

	.dna-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		justify-content: center;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		color: var(--ink);
	}

	.legend-value {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.swatch {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.dna-traits {
		width: 100%;
	}

	.dna-traits h4 {
		margin: 0 0 4px;
		font-size: 18px;
		font-weight: 700;
	}

	/* Name and percent, then an ink bar on the track. */
	.trait {
		padding: 12px 0;
	}

	.trait-header {
		display: flex;
		justify-content: space-between;
		gap: 16px;
	}

	.trait-name {
		font-size: 18px;
		font-weight: 600;
	}

	.trait-value {
		font-size: 17px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.trait-bar {
		height: 8px;
		margin-top: 10px;
		background: var(--track);
	}

	.trait-fill {
		height: 100%;
		background: var(--ink);
	}
</style>
