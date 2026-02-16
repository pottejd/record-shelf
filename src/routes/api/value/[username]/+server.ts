import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';

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

// Serialized rate limiter using a promise chain to prevent race conditions
let rateLimitChain = Promise.resolve();
const MIN_DELAY_MS = 1100; // ~54 req/min, safely under Discogs' 60/min limit

async function rateLimitedFetch(url: string, headers: Record<string, string>): Promise<Response> {
	let resolve!: (value: Response) => void;
	let reject!: (reason: unknown) => void;
	const result = new Promise<Response>((res, rej) => { resolve = res; reject = rej; });

	rateLimitChain = rateLimitChain.then(async () => {
		await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
		try {
			resolve(await fetch(url, { headers }));
		} catch (e) {
			reject(e);
		}
	});

	return result;
}

export const POST: RequestHandler = async ({ params, request }) => {
	const { username } = params;
	if (!username) throw error(400, 'Username is required');

	const body = await request.json();
	const releaseIds: number[] = body.releaseIds;

	if (!Array.isArray(releaseIds) || releaseIds.length === 0) {
		throw error(400, 'releaseIds array is required');
	}

	// Limit to prevent abuse
	const ids = releaseIds.slice(0, 50);

	const token = env.DISCOGS_TOKEN || request.headers.get('x-discogs-token') || '';
	if (!token) {
		throw error(401, 'Discogs token required for marketplace data');
	}

	const headers: Record<string, string> = {
		'User-Agent': USER_AGENT,
		'Authorization': `Discogs token=${token}`,
		'Accept': 'application/vnd.discogs.v2.discogs+json'
	};

	const results: Array<{ releaseId: number; lowestPrice: number | null; currency: string }> = [];
	const now = Date.now();

	for (const releaseId of ids) {
		// Check cache first
		const cached = getCached(releaseId);
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
				setCache(releaseId, {
					lowestPrice: result.lowestPrice,
					currency: result.currency,
					timestamp: Date.now()
				});
			} else {
				results.push({ releaseId, lowestPrice: null, currency: 'USD' });
			}
		} catch {
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
		currency,
		results
	});
};
