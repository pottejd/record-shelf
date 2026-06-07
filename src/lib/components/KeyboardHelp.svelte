<script lang="ts">
	let { open = false, onClose }: { open?: boolean; onClose: () => void } = $props();

	let backdrop = $state<HTMLDivElement | undefined>();

	const shortcuts = [
		{ keys: 'j / k', desc: 'Next / previous section' },
		{ keys: '/', desc: 'Focus collection search' },
		{ keys: '?', desc: 'Show this help' },
		{ keys: 'Esc', desc: 'Close drawer / dialog' }
	];

	function onKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') onClose();
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	$effect(() => {
		if (open && backdrop) {
			backdrop.querySelector<HTMLElement>('.kh-close')?.focus();
		}
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div
		class="kh-backdrop"
		bind:this={backdrop}
		onclick={onBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-label="Keyboard shortcuts"
		tabindex="-1"
	>
		<div class="kh-modal">
			<div class="kh-head">
				<h2>Keyboard shortcuts</h2>
				<button class="kh-close" onclick={onClose} aria-label="Close">✕</button>
			</div>
			<dl>
				{#each shortcuts as s}
					<div class="kh-row">
						<dt><kbd>{s.keys}</kbd></dt>
						<dd>{s.desc}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</div>
{/if}

<style>
	.kh-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 100;
	}

	.kh-modal {
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		padding: 1.25rem 1.5rem;
		width: 100%;
		max-width: 360px;
	}

	.kh-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.kh-head h2 {
		margin: 0;
		font-size: 1.125rem;
	}

	.kh-close {
		background: none;
		border: none;
		font-size: 1rem;
		color: var(--color-text-secondary);
		cursor: pointer;
		padding: 0.25rem;
	}

	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.kh-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	dt {
		flex: 0 0 90px;
	}

	dd {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 0.2rem 0.5rem;
	}
</style>
