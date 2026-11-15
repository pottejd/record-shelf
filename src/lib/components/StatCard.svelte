<script lang="ts">
	let { label, value }: { label: string; value: string | number } = $props();

	let isNumber = $derived(typeof value === 'number');
	let displayValue = $derived(isNumber ? (value as number).toLocaleString() : value);
</script>

<div class="stat-card">
	<span class="value" class:figure={isNumber} class:text-value={!isNumber}>{displayValue}</span>
	<span class="label small">{label}</span>
</div>

<style>
	/* No box: a big ink figure over a muted label, under a hairline. */
	.stat-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		padding-top: 12px;
		border-top: 1px solid var(--hairline);
	}

	.value {
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	.value.text-value {
		font-size: 21px;
		font-weight: 700;
		line-height: 1.2;
		min-height: 37px;
		display: flex;
		align-items: flex-end;
	}
</style>
