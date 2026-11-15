<script lang="ts">
	import { NO_COVER, showNoCover } from '$lib/utils/cover';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let { open = false, title = '', items = [], onClose }: {
		open?: boolean;
		title?: string;
		items?: DiscogsCollectionItem[];
		onClose: () => void;
	} = $props();

	const PAGE_SIZE = 50;
	let visibleCount = $state(PAGE_SIZE);
	let visibleItems = $derived(items.slice(0, visibleCount));
	let hasMore = $derived(visibleCount < items.length);

	let backdropEl: HTMLDivElement | undefined = $state();

	function handleKeydown(e: KeyboardEvent) {
		// The window listener is always mounted; ignore keys when the drawer is
		// closed so Escape/Tab elsewhere on the page don't trigger close/focus-trap.
		if (!open) return;
		if (e.key === 'Escape') onClose();
		if (e.key === 'Tab' && backdropEl) holdFocus(e, backdropEl);
	}

	/** Tab and Shift+Tab go round the list's own controls and never leave it; focus
	 *  that has strayed out (to the page behind) is pulled back in. Focus in another
	 *  dialog over this one (the keyboard help) is that dialog's to hold. */
	function holdFocus(e: KeyboardEvent, root: HTMLElement) {
		const at = document.activeElement;
		const inside = at instanceof Node && root.contains(at);
		if (!inside && at instanceof Element && at.closest('[aria-modal="true"]')) return;
		const focusable = root.querySelectorAll<HTMLElement>(
			'a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey && (at === first || !inside)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (at === last || !inside)) {
			e.preventDefault();
			first.focus();
		}
	}

	let listEl: HTMLUListElement | undefined = $state();

	/** Shows the next 50. The last press removes the button, so focus moves on to the
	 *  first record it brought in rather than falling out of the list. */
	async function showMore() {
		const first = visibleCount;
		visibleCount += PAGE_SIZE;
		if (hasMore) return;
		await tick();
		(listEl?.children[first] as HTMLElement | undefined)?.focus();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	// Reset visible count when items change
	$effect(() => {
		// Track title and items.length to detect drawer content changes
		title;
		items.length;
		visibleCount = PAGE_SIZE;
	});

	// Auto-focus close button when drawer opens
	$effect(() => {
		if (open && backdropEl) {
			const closeBtn = backdropEl.querySelector<HTMLElement>('.close-btn');
			if (closeBtn) closeBtn.focus();
		}
	});

	// Lock background scroll while the drawer is open.
	$effect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div
		class="drawer-backdrop"
		bind:this={backdropEl}
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-labelledby="drawer-title"
		tabindex="-1"
	>
		<aside class="drawer" transition:fly={{ x: 400, duration: 300, easing: quintOut }}>
			<header class="drawer-header">
				<div>
					<h2 id="drawer-title">{title}</h2>
					<p class="item-count small">{items.length} {items.length === 1 ? 'record' : 'records'}</p>
				</div>
				<button class="close-btn" onclick={onClose} aria-label="Close">
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</header>

			<div class="drawer-content">
				{#if items.length === 0}
					<p class="empty">No records found</p>
				{:else}
					<ul class="record-list rows" bind:this={listEl}>
						{#each visibleItems as item}
							<li class="record-item" tabindex="-1">
								<img
									src={item.basic_information.thumb || NO_COVER}
									alt=""
									class="record-thumb cover"
									loading="lazy"
									onerror={showNoCover}
								/>
								<div class="record-info">
									<p class="record-title">{item.basic_information.title}</p>
									<p class="record-artist">
										{formatArtists(item.basic_information.artists)}
									</p>
									<div class="record-meta">
										{#if item.basic_information.year}
											<span class="year">{item.basic_information.year}</span>
										{/if}
										{#if item.basic_information.formats?.length}
											<span class="format">
												{item.basic_information.formats[0].name}
												{#if item.basic_information.formats[0].descriptions?.length}
													<span class="format-detail">
														({item.basic_information.formats[0].descriptions.join(', ')})
													</span>
												{/if}
											</span>
										{/if}
									</div>
								</div>
								<a
									href="https://www.discogs.com/release/{item.basic_information.id}"
									target="_blank"
									rel="noopener noreferrer"
									class="discogs-btn"
									aria-label="View on Discogs"
								>
									<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
									</svg>
								</a>
							</li>
						{/each}
					</ul>
					{#if hasMore}
						<button class="show-more-btn btn btn-secondary" onclick={showMore}>
							Show more ({items.length - visibleCount} remaining)
						</button>
					{/if}
				{/if}
			</div>
		</aside>
	</div>
{/if}

<style>
	/* The page recedes under a veil of the ground colour; the list sits in a
	   ground-coloured panel on the right edge, marked off by a 2px ink edge. */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: color-mix(in srgb, var(--ground) 80%, transparent);
		z-index: 1000;
		display: flex;
		justify-content: flex-end;
	}

	.drawer {
		width: 100%;
		max-width: 480px;
		height: 100%;
		background: var(--ground);
		border-left: 2px solid var(--ink);
		display: flex;
		flex-direction: column;
	}

	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		padding: 24px 24px 16px;
		border-bottom: 1px solid var(--hairline);
	}

	.drawer-header h2 {
		margin: 0;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}

	.item-count {
		margin: 4px 0 0;
	}

	.close-btn {
		width: var(--touch);
		height: var(--touch);
		flex-shrink: 0;
		padding: 10px;
		background: transparent;
		border: 0;
		border-radius: 0;
		cursor: pointer;
		color: var(--ink);
	}

	.close-btn svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		padding: 0 24px 24px;
	}

	.empty {
		color: var(--muted);
		padding: 48px 0;
		margin: 0;
	}

	.record-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.record-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 0;
	}

	.record-thumb {
		width: 56px;
		height: 56px;
		background: var(--track);
		flex-shrink: 0;
	}

	.record-info {
		flex: 1;
		min-width: 0;
	}

	.record-title {
		margin: 0;
		font-weight: 600;
		font-size: 17px;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.record-artist {
		margin: 2px 0 0;
		font-size: 15px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.record-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0 8px;
		margin-top: 2px;
		font-size: 15px;
		color: var(--muted);
	}

	.year {
		font-weight: 600;
		color: var(--ink);
	}

	.discogs-btn {
		width: var(--touch);
		height: var(--touch);
		padding: 12px;
		color: var(--muted);
		flex-shrink: 0;
	}

	.discogs-btn:hover {
		color: var(--ink);
	}

	.discogs-btn svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.show-more-btn {
		width: 100%;
		margin-top: 16px;
	}

	@media (max-width: 500px) {
		.drawer {
			max-width: 100%;
			border-left: 0;
		}

		.drawer-header {
			padding: 20px 20px 16px;
		}

		.drawer-content {
			padding: 0 20px 20px;
		}
	}
</style>
