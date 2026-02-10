<script lang="ts">
	let { value = $bindable(''), placeholder = '' }: { value: string; placeholder?: string } = $props();
</script>

<div class="search-box">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
		<circle cx="11" cy="11" r="8" />
		<path d="m21 21-4.35-4.35" />
	</svg>
	<input
		type="text"
		bind:value
		{placeholder}
	/>
	{#if value}
		<button class="clear-search" onclick={() => value = ''}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.search-box {
		flex: 1;
		min-width: 200px;
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0.875rem;
		width: 18px;
		height: 18px;
		color: var(--color-text-tertiary);
		pointer-events: none;
	}

	.search-box input {
		width: 100%;
		padding: 0.75rem 2.5rem 0.75rem 2.75rem;
		font-size: 0.9375rem;
		border: 2px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg-card);
		color: var(--color-text);
	}

	.search-box input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.clear-search {
		position: absolute;
		right: 0.5rem;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-secondary);
		border: none;
		border-radius: 6px;
		color: var(--color-text-tertiary);
		cursor: pointer;
	}

	.clear-search:hover {
		color: var(--color-text);
	}

	.clear-search svg {
		width: 14px;
		height: 14px;
	}
</style>
