<script lang="ts">
	interface Props {
		items: Array<{ name: string; count: number }>;
		limit?: number;
		clickable?: boolean;
		onItemClick?: (name: string) => void;
	}

	let { items, limit = 10, clickable = false, onItemClick }: Props = $props();

	const colors = [
		'#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe',
		'#e9d5ff', '#f3e8ff', '#faf5ff', '#fdf4ff', '#fefce8'
	];

	let displayItems = $derived(items.slice(0, limit));
	let maxCount = $derived(Math.max(...displayItems.map((i) => i.count)));
</script>

<ol class="top-list" class:clickable>
	{#each displayItems as item, i}
		<li>
			<button
				class="list-item"
				type="button"
				disabled={!clickable}
				onclick={() => onItemClick?.(item.name)}
			>
				<span class="rank" style:background={colors[Math.min(i, colors.length - 1)]}>{i + 1}</span>
				<div class="bar-wrapper">
					<div class="name-row">
						<span class="name">{item.name}</span>
						<span class="count">{item.count}</span>
					</div>
					<div class="bar">
						<div
							class="bar-fill"
							style:width="{(item.count / maxCount) * 100}%"
							style:background={colors[Math.min(i, colors.length - 1)]}
						></div>
					</div>
				</div>
			</button>
		</li>
	{/each}
</ol>

<style>
	.top-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	li {
		display: flex;
	}

	.list-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		width: 100%;
		background: none;
		border: none;
		padding: 0.375rem;
		margin: -0.375rem;
		border-radius: 8px;
		font: inherit;
		color: inherit;
		text-align: left;
	}

	.clickable .list-item {
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.clickable .list-item:hover {
		background: var(--color-bg-secondary, rgba(0, 0, 0, 0.05));
	}

	.list-item:disabled {
		cursor: default;
	}

	.rank {
		width: 1.5rem;
		height: 1.5rem;
		font-size: 0.6875rem;
		font-weight: 700;
		color: white;
		text-align: center;
		line-height: 1.5rem;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.bar-wrapper {
		flex: 1;
		min-width: 0;
	}

	.name-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.name {
		font-size: 0.875rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.count {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary, #666);
		flex-shrink: 0;
	}

	.bar {
		height: 4px;
		background: var(--color-bg-secondary, #f0f0f0);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}
</style>
