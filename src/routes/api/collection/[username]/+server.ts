import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchFullUserCollection, DiscogsAPIError } from '$lib/api/discogs';
import type { CachedCollection } from '$lib/types/discogs';
import { env } from '$env/dynamic/private';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const USER_AGENT = 'RecordShelf/1.0 +https://github.com/record-shelf';

export const GET: RequestHandler = async ({ params, platform }) => {
	const { username } = params;

	if (!username) {
		throw error(400, 'Username is required');
	}

	const cacheKey = `collection:${username.toLowerCase()}`;

	// Try to get from KV cache
	if (platform?.env?.COLLECTION_CACHE) {
		try {
			const cached = await platform.env.COLLECTION_CACHE.get(cacheKey, 'json');
			if (cached) {
				const cachedData = cached as CachedCollection;
				if (Date.now() < cachedData.expiresAt) {
					return json({
						...cachedData.data,
						cached: true,
						cachedAt: cachedData.cachedAt
					});
				}
			}
		} catch (e) {
			console.error('Cache read error:', e);
		}
	}

	// Fetch fresh data from Discogs
	try {
		const token = env.DISCOGS_TOKEN;
		const collection = await fetchFullUserCollection(username, {
			userAgent: USER_AGENT,
			token
		});

		// Store in cache
		if (platform?.env?.COLLECTION_CACHE) {
			const cacheData: CachedCollection = {
				data: collection,
				cachedAt: Date.now(),
				expiresAt: Date.now() + CACHE_TTL
			};

			try {
				await platform.env.COLLECTION_CACHE.put(cacheKey, JSON.stringify(cacheData), {
					expirationTtl: Math.ceil(CACHE_TTL / 1000) // KV uses seconds
				});
			} catch (e) {
				console.error('Cache write error:', e);
			}
		}

		return json({
			...collection,
			cached: false
		});
	} catch (e) {
		if (e instanceof DiscogsAPIError) {
			if (e.code === 'NOT_FOUND') {
				throw error(404, `User "${username}" not found on Discogs`);
			}
			if (e.code === 'PRIVATE') {
				throw error(403, `User "${username}" has a private collection`);
			}
			if (e.code === 'RATE_LIMITED') {
				throw error(429, 'Rate limited by Discogs API. Please try again in a minute.');
			}
			throw error(e.status, e.message);
		}
		console.error('Unexpected error:', e);
		throw error(500, 'An unexpected error occurred');
	}
};
