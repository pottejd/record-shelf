<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { chartColour, foldSeries, type ChartDatum } from '$lib/utils/chart';
	import SplitBar from '$lib/components/SplitBar.svelte';

	let { items, formatData, onFilter }: {
		items: DiscogsCollectionItem[];
		formatData: ChartDatum[];
		onFilter: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();

	interface FormatNode {
		name: string;
		count: number;
		children: { name: string; count: number }[];
	}

	let parts = $derived(foldSeries(formatData));
	let total = $derived(formatData.reduce((sum, d) => sum + d.value, 0));
	let tree = $derived(buildTree(items));
	let expanded = $state<string | null>(null);

	/** A format in the bar has its colour; one folded into "Other" has the Other colour. */
	function colourOf(name: string): string {
		const i = parts.findIndex((p) => p.label === name);
		return i >= 0 && name !== 'Other' ? chartColour(i) : 'var(--chart-other)';
	}

	function percentOf(count: number): number {
		return total > 0 ? Math.round((count / total) * 100) : 0;
	}

	function buildTree(all: DiscogsCollectionItem[]): FormatNode[] {
		const map = new Map<string, Map<string, number>>();

		for (const item of all) {
			for (const fmt of item.basic_information.formats || []) {
				if (!map.has(fmt.name)) map.set(fmt.name, new Map());
				const children = map.get(fmt.name)!;
				for (const desc of fmt.descriptions || []) {
					children.set(desc, (children.get(desc) || 0) + 1);
				}
				if (fmt.text) {
					children.set(fmt.text, (children.get(fmt.text) || 0) + 1);
				}
			}
		}

		return [...map.entries()]
			.map(([name, childMap]) => ({
				name,
				count: all.filter((i) => i.basic_information.formats?.some((f) => f.name === name)).length,
				children: [...childMap.entries()]
					.map(([cName, cCount]) => ({ name: cName, count: cCount }))
					.sort((a, b) => b.count - a.count)
					.slice(0, 10)
			}))
			.sort((a, b) => b.count - a.count);
	}

	function toggle(name: string) {
		expanded = expanded === name ? null : name;
	}

	function openFormat(format: string) {
		onFilter(
			format,
			items.filter((i) => i.basic_information.formats?.some((f) => f.name === format))
		);
	}

	function openSubFormat(parent: string, detail: string) {
		onFilter(
			`${parent} — ${detail}`,
			items.filter((i) =>
				i.basic_information.formats?.some(
					(f) => f.name === parent && (f.descriptions?.includes(detail) || f.text === detail)
				)
			)
		);
	}
</script>

<SplitBar {parts} height={14} label="By format" legend={false} />

<div class="breakdown rows">
	{#each tree as node (node.name)}
		{@const open = expanded === node.name && node.children.length > 0}
		<div class="format">
			<div class="format-row">
				<span class="swatch" aria-hidden="true" style:background={colourOf(node.name)}></span>
				<button
					type="button"
					class="format-name"
					onclick={() => openFormat(node.name)}
					aria-label="Open the {node.name} records, {node.count}"
				>{node.name}</button>
				<span class="format-count">{node.count.toLocaleString()}</span>
				<span class="format-percent">{percentOf(node.count)}%</span>
				<button
					type="button"
					class="toggle"
					aria-expanded={open}
					aria-label="{open ? 'Hide' : 'Show'} {node.name} sub-formats"
					disabled={node.children.length === 0}
					onclick={() => toggle(node.name)}
				>
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points={open ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
					</svg>
				</button>
			</div>
			{#if open}
				<div class="children">
					{#each node.children as child (child.name)}
						<button type="button" class="child-row" onclick={() => openSubFormat(node.name, child.name)}>
							<span class="child-name">{child.name}</span>
							<span class="child-count">{child.count.toLocaleString()}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.breakdown {
		margin-top: 12px;
	}

	.format-row {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 52px;
	}

	.swatch {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.format-name {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 0;
		color: var(--ink);
		font: inherit;
		font-size: 17px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.format-name:hover {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.format-count {
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.format-percent {
		min-width: 3ch;
		text-align: right;
		font-size: 15px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 0;
		color: var(--ink);
		cursor: pointer;
	}

	.toggle:disabled {
		visibility: hidden;
	}

	.toggle svg {
		width: 18px;
		height: 18px;
	}

	.children {
		display: flex;
		flex-direction: column;
		padding-left: 28px;
	}

	.child-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 40px;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 0;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.child-row:hover .child-name {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.child-name {
		font-size: 15px;
	}

	.child-count {
		margin-right: 58px;
		font-size: 15px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
