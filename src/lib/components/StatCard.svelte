<script lang="ts">
	export let label: string;
	export let value: string | number;

	$: isNumber = typeof value === 'number';
	$: displayValue = isNumber ? (value as number).toLocaleString() : value;
</script>

<div class="stat-card">
	<span class="value" class:text-value={!isNumber}>{displayValue}</span>
	<span class="label">{label}</span>
</div>

<style>
	.stat-card {
		background: var(--color-bg-card, #fff);
		border: 1px solid var(--color-border, #e0e0e0);
		border-radius: 12px;
		padding: 1.25rem 1rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		position: relative;
		overflow: hidden;
	}

	.stat-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
	}

	.value {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.1;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.value.text-value {
		font-size: 1rem;
		font-weight: 600;
	}

	.label {
		font-size: 0.6875rem;
		color: var(--color-text-secondary, #666);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
