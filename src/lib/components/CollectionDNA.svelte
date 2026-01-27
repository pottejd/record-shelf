<script lang="ts">
	import type { CollectionStats } from '$lib/types/discogs';

	export let stats: CollectionStats;

	// Generate a unique "DNA" based on collection characteristics
	$: dnaSegments = generateDNA(stats);

	function generateDNA(s: CollectionStats) {
		const segments: Array<{ color: string; size: number; label: string }> = [];

		// Genre colors
		const genreColors: Record<string, string> = {
			'Rock': '#ef4444',
			'Electronic': '#8b5cf6',
			'Jazz': '#f59e0b',
			'Hip Hop': '#10b981',
			'Pop': '#ec4899',
			'Classical': '#6366f1',
			'Soul': '#f97316',
			'Funk': '#eab308',
			'Reggae': '#22c55e',
			'Blues': '#3b82f6',
			'Folk, World, & Country': '#84cc16',
			'Latin': '#14b8a6',
			'Stage & Screen': '#a855f7',
			'Non-Music': '#64748b'
		};

		// Add genre segments
		const totalGenres = Object.values(s.genreBreakdown).reduce((a, b) => a + b, 0);
		Object.entries(s.genreBreakdown)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 6)
			.forEach(([genre, count]) => {
				segments.push({
					color: genreColors[genre] || '#94a3b8',
					size: (count / totalGenres) * 100,
					label: genre
				});
			});

		return segments;
	}

	// Calculate decade distribution for the rings
	$: decadeRings = Object.entries(stats.decadeBreakdown)
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([decade, count]) => ({
			decade,
			percentage: (count / stats.totalItems) * 100
		}));

	// Calculate the collection's "personality traits"
	$: traits = calculateTraits(stats);

	function calculateTraits(s: CollectionStats) {
		const traits: Array<{ name: string; value: number; color: string }> = [];

		// Diversity (unique artists / total)
		traits.push({
			name: 'Diversity',
			value: Math.min(s.uniqueArtistRatio * 100, 100),
			color: '#8b5cf6'
		});

		// Vintage factor (% of pre-1990 releases)
		const vintageCount = Object.entries(s.decadeBreakdown)
			.filter(([decade]) => parseInt(decade) < 1990)
			.reduce((sum, [, count]) => sum + count, 0);
		traits.push({
			name: 'Vintage',
			value: (vintageCount / s.totalItems) * 100,
			color: '#f59e0b'
		});

		// Vinyl dedication (% that are vinyl)
		const vinylCount = s.formatBreakdown['Vinyl'] || 0;
		traits.push({
			name: 'Vinyl',
			value: (vinylCount / s.totalItems) * 100,
			color: '#ef4444'
		});

		// Genre focus (inverse of genre count - fewer genres = more focused)
		const genreCount = Object.keys(s.genreBreakdown).length;
		const focusScore = Math.max(0, 100 - (genreCount - 1) * 10);
		traits.push({
			name: 'Focus',
			value: focusScore,
			color: '#10b981'
		});

		return traits;
	}
</script>

<div class="collection-dna">
	<div class="dna-visual">
		<svg viewBox="0 0 200 200" class="dna-ring">
			<!-- Background ring -->
			<circle cx="100" cy="100" r="85" fill="none" stroke="var(--color-bg-tertiary)" stroke-width="20" />

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
					stroke-linecap="round"
					transform="rotate({rotation} 100 100)"
					class="segment"
				>
					<title>{segment.label}: {segment.size.toFixed(1)}%</title>
				</circle>
			{/each}

			<!-- Inner decoration -->
			<circle cx="100" cy="100" r="60" fill="var(--color-bg-card)" />
			<circle cx="100" cy="100" r="55" fill="none" stroke="var(--color-border)" stroke-width="1" />

			<!-- Center icon -->
			<g transform="translate(100, 100)">
				<circle r="25" fill="var(--color-bg-secondary)" />
				<text
					y="1"
					text-anchor="middle"
					dominant-baseline="middle"
					class="dna-count"
				>
					{stats.totalItems}
				</text>
				<text
					y="14"
					text-anchor="middle"
					class="dna-label"
				>
					records
				</text>
			</g>
		</svg>
	</div>

	<div class="dna-traits">
		<h4>Collection Traits</h4>
		{#each traits as trait}
			<div class="trait">
				<div class="trait-header">
					<span class="trait-name">{trait.name}</span>
					<span class="trait-value">{Math.round(trait.value)}%</span>
				</div>
				<div class="trait-bar">
					<div
						class="trait-fill"
						style:width="{trait.value}%"
						style:background={trait.color}
					></div>
				</div>
			</div>
		{/each}
	</div>

	<div class="dna-legend">
		{#each dnaSegments as segment}
			<div class="legend-item">
				<span class="legend-dot" style:background={segment.color}></span>
				<span class="legend-label">{segment.label}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.collection-dna {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
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

	.segment {
		transition: opacity 0.2s;
		cursor: pointer;
	}

	.segment:hover {
		opacity: 0.8;
	}

	.dna-count {
		font-size: 1.25rem;
		font-weight: 700;
		fill: var(--color-text);
	}

	.dna-label {
		font-size: 0.5rem;
		fill: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.dna-traits {
		width: 100%;
	}

	.dna-traits h4 {
		margin: 0 0 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}

	.trait {
		margin-bottom: 0.625rem;
	}

	.trait:last-child {
		margin-bottom: 0;
	}

	.trait-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.trait-name {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.trait-value {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.trait-bar {
		height: 6px;
		background: var(--color-bg-secondary);
		border-radius: 3px;
		overflow: hidden;
	}

	.trait-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}

	.dna-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		justify-content: center;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
