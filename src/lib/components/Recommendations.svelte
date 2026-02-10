<script lang="ts">
	import type { CollectionStats } from '$lib/types/discogs';

	let { stats }: { stats: CollectionStats } = $props();

	interface Suggestion {
		label: string;
		query: string;
		reason: string;
	}

	let suggestions = $derived(buildSuggestions(stats));

	function buildSuggestions(s: CollectionStats): Suggestion[] {
		const result: Suggestion[] = [];

		// Based on top styles (more specific than genres)
		const topStyles = s.topStyles.slice(0, 3);
		for (const style of topStyles) {
			result.push({
				label: style.name,
				query: encodeURIComponent(style.name),
				reason: `You have ${style.count} ${style.name} records`
			});
		}

		// Based on top artists — suggest "similar to" searches
		const topArtists = s.topArtists.slice(0, 2);
		for (const artist of topArtists) {
			result.push({
				label: `More by ${artist.name}`,
				query: encodeURIComponent(artist.name),
				reason: `${artist.count} releases in your collection`
			});
		}

		// Based on dominant decade
		if (s.dominantDecade) {
			const decade = s.dominantDecade;
			const topGenre = s.dominantGenre;
			if (topGenre) {
				result.push({
					label: `${decade}s ${topGenre}`,
					query: encodeURIComponent(`${topGenre} ${decade}s`),
					reason: `Your sweet spot: ${topGenre} from the ${decade}s`
				});
			}
		}

		// Based on top labels
		const topLabels = s.topLabels.slice(0, 2);
		for (const label of topLabels) {
			result.push({
				label: label.name,
				query: encodeURIComponent(label.name),
				reason: `${label.count} releases from this label`
			});
		}

		return result.slice(0, 8);
	}
</script>

{#if suggestions.length > 0}
	<div class="suggestions">
		{#each suggestions as suggestion}
			<a
				href="https://www.discogs.com/search/?q={suggestion.query}&type=release"
				target="_blank"
				rel="noopener"
				class="suggestion-card"
			>
				<span class="suggestion-label">{suggestion.label}</span>
				<span class="suggestion-reason">{suggestion.reason}</span>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow">
					<path d="M7 17l9.2-9.2M17 17V7H7" />
				</svg>
			</a>
		{/each}
	</div>
{/if}

<style>
	.suggestions {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.suggestion-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: 10px;
		text-decoration: none;
		color: inherit;
		position: relative;
		transition: background-color 0.15s, transform 0.15s;
	}

	.suggestion-card:hover {
		background: var(--color-bg-tertiary);
		transform: translateY(-2px);
	}

	.suggestion-label {
		font-size: 0.875rem;
		font-weight: 600;
		padding-right: 1.5rem;
	}

	.suggestion-reason {
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
	}

	.arrow {
		position: absolute;
		top: 1rem;
		right: 1rem;
		width: 14px;
		height: 14px;
		color: var(--color-text-tertiary);
	}

	.suggestion-card:hover .arrow {
		color: var(--color-primary);
	}
</style>
