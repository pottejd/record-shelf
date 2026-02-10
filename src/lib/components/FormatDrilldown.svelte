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

<div class="drilldown">
	{#each tree as node}
		<div class="format-row">
			<div class="format-header" role="button" tabindex="0" onclick={() => toggle(node.name)} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(node.name); } }}>
				<span class="chevron" class:open={expanded === node.name}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
				<div class="children">
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
	.drilldown {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.format-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 0.75rem;
		background: var(--color-bg-secondary);
		border: none;
		border-radius: 8px;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.format-header:hover {
		background: var(--color-bg-tertiary);
	}

	.chevron {
		display: flex;
		transition: transform 0.2s;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.chevron svg {
		width: 14px;
		height: 14px;
		color: var(--color-text-tertiary);
	}

	.format-name {
		font-weight: 600;
		font-size: 0.875rem;
		flex: 1;
		text-align: left;
	}

	.format-count {
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		font-weight: 500;
	}

	.view-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 500;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: var(--color-primary);
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.view-btn:hover {
		background: var(--color-primary);
		color: white;
	}

	.children {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding-left: 1.75rem;
		margin-top: 2px;
	}

	.child-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.child-row:not(:disabled):hover {
		background: var(--color-bg-secondary);
	}

	.child-row:disabled {
		cursor: default;
	}

	.child-name {
		font-size: 0.8125rem;
	}

	.child-count {
		font-size: 0.6875rem;
		color: var(--color-text-tertiary);
	}
</style>
