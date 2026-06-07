import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';
import { kvGetJSON, kvPutJSON } from '$lib/server/cache';

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

// LRU price cache (survives across requests, cleared on redeploy)
const MAX_CACHE_SIZE = 2000;
const priceCache = new Map<number, CachedPrice>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(key: number): CachedPrice | undefined {
	const entry = priceCache.get(key);
	if (!entry) return undefined;
	// Move to end (most recently used)
	priceCache.delete(key);
	priceCache.set(key, entry);
	return entry;
}

function setCache(key: number, value: CachedPrice) {
	priceCache.delete(key); // Remove if exists to refresh position
	if (priceCache.size >= MAX_CACHE_SIZE) {
		// Evict oldest (first) entry
		const oldest = priceCache.keys().next().value;
		if (oldest !== undefined) priceCache.delete(oldest);
	}
	priceCache.set(key, value);
}

const CACHE_TTL_SECONDS = Math.floor(CACHE_TTL_MS / 1000);

// KV-backed price cache (shared across isolates) with the in-memory LRU as a
// fast/local fallback when KV isn't available (dev / adapter-node).
async function getCachedPrice(
	platform: App.Platform | undefined,
	releaseId: number
): Promise<CachedPrice | undefined> {
	const fromKv = await kvGetJSON<CachedPrice>(platform, `price:${releaseId}`);
	if (fromKv) return fromKv;
	return getCached(releaseId);
}

async function setCachedPrice(
	platform: App.Platform | undefined,
	releaseId: number,
	value: CachedPrice
): Promise<void> {
	setCache(releaseId, value);
	await kvPutJSON(platform, `price:${releaseId}`, value, CACHE_TTL_SECONDS);
}

// Serialized rate limiter using a promise chain to prevent race conditions
let rateLimitChain = Promise.resolve();
const MIN_DELAY_MS = 1100; // ~54 req/min, safely under Discogs' 60/min limit

async function rateLimitedFetch(url: string, headers: Record<string, string>): Promise<Response> {
	let resolve!: (value: Response) => void;
	let reject!: (reason: unknown) => void;
	const result = new Promise<Response>((res, rej) => { resolve = res; reject = rej; });

	rateLimitChain = rateLimitChain.then(async () => {
		try {
			await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
			let response = await fetch(url, { headers });
			// Retry transient 429s (unlike before, where a 429 silently yielded null).
			let retries = 0;
			while (response.status === 429 && retries < 2) {
				const retryAfter = response.headers.get('Retry-After');
				const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : MIN_DELAY_MS * (retries + 1);
				await new Promise((r) => setTimeout(r, wait));
				response = await fetch(url, { headers });
				retries++;
			}
			resolve(response);
		} catch (e) {
			reject(e);
		}
	});

	return result;
}

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
		.slice(0, 50);

	if (ids.length === 0) {
		throw error(400, 'releaseIds must contain at least one valid release id');
	}

	// Resolve the token the same way /api/collection does: the caller's own
	// cookie token first, so an authenticated user's quota is used rather than
	// the server env token (which is only a last-resort fallback).
	const token =
		cookies?.get('discogs_token') || request.headers.get('x-discogs-token') || env.DISCOGS_TOKEN || '';
	if (!token) {
		throw error(401, 'Discogs token required for marketplace data');
	}

	const headers: Record<string, string> = {
		'User-Agent': USER_AGENT,
		'Authorization': `Discogs token=${token}`,
		'Accept': 'application/vnd.discogs.v2.discogs+json'
	};

	const results: Array<{ releaseId: number; lowestPrice: number | null; currency: string }> = [];
	let failedCount = 0; // requests that errored (auth/rate-limit/network), distinct from "no data"
	const now = Date.now();

	for (const releaseId of ids) {
		// Check cache first (KV, then in-memory)
		const cached = await getCachedPrice(platform, releaseId);
		if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
			results.push({ releaseId, lowestPrice: cached.lowestPrice, currency: cached.currency });
			continue;
		}

		try {
			const response = await rateLimitedFetch(
				`https://api.discogs.com/marketplace/price_suggestions/${releaseId}`,
				headers
			);

			if (response.ok) {
				const data: PriceSuggestion = await response.json();
				const vgPlus = data['Very Good Plus (VG+)'];
				const nearMint = data['Near Mint (NM or M-)'];
				const ref = nearMint || vgPlus;

				const result = {
					releaseId,
					lowestPrice: ref?.value ?? null,
					currency: ref?.currency ?? 'USD'
				};
				results.push(result);
				await setCachedPrice(platform, releaseId, {
					lowestPrice: result.lowestPrice,
					currency: result.currency,
					timestamp: Date.now()
				});
			} else {
				failedCount++;
				results.push({ releaseId, lowestPrice: null, currency: 'USD' });
			}
		} catch {
			failedCount++;
			results.push({ releaseId, lowestPrice: null, currency: 'USD' });
		}
	}

	const totalValue = results.reduce((sum, r) => sum + (r.lowestPrice || 0), 0);
	const pricedCount = results.filter(r => r.lowestPrice !== null).length;
	const currency = results.find(r => r.currency)?.currency || 'USD';

	return json({
		totalValue,
		pricedCount,
		totalRequested: ids.length,
		// How many price lookups errored (so the client can flag an incomplete estimate
		// rather than presenting a confidently-wrong total).
		failedCount,
		currency,
		results
	});
};
