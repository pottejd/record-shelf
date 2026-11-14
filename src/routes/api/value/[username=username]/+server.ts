import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { USER_AGENT } from '$lib/constants';
import { DiscogsAPIError, discogsGet } from '$lib/api/discogs';
import { getStore } from '$lib/server/store';
import { PACE_MS, PRICE_TTL_SECONDS } from '$lib/sync/types';

interface PriceSuggestion {
	[condition: string]: {
		currency: string;
		value: number;
	};
}

interface CachedPrice {
	lowestPrice: number | null;
	currency: string;
	timestamp: number;
}

// Per-request id cap: each uncached id costs one paced Discogs call, so a cold
// request runs ~N*1.1s. Results are extrapolated from the sample anyway.
const MAX_RELEASE_IDS = 20;

export const POST: RequestHandler = async ({ params, request, cookies, platform }) => {
	const { username } = params;
	if (!username) throw error(400, 'Username is required');

	let body: { releaseIds?: unknown } | null;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body || typeof body !== 'object' || !Array.isArray(body.releaseIds)) {
		throw error(400, 'releaseIds array is required');
	}

	// Keep only valid positive integer release ids, capped to limit abuse.
	const ids = body.releaseIds
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0)
		.slice(0, MAX_RELEASE_IDS);

	if (ids.length === 0) {
		throw error(400, 'releaseIds must contain at least one valid release id');
	}

	// Only the visitor's own cookie token is ever used for Discogs.
	const token = cookies.get('discogs_token');
	if (!token) {
		throw error(401, 'Discogs token required for marketplace data');
	}

	const store = getStore(platform);
	const results: Array<{ releaseId: number; lowestPrice: number | null; currency: string }> = [];
	let failedCount = 0; // requests that errored (auth/network/upstream), distinct from "no data"
	let retryAfterMs: number | undefined;
	let fetched = false;
	const now = Date.now();

	for (const releaseId of ids) {
		const cached = await store.getJSON<CachedPrice>(`price:${releaseId}`);
		if (cached && now - cached.timestamp < PRICE_TTL_SECONDS * 1000) {
			results.push({ releaseId, lowestPrice: cached.lowestPrice, currency: cached.currency });
			continue;
		}

		// Pace our own Discogs calls: wait before every call except the first.
		if (fetched) await new Promise((r) => setTimeout(r, PACE_MS));
		fetched = true;

		try {
			const { data } = await discogsGet<PriceSuggestion>(
				`/marketplace/price_suggestions/${releaseId}`,
				{ userAgent: USER_AGENT, token }
			);
			const ref = data['Near Mint (NM or M-)'] || data['Very Good Plus (VG+)'];
			const result = {
				releaseId,
				lowestPrice: ref?.value ?? null,
				currency: ref?.currency ?? 'USD'
			};
			results.push(result);
			// A failed cache write is already logged by the store; the estimate stands.
			await store.putJSON(
				`price:${releaseId}`,
				{ lowestPrice: result.lowestPrice, currency: result.currency, timestamp: Date.now() },
				PRICE_TTL_SECONDS
			);
		} catch (e) {
			if (e instanceof DiscogsAPIError && e.code === 'RATE_LIMITED') {
				// Stop cleanly; the client reports a partial estimate.
				retryAfterMs = e.retryAfterMs;
				break;
			}
			failedCount++;
			results.push({ releaseId, lowestPrice: null, currency: 'USD' });
		}
	}

	// Sum only prices in a single currency so the total is internally consistent —
	// Discogs can return per-listing currencies and we don't convert FX. The
	// display currency is the first priced result's; other-currency items are
	// excluded from the total rather than added as if they matched.
	const currency = results.find((r) => r.lowestPrice !== null)?.currency || 'USD';
	const priced = results.filter((r) => r.lowestPrice !== null && r.currency === currency);
	const totalValue = priced.reduce((sum, r) => sum + (r.lowestPrice || 0), 0);
	const pricedCount = priced.length;

	return json({
		totalValue,
		pricedCount,
		totalRequested: ids.length,
		// How many price lookups errored (so the client can flag an incomplete estimate
		// rather than presenting a confidently-wrong total).
		failedCount,
		currency,
		results,
		// Present only when a 429 stopped the loop: the estimate covers just the ids priced so far.
		...(retryAfterMs !== undefined && { retryAfterMs })
	});
};
