<script lang="ts">
	interface Props {
		data: Array<{ label: string; value: number }>;
		horizontal?: boolean;
		clickable?: boolean;
		onItemClick?: (label: string) => void;
	}

	let { data, horizontal = false, clickable = false, onItemClick }: Props = $props();

	let maxValue = $derived(data.length > 0 ? Math.max(...data.map((d) => d.value)) : 1);

	/** "1950s" becomes "50s" on a phone; other labels stay whole. */
	function shortLabel(label: string): string | null {
		return /^\d{4}s$/.test(label) ? label.slice(2) : null;
	}
</script>

{#snippet bar(item: { label: string; value: number })}
	{@const short = horizontal ? null : shortLabel(item.label)}
	{#if short}
		<span class="label"><span class="label-long">{item.label}</span><span class="label-short">{short}</span></span>
	{:else}
		<span class="label">{item.label}</span>
	{/if}
	<div class="bar-wrapper">
		{#if horizontal}
			<div class="track"><div class="bar" style:--v={item.value / maxValue}></div></div>
		{:else}
			<div class="bar" style:--v={item.value / maxValue}></div>
		{/if}
		<span class="value">{item.value.toLocaleString()}</span>
	</div>
{/snippet}

<!-- One series, so every bar is ink; each bar has its number beside it. Horizontal
     bars stand on a track; columns do not. A bar that opens a list is a button;
     one that does not is plain text and ink. -->
<div class="chart" class:horizontal class:clickable>
	{#each data as item}
		{#if clickable}
			<button class="bar-container" type="button" onclick={() => onItemClick?.(item.label)}>
				{@render bar(item)}
			</button>
		{:else}
			<div class="bar-container">
				{@render bar(item)}
			</div>
		{/if}
	{/each}
</div>

<style>
	.chart {
		display: flex;
		flex-direction: column;
	}

	/* Vertical: ink columns side by side, the number over each and the label
	   under it. */
	.chart:not(.horizontal) {
		flex-direction: row;
		align-items: stretch;
		height: 220px;
		gap: 16px;
	}

	.bar-container {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		background: none;
		border: 0;
		border-radius: 0;
		padding: 0;
		margin: 0;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.chart:not(.horizontal) .bar-container {
		flex: 1 1 0;
		align-items: center;
	}

	.clickable .bar-container {
		cursor: pointer;
	}

	.clickable .bar-container:hover .label {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.horizontal .bar-container {
		flex-direction: row;
		align-items: center;
		gap: 16px;
		min-height: 36px;
	}

	.label {
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
	}

	/* A long name (say "Folk, World, & Country") wraps onto a second line rather
	   than losing its end; a name too long even for two is cut there. */
	.horizontal .label {
		width: 28%;
		flex-shrink: 0;
		font-size: 17px;
		line-height: 1.25;
		color: var(--ink);
		white-space: normal;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}

	.bar-wrapper {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	}

	.chart:not(.horizontal) .bar-wrapper {
		flex-direction: column-reverse;
		justify-content: flex-start;
		width: 100%;
		height: 100%;
		gap: 6px;
	}

	.bar {
		background: var(--ink);
	}

	/* Horizontal: name, an ink bar on its track, and the count at the end. */
	.track {
		flex: 1;
		min-width: 0;
		height: 16px;
		background: var(--track);
	}

	.horizontal .bar {
		height: 100%;
		width: calc(100% * var(--v));
		min-width: 2px;
	}

	.horizontal .value {
		min-width: 3ch;
		text-align: right;
	}

	.chart:not(.horizontal) .bar {
		width: 100%;
		/* 28px is kept above the bar for its number. */
		height: calc((100% - 28px) * var(--v));
		min-height: 2px;
	}

	.value {
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.chart:not(.horizontal) .label {
		order: 1;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	.chart:not(.horizontal) .bar-container {
		gap: 10px;
	}

	.label-short {
		display: none;
	}

	@media (max-width: 699px) {
		.chart:not(.horizontal) {
			gap: 8px;
		}

		.label-long {
			display: none;
		}

		.label-short {
			display: inline;
		}

		.horizontal .bar-container {
			gap: 12px;
		}

		.horizontal .label {
			width: 40%;
			font-size: 15px;
		}

		.chart:not(.horizontal) .value {
			font-size: 13px;
		}
	}
</style>
