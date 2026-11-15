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
				reason: `${style.count} ${style.name} records in the collection`
			});
		}

		// Based on top artists — suggest "similar to" searches
		const topArtists = s.topArtists.slice(0, 2);
		for (const artist of topArtists) {
			result.push({
				label: `More by ${artist.name}`,
				query: encodeURIComponent(artist.name),
				reason: `${artist.count} releases in the collection`
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
					reason: `Sweet spot: ${topGenre} from the ${decade}s`
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
				rel="noopener noreferrer"
				class="suggestion-card"
			>
				<span class="suggestion-label">{suggestion.label}</span>
				<span class="suggestion-reason">{suggestion.reason}</span>
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow">
					<path d="M7 17l9.2-9.2M17 17V7H7" />
				</svg>
			</a>
		{/each}
	</div>
{/if}

<style>
	/* Searches as rows divided by hairlines, in columns where there is room. */
	.suggestions {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0 32px;
	}

	.suggestion-card {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		min-height: 68px;
		padding: 10px 28px 10px 0;
		border-bottom: 1px solid var(--hairline);
		text-decoration: none;
		color: var(--ink);
	}

	.suggestion-card:hover .suggestion-label {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.suggestion-label {
		font-size: 17px;
		font-weight: 600;
	}

	.suggestion-reason {
		font-size: 15px;
		color: var(--muted);
	}

	.arrow {
		position: absolute;
		top: 50%;
		right: 0;
		width: 16px;
		height: 16px;
		margin-top: -8px;
		color: var(--ink);
	}
</style>
