import { DiscogsAPIError, fetchPriceSuggestions, isBusy, type PriceSuggestions } from '$lib/api/discogs';
import { PRICE_TTL_MS } from '$lib/sync/types';

// The value estimate runs in the visitor's browser: it asks Discogs for each
// sampled release's suggested price with the visitor's token, through the same
// paced queue as every other Discogs call, and remembers the prices in this
// browser for six hours.

export interface PriceResult {
	releaseId: number;
	lowestPrice: number | null;
	currency: string;
}

export interface ValueEstimate {
	totalValue: number;
	pricedCount: number;
	totalRequested: number;
	/** Lookups that failed, as distinct from releases with no marketplace data. */
	failedCount: number;
	currency: string;
	results: PriceResult[];
	/** Discogs became busy part-way: the estimate covers only the releases priced before that. */
	partial: boolean;
}

export interface EstimateDeps {
	getPrices: (releaseId: number, token: string) => Promise<PriceSuggestions>;
	storage: Pick<Storage, 'getItem' | 'setItem'> | null;
	now: () => number;
	onProgress: (done: number, total: number) => void;
}

/** Each release not already remembered costs one paced Discogs call. */
export const MAX_RELEASE_IDS = 20;
export const PRICE_STORAGE_KEY = 'record-shelf-prices';

interface RememberedPrice {
	lowestPrice: number | null;
	currency: string;
	timestamp: number;
}
type Remembered = Record<string, RememberedPrice>;

function browserStorage(): EstimateDeps['storage'] {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

/** The remembered prices still inside their six hours. */
function remembered(storage: EstimateDeps['storage'], now: number): Remembered {
	const kept: Remembered = {};
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(PRICE_STORAGE_KEY) ?? '{}');
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return kept;
		for (const [id, price] of Object.entries(parsed as Remembered)) {
			if (typeof price?.timestamp === 'number' && now - price.timestamp < PRICE_TTL_MS) kept[id] = price;
		}
	} catch {
		// Unreadable storage: start with nothing remembered.
	}
	return kept;
}

export async function estimateValue(
	releaseIds: number[],
	token: string,
	deps: Partial<EstimateDeps> = {}
): Promise<ValueEstimate> {
	const getPrices = deps.getPrices ?? fetchPriceSuggestions;
	const storage = deps.storage === undefined ? browserStorage() : deps.storage;
	const now = deps.now ?? Date.now;
	const ids = releaseIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX_RELEASE_IDS);

	const prices = remembered(storage, now());
	const results: PriceResult[] = [];
	let failedCount = 0;
	let partial = false;

	try {
		for (const releaseId of ids) {
			let price: RememberedPrice | undefined = prices[releaseId];
			if (!price) {
				try {
					const suggested = await getPrices(releaseId, token);
					const ref = suggested['Near Mint (NM or M-)'] || suggested['Very Good Plus (VG+)'];
					price = { lowestPrice: ref?.value ?? null, currency: ref?.currency ?? 'USD', timestamp: now() };
					prices[releaseId] = price;
				} catch (e) {
					if (e instanceof DiscogsAPIError && e.code === 'BAD_TOKEN') {
						// A rejected token fails every call: stop at once rather than spend more.
						throw new Error('Invalid or expired Discogs token');
					}
					if (isBusy(e)) {
						partial = true;
						break;
					}
					failedCount++;
				}
			}
			results.push({ releaseId, lowestPrice: price?.lowestPrice ?? null, currency: price?.currency ?? 'USD' });
			deps.onProgress?.(results.length, ids.length);
		}
	} finally {
		try {
			storage?.setItem(PRICE_STORAGE_KEY, JSON.stringify(prices));
		} catch {
			// Storage full or blocked: the estimate stands, it just is not remembered.
		}
	}

	// Sum only prices in a single currency so the total is internally consistent:
	// Discogs can answer in different currencies and nothing here converts them.
	// The display currency is the first priced result's.
	const currency = results.find((r) => r.lowestPrice !== null)?.currency || 'USD';
	const priced = results.filter((r) => r.lowestPrice !== null && r.currency === currency);
	return {
		totalValue: priced.reduce((sum, r) => sum + (r.lowestPrice || 0), 0),
		pricedCount: priced.length,
		totalRequested: ids.length,
		failedCount,
		currency,
		results,
		partial
	};
}
