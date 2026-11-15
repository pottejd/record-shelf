<script lang="ts">
	interface Props {
		items: Array<{ name: string; count: number }>;
		limit?: number;
		clickable?: boolean;
		onItemClick?: (name: string) => void;
	}

	let { items, limit = 10, clickable = false, onItemClick }: Props = $props();

	let displayItems = $derived(items.slice(0, limit));
	let maxCount = $derived(displayItems.length > 0 ? Math.max(...displayItems.map((i) => i.count)) : 1);
</script>

<ol class="top-list rows" class:clickable>
	{#each displayItems as item, i}
		<li>
			<button
				class="list-item"
				type="button"
				disabled={!clickable}
				onclick={() => onItemClick?.(item.name)}
			>
				<span class="rank">{i + 1}</span>
				<div class="bar-wrapper">
					<div class="name-row">
						<span class="name">{item.name}</span>
						<span class="count">{item.count}</span>
					</div>
					<div class="bar">
						<div
							class="bar-fill"
							style:width="{(item.count / maxCount) * 100}%"
						></div>
					</div>
				</div>
			</button>
		</li>
	{/each}
</ol>

<style>
	/* Ranked rows divided by hairlines: the rank in ink, the name and its count,
	   and a solid ink bar on the track. */
	.top-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: flex;
	}

	.list-item {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		background: none;
		border: 0;
		border-radius: 0;
		padding: 12px 0;
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
		width: 24px;
		flex-shrink: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--ink);
	}

	.bar-wrapper {
		flex: 1;
		min-width: 0;
	}

	.name-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 6px;
	}

	.name {
		font-size: 17px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.count {
		font-size: 15px;
		font-weight: 600;
		color: var(--muted);
		flex-shrink: 0;
	}

	.bar {
		height: 6px;
		background: var(--track);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: var(--ink);
		transition: width 0.3s ease;
	}
</style>
