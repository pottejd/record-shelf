<script lang="ts">
	export let data: Array<{ label: string; value: number; color?: string }>;
	export let horizontal = false;
	export let colorful = false;
	export let clickable = false;
	export let onItemClick: ((label: string) => void) | undefined = undefined;

	const colors = [
		'#6366f1', // indigo
		'#8b5cf6', // violet
		'#ec4899', // pink
		'#f43f5e', // rose
		'#f97316', // orange
		'#eab308', // yellow
		'#22c55e', // green
		'#14b8a6', // teal
		'#06b6d4', // cyan
		'#3b82f6', // blue
	];

	$: maxValue = Math.max(...data.map((d) => d.value));
	$: coloredData = data.map((d, i) => ({
		...d,
		color: d.color || (colorful ? colors[i % colors.length] : 'var(--bar-color, #6366f1)')
	}));
</script>

<div class="chart" class:horizontal class:clickable>
	{#each coloredData as item, i}
		<button
			class="bar-container"
			type="button"
			disabled={!clickable}
			onclick={() => onItemClick?.(item.label)}
		>
			<span class="label">{item.label}</span>
			<div class="bar-wrapper">
				<div
					class="bar"
					style:--percent="{(item.value / maxValue) * 100}%"
					style:background={item.color}
				></div>
				<span class="value">{item.value.toLocaleString()}</span>
			</div>
		</button>
	{/each}
</div>

<style>
	.chart {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chart:not(.horizontal) {
		flex-direction: row;
		align-items: flex-end;
		justify-content: space-around;
		height: 200px;
		gap: 0.25rem;
	}

	.bar-container {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.clickable .bar-container {
		cursor: pointer;
		border-radius: 8px;
		padding: 0.25rem;
		margin: -0.25rem;
		transition: background-color 0.15s;
	}

	.clickable .bar-container:hover {
		background: var(--color-bg-secondary, rgba(0, 0, 0, 0.05));
	}

	.clickable .bar-container:disabled {
		cursor: default;
	}

	.horizontal .bar-container {
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
	}

	.label {
		font-size: 0.75rem;
		color: var(--color-text-secondary, #666);
		white-space: nowrap;
	}

	.horizontal .label {
		width: 100px;
		flex-shrink: 0;
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
	}

	.chart:not(.horizontal) .bar-wrapper {
		flex-direction: column-reverse;
		height: 100%;
		justify-content: flex-start;
	}

	.bar {
		border-radius: 4px;
		transition: width 0.3s ease, height 0.3s ease, opacity 0.2s;
	}

	.bar:hover {
		opacity: 0.8;
	}

	.horizontal .bar {
		height: 28px;
		width: var(--percent);
		min-width: 4px;
	}

	.chart:not(.horizontal) .bar {
		width: 100%;
		min-width: 28px;
		max-width: 48px;
		height: var(--percent);
		min-height: 4px;
	}

	.value {
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.chart:not(.horizontal) .value {
		font-size: 0.6875rem;
	}

	.chart:not(.horizontal) .label {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		transform: rotate(180deg);
		max-height: 80px;
		overflow: hidden;
	}
</style>
