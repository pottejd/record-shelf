<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	export let open = false;
	export let title = '';
	export let items: DiscogsCollectionItem[] = [];
	export let onClose: () => void;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
	<div
		class="drawer-backdrop"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-labelledby="drawer-title"
	>
		<aside class="drawer" transition:fly={{ x: 400, duration: 300, easing: quintOut }}>
			<header class="drawer-header">
				<div>
					<h2 id="drawer-title">{title}</h2>
					<p class="item-count">{items.length} {items.length === 1 ? 'record' : 'records'}</p>
				</div>
				<button class="close-btn" onclick={onClose} aria-label="Close">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</header>

			<div class="drawer-content">
				{#if items.length === 0}
					<p class="empty">No records found</p>
				{:else}
					<ul class="record-list">
						{#each items as item}
							<li class="record-item">
								<img
									src={item.basic_information.thumb || '/placeholder.svg'}
									alt=""
									class="record-thumb"
									loading="lazy"
								/>
								<div class="record-info">
									<p class="record-title">{item.basic_information.title}</p>
									<p class="record-artist">
										{item.basic_information.artists.map((a) => a.name).join(', ')}
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
									rel="noopener"
									class="discogs-btn"
									aria-label="View on Discogs"
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
									</svg>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</aside>
	</div>
{/if}

<style>
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
		display: flex;
		justify-content: flex-end;
	}

	.drawer {
		width: 100%;
		max-width: 480px;
		height: 100%;
		background: var(--color-bg, #fff);
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
	}

	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1.5rem;
		border-bottom: 1px solid var(--color-border, #e0e0e0);
		background: var(--color-bg-card, #fff);
	}

	.drawer-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.item-count {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary, #666);
	}

	.close-btn {
		width: 36px;
		height: 36px;
		padding: 8px;
		background: var(--color-bg-secondary, #f5f5f5);
		border: none;
		border-radius: 8px;
		cursor: pointer;
		color: var(--color-text, #333);
		transition: background-color 0.2s;
	}

	.close-btn:hover {
		background: var(--color-bg-tertiary, #e5e5e5);
	}

	.close-btn svg {
		width: 100%;
		height: 100%;
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.empty {
		text-align: center;
		color: var(--color-text-tertiary, #999);
		padding: 3rem 1rem;
	}

	.record-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.record-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-bg-card, #fff);
		border: 1px solid var(--color-border, #e0e0e0);
		border-radius: 12px;
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.record-item:hover {
		transform: translateX(-2px);
		box-shadow: var(--shadow-md);
	}

	.record-thumb {
		width: 56px;
		height: 56px;
		border-radius: 6px;
		object-fit: cover;
		background: var(--color-bg-secondary, #f5f5f5);
		flex-shrink: 0;
	}

	.record-info {
		flex: 1;
		min-width: 0;
	}

	.record-title {
		margin: 0;
		font-weight: 600;
		font-size: 0.9375rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.record-artist {
		margin: 0.125rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-text-secondary, #666);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.record-meta {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--color-text-tertiary, #999);
	}

	.year {
		font-weight: 600;
		color: var(--color-primary, #6366f1);
	}

	.format-detail {
		opacity: 0.7;
	}

	.discogs-btn {
		width: 32px;
		height: 32px;
		padding: 6px;
		color: var(--color-text-tertiary, #999);
		border-radius: 6px;
		transition: color 0.2s, background-color 0.2s;
		flex-shrink: 0;
	}

	.discogs-btn:hover {
		color: var(--color-primary, #6366f1);
		background: var(--color-bg-secondary, #f5f5f5);
	}

	.discogs-btn svg {
		width: 100%;
		height: 100%;
	}

	@media (max-width: 500px) {
		.drawer {
			max-width: 100%;
		}
	}
</style>
