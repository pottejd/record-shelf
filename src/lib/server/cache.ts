import type { CachedCollection } from '$lib/types/discogs';
import type { UserCollection } from '$lib/types/discogs';
import { CACHE_TTL_MS, CACHE_TTL_SECONDS } from '$lib/constants';

interface KVNamespace {
	get(key: string, type: 'json'): Promise<unknown>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	delete(key: string): Promise<void>;
}

function getCacheStore(platform: App.Platform | undefined): KVNamespace | null {
	return (platform?.env as Record<string, unknown>)?.COLLECTION_CACHE as KVNamespace | null ?? null;
}

function getCacheKey(username: string): string {
	return `collection:${username.toLowerCase()}`;
}

export async function readCache(
	platform: App.Platform | undefined,
	username: string
): Promise<{ data: UserCollection; cachedAt: number } | null> {
	const store = getCacheStore(platform);
	if (!store) return null;

	try {
		const cached = await store.get(getCacheKey(username), 'json');
		if (cached) {
			const cachedData = cached as CachedCollection;
			if (Date.now() < cachedData.expiresAt) {
				return { data: cachedData.data, cachedAt: cachedData.cachedAt };
			}
		}
	} catch (e) {
		console.error('Cache read error:', e);
	}

	return null;
}

export async function writeCache(
	platform: App.Platform | undefined,
	username: string,
	collection: UserCollection
): Promise<void> {
	const store = getCacheStore(platform);
	if (!store) return;

	const cacheData: CachedCollection = {
		data: collection,
		cachedAt: Date.now(),
		expiresAt: Date.now() + CACHE_TTL_MS
	};

	try {
		await store.put(getCacheKey(username), JSON.stringify(cacheData), {
			expirationTtl: CACHE_TTL_SECONDS
		});
	} catch (e) {
		console.error('Cache write error:', e);
	}
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
