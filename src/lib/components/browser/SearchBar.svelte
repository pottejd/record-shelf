<script lang="ts">
	let { value = $bindable(''), placeholder = '' }: { value: string; placeholder?: string } = $props();
</script>

<div class="search-box">
	<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
		<circle cx="11" cy="11" r="8" />
		<path d="m21 21-4.35-4.35" />
	</svg>
	<input
		type="search"
		class="field"
		bind:value
		{placeholder}
		aria-label={placeholder || 'Search'}
	/>
	{#if value}
		<button class="clear-search" onclick={() => value = ''} aria-label="Clear search">
			<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>

<style>
	/* An underlined field (the global .field) with the search icon at its start
	   and the clear button at its end. */
	.search-box {
		flex: 1;
		min-width: 200px;
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0;
		width: 20px;
		height: 20px;
		color: var(--ink);
		pointer-events: none;
	}

	.search-box input {
		padding: 0 48px 0 32px;
		-webkit-appearance: none;
		appearance: none;
	}

	/* The clear button below does this job; hide the browser's own. */
	.search-box input::-webkit-search-cancel-button {
		-webkit-appearance: none;
		appearance: none;
	}

	.clear-search {
		position: absolute;
		right: 0;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 0;
		color: var(--muted);
		cursor: pointer;
	}

	.clear-search:hover {
		color: var(--ink);
	}

	.clear-search svg {
		width: 18px;
		height: 18px;
	}
</style>
