<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { sampleN } from '$lib/utils/array';

	let { items, username }: { items: DiscogsCollectionItem[]; username: string } = $props();

	// Memoize the sampled release ids so repeated estimates reuse the same set
	// (and therefore the server's per-release price cache) instead of re-sampling.
	let sampledIds: number[] | null = null;
	function getSampleIds(): number[] {
		if (!sampledIds) {
			sampledIds = sampleN(items, Math.min(items.length, 50)).map((i) => i.basic_information.id);
		}
		return sampledIds;
	}

	let loading = $state(false);
	let result: {
		totalValue: number;
		pricedCount: number;
		totalRequested: number;
		failedCount?: number;
		currency: string;
		results?: Array<{ releaseId: number; lowestPrice: number | null; currency: string }>;
	} | null = $state(null);
	let errorMsg = $state('');
	let history = $state<Array<{ date: string; value: number; currency: string }>>([]);

	// Top-priced items from the sampled results — surfaces the per-item prices the
	// endpoint already returns instead of discarding them.
	let topValued = $derived.by(() => {
		const results = result?.results;
		if (!results) return [];
		return results
			.filter((r) => r.lowestPrice != null)
			.sort((a, b) => (b.lowestPrice ?? 0) - (a.lowestPrice ?? 0))
			.slice(0, 5)
			.map((r) => ({
				price: r.lowestPrice as number,
				currency: r.currency,
				item: items.find((i) => i.basic_information.id === r.releaseId)
			}))
			.filter(
				(x): x is { price: number; currency: string; item: DiscogsCollectionItem } => !!x.item
			);
	});

	async function estimateValue() {
		loading = true;
		errorMsg = '';
		result = null;

		try {
			// Sample up to 50 releases for estimation (stable across re-clicks)
			const sampleSize = Math.min(items.length, 50);
			const releaseIds = getSampleIds();

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

			// Record a value snapshot and load the trend (non-fatal if it fails).
			try {
				const histRes = await fetch(`/api/value-history/${username}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ value: Math.round(data.totalValue), currency: data.currency })
				});
				if (histRes.ok) history = (await histRes.json()).history ?? [];
			} catch {
				// ignore — history is a nice-to-have
			}
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
			{#if result.failedCount && result.failedCount > 0}
				<span class="value-warning">
					⚠ {result.failedCount} price lookup{result.failedCount === 1 ? '' : 's'} failed — this estimate may be incomplete.
				</span>
			{/if}
			{#if topValued.length > 0}
				<div class="most-valuable">
					<h3>Most valuable</h3>
					<ul>
						{#each topValued as v}
							<li>
								<span class="mv-title">{v.item.basic_information.title}</span>
								<span class="mv-price">{formatCurrency(v.price, v.currency)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if history.length > 1}
				{@const first = history[0]}
				{@const last = history[history.length - 1]}
				{@const max = Math.max(...history.map((h) => h.value), 1)}
				{@const pct =
					first.value > 0 ? Math.round(((last.value - first.value) / first.value) * 100) : 0}
				<div class="value-history">
					<h3>Value over time</h3>
					<div class="vh-spark">
						{#each history as snap}
							<span
								class="vh-bar"
								style:height="{(snap.value / max) * 100}%"
								title="{snap.date}: {formatCurrency(snap.value, snap.currency)}"
							></span>
						{/each}
					</div>
					<span class="vh-caption">
						{history.length} snapshots · {pct >= 0 ? '+' : ''}{pct}% since {first.date}
					</span>
				</div>
			{/if}
		</div>
	{:else}
		<div class="value-prompt">
			<p>Get a rough estimate of this collection's market value based on Discogs marketplace data.</p>
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

	.value-warning {
		font-size: 0.75rem;
		color: #b45309;
		margin-top: 0.5rem;
	}

	.most-valuable {
		width: 100%;
		max-width: 360px;
		margin: 1.25rem auto 0;
		text-align: left;
	}

	.most-valuable h3 {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin: 0 0 0.5rem;
	}

	.most-valuable ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.most-valuable li {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.8125rem;
	}

	.mv-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--color-text);
	}

	.mv-price {
		flex-shrink: 0;
		font-weight: 600;
		color: var(--color-primary);
	}

	.value-history {
		width: 100%;
		max-width: 360px;
		margin: 1.25rem auto 0;
		text-align: left;
	}

	.value-history h3 {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin: 0 0 0.5rem;
	}

	.vh-spark {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 40px;
	}

	.vh-bar {
		flex: 1;
		min-height: 2px;
		background: var(--gradient-brand);
		border-radius: 2px 2px 0 0;
	}

	.vh-caption {
		display: block;
		margin-top: 0.375rem;
		font-size: 0.7rem;
		color: var(--color-text-tertiary);
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
