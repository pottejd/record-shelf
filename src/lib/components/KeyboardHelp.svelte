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
		onkeydown={onKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Keyboard shortcuts"
		tabindex="-1"
	>
		<div class="kh-modal">
			<div class="kh-head">
				<h2>Keyboard shortcuts</h2>
				<button class="kh-close" onclick={onClose} aria-label="Close">
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
			<dl class="rows">
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
	/* The page recedes under a veil of the ground colour; the help is an open
	   panel under a thick ink rule, edged in ink so it stands off the page. */
	.kh-backdrop {
		position: fixed;
		inset: 0;
		background: color-mix(in srgb, var(--ground) 80%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		z-index: 100;
	}

	.kh-modal {
		background: var(--ground);
		border: 2px solid var(--ink);
		border-top: var(--rule) solid var(--ink);
		padding: 16px 24px 16px;
		width: 100%;
		max-width: 440px;
	}

	.kh-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 8px;
	}

	.kh-head h2 {
		margin: 0;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.kh-close {
		width: var(--touch);
		height: var(--touch);
		flex-shrink: 0;
		padding: 10px;
		margin-right: -10px;
		background: transparent;
		border: 0;
		border-radius: 0;
		color: var(--ink);
		cursor: pointer;
	}

	.kh-close svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	dl {
		margin: 0;
	}

	.kh-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 0;
	}

	dt {
		flex: 0 0 96px;
	}

	dd {
		margin: 0;
		font-size: 17px;
	}

	kbd {
		display: inline-block;
		font-family: ui-monospace, monospace;
		font-size: 15px;
		color: var(--ink);
		border: 1px solid var(--hairline);
		border-radius: 0;
		padding: 2px 8px;
	}
</style>
