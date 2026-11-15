<script lang="ts">
	import { tick } from 'svelte';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import {
		PER_SHELF,
		MAX_SHELVES,
		shelfOrder,
		shelfCount,
		splitShelves,
		shelfTitle,
		type Spine
	} from '$lib/shelf/spines';
	import { cleanArtistName } from '$lib/utils/discogs';

	let { items, total, onOpen }: {
		/** What to draw now; may be empty while records are still arriving. */
		items: DiscogsCollectionItem[];
		/** The full count: it sets the number of boards, so they stand before the spines do. */
		total: number;
		onOpen: (title: string, items: DiscogsCollectionItem[]) => void;
	} = $props();

	type Kind = 'wide' | 'narrow';
	const KINDS: Kind[] = ['wide', 'narrow'];

	let ordered = $derived(shelfOrder(items));
	let empty = $derived(total === 0 && items.length === 0);

	/** Both widths are laid out and CSS shows one, so the server draws the right boards
	 *  without knowing the screen. `start` is each row's first index into `ordered`. */
	let layouts = $derived(
		KINDS.map((kind) => {
			const rows = splitShelves(ordered, shelfCount(Math.max(total, items.length), PER_SHELF[kind]));
			let n = 0;
			const starts = rows.map((row) => ((n += row.length), n - row.length));
			return { kind, rows, starts, cap: MAX_SHELVES[kind] };
		})
	);

	// Each width keeps its own "whole shelf" switch: only the one on screen grows.
	let expanded = $state<Record<Kind, boolean>>({ wide: false, narrow: false });

	let rootEl: HTMLDivElement;
	let labelEl: HTMLDivElement;
	let labelled: Spine | null = null;

	const records = (n: number) => `${n} record${n === 1 ? '' : 's'}`;

	function shelfName(row: Spine[], i: number, n: number): string {
		if (row.length === 0) return `Shelf ${i + 1} of ${n}: no records yet.`;
		return `Shelf ${i + 1} of ${n}: ${records(row.length)}, ${shelfTitle(row)}. Open the list.`;
	}

	function spineStyle(s: Spine): string {
		const w = +s.width.toFixed(3);
		return `flex: ${w} 1 0; max-width: calc(${w} * 12px); height: ${Math.round(s.height * 100)}%; background: var(--spine-${s.colour + 1})`;
	}

	function labelText(s: Spine): string {
		const info = s.item.basic_information;
		const artist = cleanArtistName(info.artists?.[0]?.name ?? '');
		return `${info.title ?? ''}${artist ? `, ${artist}` : ''}${s.year ? ` (${s.year})` : ''}`;
	}

	/** One label for the whole shelf, moved to the spine under the pointer. The text is
	 *  set as text, never as HTML, and the label is kept inside the shelf's own width. */
	function hover(e: PointerEvent) {
		if (e.pointerType === 'touch') return hide();
		const el = (e.target as Element | null)?.closest?.('[data-spine]');
		const spine = el ? ordered[Number(el.getAttribute('data-spine'))] : undefined;
		if (!spine) return hide();
		labelEl.hidden = false;
		if (spine !== labelled) {
			labelEl.textContent = labelText(spine);
			labelled = spine;
		}
		const box = rootEl.getBoundingClientRect();
		const w = labelEl.offsetWidth;
		const x = Math.min(Math.max(e.clientX - box.left - w / 2, 0), Math.max(0, box.width - w));
		const y = e.clientY - box.top - labelEl.offsetHeight - 14;
		labelEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
	}

	function hide() {
		if (labelEl) labelEl.hidden = true;
		labelled = null;
	}

	async function showAll(kind: Kind, cap: number) {
		expanded[kind] = true;
		await tick();
		// The button is gone; carry focus to the first shelf it brought in that can
		// take it. While records are still arriving every new shelf may be empty, and
		// so disabled: then the shelf as a whole takes focus.
		const wrap = rootEl.querySelector<HTMLElement>(`.shelf-${kind}`);
		const boards = [...(wrap?.querySelectorAll<HTMLButtonElement>('.board') ?? [])];
		(boards.slice(cap).find((b) => !b.disabled) ?? wrap)?.focus();
	}
</script>

<div class="shelf" bind:this={rootEl}>
	{#each layouts as { kind, rows, starts, cap } (kind)}
		{@const shown = expanded[kind] ? rows : rows.slice(0, cap)}
		{@const capped = shown.length < rows.length}
		<div class="shelf-{kind}" tabindex="-1">
			{#if empty}
				<div class="board"></div>
			{:else}
				{#each shown as row, i (i)}
					<button
						type="button"
						class="board"
						aria-label={shelfName(row, i, rows.length)}
						disabled={row.length === 0}
						onclick={() => onOpen(shelfTitle(row), row.map((s) => s.item))}
						onpointermove={hover}
						onpointerleave={hide}
					>
						{#each row as spine, j}
							<span class="spine" data-spine={starts[i] + j} aria-hidden="true" style={spineStyle(spine)}></span>
						{/each}
					</button>
				{/each}
			{/if}
			<div class="ends small">
				{#if empty}
					<span>Nothing on the shelf yet.</span>
				{:else}
					<span>First added</span>
					{#if !capped}<span>Latest</span>{/if}
				{/if}
			</div>
			{#if capped}
				<button type="button" class="btn btn-secondary more" onclick={() => showAll(kind, cap)}>
					Show the whole shelf
				</button>
			{/if}
		</div>
	{/each}
	<div class="spine-label" bind:this={labelEl} aria-hidden="true" hidden></div>
</div>

<style>
	.shelf {
		position: relative;
	}

	/* Spines stand on an ink board; the board is the shelf's bottom border. */
	.board {
		appearance: none;
		display: flex;
		align-items: flex-end;
		justify-content: flex-start;
		box-sizing: content-box;
		width: 100%;
		height: 104px;
		margin: 18px 0 0;
		padding: 0;
		border: 0;
		border-bottom: 8px solid var(--ink);
		border-radius: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.board:first-child {
		margin-top: 0;
	}

	.board:disabled {
		cursor: default;
	}

	.spine {
		display: block;
		min-width: 0;
		box-shadow: inset -1px 0 0 var(--spine-edge);
	}

	.ends {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		margin-top: 10px;
	}

	.more {
		margin-top: 24px;
	}

	.shelf-narrow {
		display: none;
	}

	@media (max-width: 699px) {
		.shelf-wide {
			display: none;
		}

		.shelf-narrow {
			display: block;
		}

		.board {
			height: 44px;
			margin-top: 10px;
			border-bottom-width: 5px;
		}
	}

	/* One line, ellipsis, never wider than the shelf. Positioned by transform so its
	   width is measured from the shelf's left edge. Not a keyboard stop: the shelf's
	   own name says the same for screen readers. */
	.spine-label {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 2;
		max-width: 100%;
		padding: 6px 10px;
		background: var(--ink);
		color: var(--on-ink);
		font-size: 15px;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		pointer-events: none;
	}
</style>
