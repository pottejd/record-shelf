<script lang="ts">
	interface Props {
		items: Array<{ name: string; count: number }>;
		limit?: number;
		clickable?: boolean;
		onItemClick?: (name: string) => void;
		/** 'spines' draws each bar as a little row of spines (Top artists). */
		bars?: 'solid' | 'spines';
	}

	let { items, limit = 10, clickable = false, onItemClick, bars = 'solid' }: Props = $props();

	let displayItems = $derived(items.slice(0, limit));
	let maxCount = $derived(displayItems.length > 0 ? Math.max(...displayItems.map((i) => i.count)) : 1);

	/** A spine bar is a whole number of 3px strokes 2px apart (19 fill the 96px), so it ends on a stroke. */
	const MAX_SPINES = 19;

	function barWidth(count: number): string {
		const share = count / maxCount;
		if (bars === 'solid') return `${share * 100}%`;
		const n = Math.max(1, Math.round(share * MAX_SPINES));
		return `${n * 5 - 2}px`;
	}
</script>

<ol class="top-list bars-{bars}" class:clickable>
	{#each displayItems as item, i}
		<li>
			<button
				class="list-item"
				type="button"
				disabled={!clickable}
				onclick={() => onItemClick?.(item.name)}
			>
				<span class="rank">{i + 1}</span>
				<span class="name">{item.name}</span>
				<span class="bar" aria-hidden="true">
					<span class="bar-fill" style:width={barWidth(item.count)}></span>
				</span>
				<span class="count">{item.count.toLocaleString()}</span>
			</button>
		</li>
	{/each}
</ol>

<style>
	/* Ranked rows, 52px high, each under a hairline: rank, name, an ink bar and
	   its count. A solid bar fills from the left of its track; a spine bar is a
	   row of 3px ink strokes standing against the count, as on the shelf. */
	.top-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: flex;
		border-bottom: 1px solid var(--hairline);
	}

	.list-item {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		min-height: 52px;
		background: none;
		border: 0;
		border-radius: 0;
		padding: 0;
		font: inherit;
		color: inherit;
		text-align: left;
	}

	.clickable .list-item {
		cursor: pointer;
	}

	.clickable .list-item:hover .name {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.list-item:disabled {
		cursor: default;
		color: inherit;
	}

	.rank {
		width: 28px;
		flex-shrink: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--ink);
	}

	.name {
		flex: 1;
		min-width: 0;
		font-size: 17px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar {
		display: flex;
		width: 96px;
		flex-shrink: 0;
	}

	.bars-solid .bar {
		height: 8px;
		background: var(--track);
	}

	.bars-spines .bar {
		justify-content: flex-end;
		height: 20px;
	}

	.bar-fill {
		display: block;
		height: 100%;
	}

	.bars-solid .bar-fill {
		background: var(--ink);
	}

	.bars-spines .bar-fill {
		background: repeating-linear-gradient(90deg, var(--ink) 0 3px, transparent 3px 5px);
	}

	.count {
		min-width: 3ch;
		flex-shrink: 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--muted);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 699px) {
		.list-item {
			gap: 12px;
		}
	}
</style>
