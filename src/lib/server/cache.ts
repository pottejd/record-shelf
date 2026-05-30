import type { CachedCollection, UserCollection } from '$lib/types/discogs';
import { CACHE_TTL_MS, CACHE_STALE_TTL_MS, CACHE_STALE_TTL_SECONDS } from '$lib/constants';

interface KVNamespace {
	get(key: string, type: 'json'): Promise<unknown>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	delete(key: string): Promise<void>;
}

function getCacheStore(platform: App.Platform | undefined): KVNamespace | null {
	return (platform?.env as Record<string, unknown>)?.COLLECTION_CACHE as KVNamespace | null ?? null;
}

/**
 * Generic KV JSON read. Returns null on no-store, miss, or any error so callers
 * can treat the cache as best-effort. Shared by all KV-backed caches.
 */
export async function kvGetJSON<T>(
	platform: App.Platform | undefined,
	key: string
): Promise<T | null> {
	const store = getCacheStore(platform);
	if (!store) return null;

	try {
		const value = await store.get(key, 'json');
		return (value as T) ?? null;
	} catch (e) {
		console.error('KV read error:', e);
		return null;
	}
}

/**
 * Generic KV JSON write with an explicit TTL (seconds). No-ops without a store
 * and swallows errors — caching must never break a request.
 */
export async function kvPutJSON(
	platform: App.Platform | undefined,
	key: string,
	value: unknown,
	ttlSeconds: number
): Promise<void> {
	const store = getCacheStore(platform);
	if (!store) return;

	try {
		await store.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
	} catch (e) {
		console.error('KV write error:', e);
	}
}

function getCacheKey(username: string): string {
	return `collection:${username.toLowerCase()}`;
}

function isValidCachedCollection(value: unknown): value is CachedCollection {
	if (!value || typeof value !== 'object') return false;
	const c = value as Record<string, unknown>;
	if (typeof c.expiresAt !== 'number' || typeof c.cachedAt !== 'number') return false;
	if (!c.data || typeof c.data !== 'object') return false;
	return Array.isArray((c.data as Record<string, unknown>).items);
}

/**
 * Reads a cached collection with stale-while-revalidate semantics:
 * - fresh (now < expiresAt)            → { stale: false }
 * - soft-expired but within staleUntil → { stale: true } (caller may refresh in background)
 * - past the hard limit, or malformed  → null (treated as a miss)
 * Legacy entries without staleUntil are hard-expired at expiresAt.
 */
export async function readCache(
	platform: App.Platform | undefined,
	username: string
): Promise<{ data: UserCollection; cachedAt: number; stale: boolean } | null> {
	const cached = await kvGetJSON<unknown>(platform, getCacheKey(username));
	if (!isValidCachedCollection(cached)) return null;

	const now = Date.now();
	if (now < cached.expiresAt) {
		return { data: cached.data, cachedAt: cached.cachedAt, stale: false };
	}

	const hardLimit = typeof cached.staleUntil === 'number' ? cached.staleUntil : cached.expiresAt;
	if (now < hardLimit) {
		return { data: cached.data, cachedAt: cached.cachedAt, stale: true };
	}

	return null;
}

export async function writeCache(
	platform: App.Platform | undefined,
	username: string,
	collection: UserCollection
): Promise<void> {
	const now = Date.now();
	const cacheData: CachedCollection = {
		data: collection,
		cachedAt: now,
		expiresAt: now + CACHE_TTL_MS,
		staleUntil: now + CACHE_STALE_TTL_MS
	};

	// KV physically retains the entry for the full stale window so soft-expired
	// reads can still be served while a fresh copy is fetched in the background.
	await kvPutJSON(platform, getCacheKey(username), cacheData, CACHE_STALE_TTL_SECONDS);
}

export async function invalidateCache(
	platform: App.Platform | undefined,
	username: string
): Promise<void> {
	const store = getCacheStore(platform);
	if (!store) return;

	try {
		await store.delete(getCacheKey(username));
	} catch (e) {
		console.error('Cache invalidation error:', e);
	}
}
