<script lang="ts">
	interface Props {
		genres: string[];
		formats: string[];
		decades: number[];
		selectedGenre: string;
		selectedFormat: string;
		selectedDecade: string;
		onGenreChange: (value: string) => void;
		onFormatChange: (value: string) => void;
		onDecadeChange: (value: string) => void;
	}

	let {
		genres, formats, decades,
		selectedGenre, selectedFormat, selectedDecade,
		onGenreChange, onFormatChange, onDecadeChange
	}: Props = $props();
</script>

<!-- Always on show: three underlined selects with no visible label; the first option says what each one picks. -->
<div class="filters">
	<span class="select-wrap">
		<select aria-label="Genre" class="field" value={selectedGenre} onchange={(e) => onGenreChange(e.currentTarget.value)}>
			<option value="">All genres</option>
			{#each genres as genre}
				<option value={genre}>{genre}</option>
			{/each}
		</select>
		<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
	</span>

	<span class="select-wrap">
		<select aria-label="Format" class="field" value={selectedFormat} onchange={(e) => onFormatChange(e.currentTarget.value)}>
			<option value="">All formats</option>
			{#each formats as format}
				<option value={format}>{format}</option>
			{/each}
		</select>
		<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
	</span>

	<span class="select-wrap">
		<select aria-label="Decade" class="field" value={selectedDecade} onchange={(e) => onDecadeChange(e.currentTarget.value)}>
			<option value="">All decades</option>
			{#each decades as decade}
				<option value={String(decade)}>{decade}s</option>
			{/each}
		</select>
		<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
	</span>
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		min-width: 0;
		max-width: 100%;
	}

	.select-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-width: 0;
		max-width: 100%;
	}

	/* As wide as the chosen option, not the whole row (browsers without
	   field-sizing fall back to the widest option). */
	.select-wrap select {
		width: auto;
		field-sizing: content;
		max-width: 100%;
		padding-right: 30px;
		font-weight: 500;
		text-overflow: ellipsis;
		-webkit-appearance: none;
		appearance: none;
		cursor: pointer;
	}

	/* Options open in the browser's own list; keep them readable in dark mode. */
	.select-wrap option {
		background: var(--ground);
		color: var(--ink);
	}

	.select-wrap svg {
		position: absolute;
		right: 2px;
		top: 50%;
		width: 18px;
		height: 18px;
		margin-top: -9px;
		pointer-events: none;
	}
</style>
