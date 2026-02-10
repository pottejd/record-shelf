<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

	let { items, username }: { items: DiscogsCollectionItem[]; username: string } = $props();

	let loading = $state(false);
	let result: { totalValue: number; pricedCount: number; totalRequested: number; currency: string } | null = $state(null);
	let errorMsg = $state('');

	async function estimateValue() {
		loading = true;
		errorMsg = '';
		result = null;

		try {
			// Sample up to 50 releases for estimation
			const sampleSize = Math.min(items.length, 50);
			const shuffled = [...items].sort(() => Math.random() - 0.5);
			const sample = shuffled.slice(0, sampleSize);
			const releaseIds = sample.map(i => i.basic_information.id);

			const response = await fetch(`/api/value/${username}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ releaseIds })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to estimate value');
			}

			const data = await response.json();

			// Extrapolate to full collection if we sampled
			if (data.pricedCount > 0 && items.length > sampleSize) {
				const avgPrice = data.totalValue / data.pricedCount;
				data.totalValue = avgPrice * items.length;
				data.totalRequested = items.length;
				data.pricedCount = Math.round((data.pricedCount / sampleSize) * items.length);
			}

			result = data;
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Failed to estimate value';
		} finally {
			loading = false;
		}
	}

	function formatCurrency(value: number, currency: string): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
			maximumFractionDigits: 0
		}).format(value);
	}
</script>

<div class="value-estimate">
	{#if result}
		<div class="value-result">
			<span class="value-amount">{formatCurrency(result.totalValue, result.currency)}</span>
			<span class="value-label">Estimated collection value</span>
			<span class="value-note">
				Based on {result.pricedCount} of {result.totalRequested} items with marketplace data
				{#if items.length > 50}
					(extrapolated from 50-item sample)
				{/if}
			</span>
		</div>
	{:else}
		<div class="value-prompt">
			<p>Get a rough estimate of your collection's market value based on Discogs marketplace data.</p>
			{#if errorMsg}
				<p class="error">{errorMsg}</p>
			{/if}
			<button class="estimate-btn" onclick={estimateValue} disabled={loading}>
				{#if loading}
					<span class="spinner"></span>
					Estimating...
				{:else}
					Estimate Value
				{/if}
			</button>
			<p class="disclaimer">Requires a Discogs API token. Samples up to 50 items and extrapolates.</p>
		</div>
	{/if}
</div>

<style>
	.value-estimate {
		text-align: center;
	}

	.value-result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.5rem;
	}

	.value-amount {
		font-size: 2.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, #22c55e, #14b8a6);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.value-label {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.value-note {
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		margin-top: 0.5rem;
	}

	.value-prompt {
		padding: 1rem 0;
	}

	.value-prompt p {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.error {
		color: #dc2626 !important;
	}

	.estimate-btn {
		padding: 0.75rem 2rem;
		font-size: 0.9375rem;
		font-weight: 600;
		background: linear-gradient(135deg, #22c55e, #14b8a6);
		color: white;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
	}

	.estimate-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
	}

	.estimate-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.disclaimer {
		font-size: 0.6875rem !important;
		color: var(--color-text-tertiary) !important;
		margin-top: 0.75rem !important;
	}

	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		vertical-align: middle;
		margin-right: 0.5rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
