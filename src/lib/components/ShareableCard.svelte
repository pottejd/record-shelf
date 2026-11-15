<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { CollectionStats, DiscogsCollectionItem } from '$lib/types/discogs';
	import { shelfOrder } from '$lib/shelf/spines';
	import {
		CARD,
		CARD_FONT_FAMILY,
		canvasMeasure,
		drawCard,
		layoutCard,
		sampleEvenly,
		shareAddress,
		shareText,
		type Measure
	} from '$lib/utils/share';

	let { username, stats, items, badges = [] }: {
		username: string;
		stats: CollectionStats;
		items: DiscogsCollectionItem[];
		badges?: { label: string; style: string }[];
	} = $props();

	const SCALE = 2;
	/** Until the font is in, a rough width: the preview is laid out again once it is. */
	const roughly: Measure = (text, size, weight) => text.length * size * (weight >= 700 ? 0.62 : 0.56);

	let measure = $state<Measure>(roughly);
	let copied = $state(false);

	// The host the page is on (the same as location.host in the browser).
	let address = $derived(shareAddress(page.url.host, username));
	let input = $derived({
		username,
		address,
		stats,
		badges: badges.map((b) => b.label),
		spines: sampleEvenly(shelfOrder(items), 64)
	});
	let marks = $derived(layoutCard(input, measure));

	/** The canvas is measured in the site's font, so it must have loaded first. */
	async function fontReady(): Promise<void> {
		try {
			await document.fonts.load(`800 40px '${CARD_FONT_FAMILY}'`);
		} catch {
			// Drawn in the fallback font rather than not at all.
		}
	}

	onMount(() => {
		let live = true;
		fontReady().then(() => {
			const ctx = document.createElement('canvas').getContext('2d');
			if (live && ctx) measure = canvasMeasure(ctx);
		});
		return () => (live = false);
	});

	async function copyText() {
		try {
			await navigator.clipboard.writeText(shareText(username, stats, address));
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			alert('Copy not supported in this browser');
		}
	}

	async function downloadPNG() {
		await fontReady();
		const canvas = document.createElement('canvas');
		canvas.width = CARD.width * SCALE;
		canvas.height = CARD.height * SCALE;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.scale(SCALE, SCALE);
		drawCard(ctx, layoutCard(input, canvasMeasure(ctx)));

		const link = document.createElement('a');
		link.download = `${username}-record-shelf.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
	}

	/** Card units to a share of the preview's width (CARD.width units across). */
	const u = (n: number) => `${+((n * 100) / CARD.width).toFixed(4)}cqw`;
</script>

<div class="share">
	<!-- The preview is the picture itself, laid out by the same marks the PNG is drawn from. -->
	<div class="picture">
		{#each marks as m}
			{#if m.kind === 'rect'}
				<span
					class="mark"
					aria-hidden="true"
					style:left={u(m.x)}
					style:top={u(m.y)}
					style:width={u(m.w)}
					style:height={u(m.h)}
					style:background={m.fill}
				></span>
			{:else}
				<span
					class="mark text"
					style:left={m.align === 'left' ? u(m.x) : null}
					style:right={m.align === 'right' ? u(CARD.width - m.x) : null}
					style:top={u(m.y)}
					style:font-size={u(m.size)}
					style:font-weight={m.weight}
					style:color={m.fill}>{m.text}</span
				>
			{/if}
		{/each}
	</div>

	<div class="actions">
		<button type="button" class="btn btn-primary" onclick={downloadPNG}>Download PNG</button>
		<button type="button" class="btn btn-secondary" onclick={copyText}>{copied ? 'Copied!' : 'Copy text'}</button>
	</div>
</div>

<style>
	.share {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 24px 32px;
	}

	/* As drawn: 264px wide; the marks are placed in shares of this width. */
	.picture {
		position: relative;
		width: 264px;
		max-width: 100%;
		aspect-ratio: 400 / 500;
		container-type: inline-size;
	}

	.mark {
		position: absolute;
		display: block;
	}

	.text {
		line-height: 1;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}
</style>
