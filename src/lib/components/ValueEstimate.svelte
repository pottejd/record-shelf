<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { evenSample } from '$lib/utils/array';
	import { estimateValue as estimateFromDiscogs, type ValueEstimate } from '$lib/value/estimate';
	import { tokenFromCookie } from '$lib/sync/token';

	let { items, username }: { items: DiscogsCollectionItem[]; username: string } = $props();

	// The same 20 releases on every visit (an even spread over the collection
	// ordered by instance id), so the prices this browser remembers are reused.
	function getSampleIds(): number[] {
		return evenSample([...items].sort((a, b) => a.instance_id - b.instance_id), 20).map(
			(i) => i.basic_information.id
		);
	}

	let loading = $state(false);
	let result: ValueEstimate | null = $state(null);
	let errorMsg = $state('');
	let partial = $state(false);
	/** Releases priced so far in the running estimate. */
	let progress = $state<{ done: number; total: number } | null>(null);
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
		partial = false;
		result = null;
		progress = null;

		try {
			// Sample up to 20 releases for estimation (stable across re-clicks)
			const sampleSize = Math.min(items.length, 20);
			const token = tokenFromCookie();
			if (!token) throw new Error('Discogs token required for marketplace data');

			// Asked of Discogs straight from this browser, one paced call per release.
			const data = await estimateFromDiscogs(getSampleIds(), token, {
				onProgress: (done, total) => (progress = { done, total })
			});

			// Extrapolate to full collection if we sampled
			if (data.pricedCount > 0 && items.length > sampleSize) {
				const avgPrice = data.totalValue / data.pricedCount;
				data.totalValue = avgPrice * items.length;
				data.totalRequested = items.length;
				data.pricedCount = Math.round((data.pricedCount / sampleSize) * items.length);
			}

			result = data;
			partial = data.partial;
			// A partial estimate (Discogs was busy) must not become a snapshot.
			if (partial) return;

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
				{#if items.length > 20}
					(extrapolated from 20-item sample)
				{/if}
			</span>
			{#if partial}
				<span class="value-warning error-note">Discogs is busy — this is a partial estimate. Try again in a minute.</span>
			{/if}
			{#if result.failedCount > 0}
				<span class="value-warning error-note">
					⚠ {result.failedCount} price lookup{result.failedCount === 1 ? '' : 's'} failed — this estimate may be incomplete.
				</span>
			{/if}
			{#if topValued.length > 0}
				<div class="most-valuable">
					<h3>Most valuable</h3>
					<ul class="rows">
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
					<ul class="visually-hidden" aria-label="Value snapshots">
						{#each history as snap}
							<li>{snap.date}: {formatCurrency(snap.value, snap.currency)}</li>
						{/each}
					</ul>
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
				<p class="error error-note">{errorMsg}</p>
			{/if}
			<button class="estimate-btn btn btn-primary" onclick={estimateValue} disabled={loading}>
				{#if loading}
					<span class="spinner"></span>
					{#if progress}
						Estimating… {progress.done} of {progress.total}
					{:else}
						Estimating...
					{/if}
				{:else}
					Estimate Value
				{/if}
			</button>
			<p class="disclaimer">Requires a Discogs API token. Samples up to 20 items and extrapolates.</p>
		</div>
	{/if}
</div>

<style>
	.value-result {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}

	.value-amount {
		font-size: 44px;
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}

	.value-label {
		font-size: 15px;
		color: var(--muted);
	}

	.value-note {
		margin-top: 8px;
		font-size: 15px;
		color: var(--muted);
	}

	.value-warning {
		margin-top: 12px;
		font-size: 15px;
	}

	.most-valuable,
	.value-history {
		width: 100%;
		margin-top: 24px;
	}

	.most-valuable h3,
	.value-history h3 {
		margin: 0 0 4px;
		font-size: 18px;
		font-weight: 700;
	}

	.most-valuable ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.most-valuable li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		min-height: 44px;
		font-size: 17px;
	}

	.mv-title {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mv-price {
		flex-shrink: 0;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* One series: an ink bar per snapshot, its value on hover. */
	.vh-spark {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 48px;
		border-bottom: 1px solid var(--ink);
	}

	.vh-bar {
		flex: 1;
		min-height: 2px;
		background: var(--ink);
	}

	.vh-caption {
		display: block;
		margin-top: 8px;
		font-size: 15px;
		color: var(--muted);
	}

	.value-prompt {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
	}

	.value-prompt p {
		margin: 0;
		font-size: 17px;
	}

	.value-prompt .disclaimer {
		font-size: 15px;
		color: var(--muted);
	}

	/* Base .spinner is global (app.css); this one is slightly smaller. */
	.spinner {
		width: 16px;
		height: 16px;
	}
</style>
