<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items, onFilter }: {
		items: DiscogsCollectionItem[];
		onFilter?: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();

	interface FormatNode {
		name: string;
		count: number;
		children: { name: string; count: number }[];
	}

	let tree = $derived(buildTree(items));
	let expanded = $state<string | null>(null);

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
				count: all.filter(i =>
					i.basic_information.formats?.some(f => f.name === name)
				).length,
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

	function handleFilter(format: string) {
		if (!onFilter) return;
		const filtered = items.filter(i =>
			i.basic_information.formats?.some(f => f.name === format)
		);
		onFilter(format, filtered);
	}

	function handleSubFilter(parent: string, detail: string) {
		if (!onFilter) return;
		const filtered = items.filter(i =>
			i.basic_information.formats?.some(f =>
				f.name === parent && (f.descriptions?.includes(detail) || f.text === detail)
			)
		);
		onFilter(`${parent} — ${detail}`, filtered);
	}
</script>

<div class="drilldown rows">
	{#each tree as node}
		<div class="format-row">
			<div class="format-header" role="button" tabindex="0" onclick={() => toggle(node.name)} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(node.name); } }}>
				<span class="chevron" class:open={expanded === node.name}>
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</span>
				<span class="format-name">{node.name}</span>
				<span class="format-count">{node.count}</span>
				{#if onFilter}
					<button
						class="view-btn"
						onclick={(e: MouseEvent) => { e.stopPropagation(); handleFilter(node.name); }}
					>View</button>
				{/if}
			</div>
			{#if expanded === node.name && node.children.length > 0}
				<div class="children rows">
					{#each node.children as child}
						<button
							class="child-row"
							onclick={() => handleSubFilter(node.name, child.name)}
							disabled={!onFilter}
						>
							<span class="child-name">{child.name}</span>
							<span class="child-count">{child.count}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* A row per format, divided by hairlines; open one to see its sub-formats. */
	.format-header {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 52px;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.format-header:hover .format-name {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.chevron {
		display: flex;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.chevron svg {
		width: 16px;
		height: 16px;
		color: var(--ink);
	}

	.format-name {
		font-weight: 600;
		font-size: 17px;
		flex: 1;
		text-align: left;
	}

	.format-count {
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.view-btn {
		min-height: 44px;
		min-width: 44px;
		padding: 0 4px;
		background: none;
		border: 0;
		border-radius: 0;
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 4px;
		cursor: pointer;
	}

	.view-btn:hover {
		text-decoration-thickness: 2px;
	}

	.children {
		display: flex;
		flex-direction: column;
		padding-left: 28px;
		border-top: 1px solid var(--hairline);
	}

	.child-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 40px;
		padding: 0;
		background: none;
		border-left: 0;
		border-right: 0;
		border-bottom: 0;
		border-radius: 0;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.child-row:not(:disabled):hover .child-name {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.child-row:disabled {
		cursor: default;
		color: inherit;
	}

	.child-name {
		font-size: 15px;
	}

	.child-count {
		font-size: 15px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
