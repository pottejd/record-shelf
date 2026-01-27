import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchFullUserCollection, DiscogsAPIError } from '$lib/api/discogs';
import type { CachedCollection } from '$lib/types/discogs';
import { env } from '$env/dynamic/private';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const USER_AGENT = 'RecordShelf/0.1.0 +https://github.com/record-shelf/record-shelf';

export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const { username } = params;

	if (!username) {
		throw error(400, 'Username is required');
	}

	// Get token from cookie first, then fall back to env var
	const cookieToken = cookies.get('discogs_token');
	const token = cookieToken || env.DISCOGS_TOKEN;

	if (!token) {
		// Redirect to settings if no token is available
		throw redirect(303, `/settings?redirect=/u/${encodeURIComponent(username)}`);
	}

	const cacheKey = `collection:${username.toLowerCase()}`;

	// Try cache first
	if (platform?.env?.COLLECTION_CACHE) {
		try {
			const cached = await platform.env.COLLECTION_CACHE.get(cacheKey, 'json');
			if (cached) {
				const cachedData = cached as CachedCollection;
				if (Date.now() < cachedData.expiresAt) {
					return {
						collection: cachedData.data,
						cached: true,
						cachedAt: cachedData.cachedAt
					};
				}
			}
		} catch (e) {
			console.error('Cache read error:', e);
		}
	}

	// Fetch fresh
	try {
		const collection = await fetchFullUserCollection(username, {
			userAgent: USER_AGENT,
			token
		});

		// Cache it
		if (platform?.env?.COLLECTION_CACHE) {
			const cacheData: CachedCollection = {
				data: collection,
				cachedAt: Date.now(),
				expiresAt: Date.now() + CACHE_TTL
			};

			try {
				await platform.env.COLLECTION_CACHE.put(cacheKey, JSON.stringify(cacheData), {
					expirationTtl: Math.ceil(CACHE_TTL / 1000)
				});
			} catch (e) {
				console.error('Cache write error:', e);
			}
		}

		return {
			collection,
			cached: false
		};
	} catch (e) {
		if (e instanceof DiscogsAPIError) {
			if (e.code === 'NOT_FOUND') {
				throw error(404, {
					message: `User "${username}" not found on Discogs`
				});
			}
			if (e.code === 'PRIVATE') {
				throw error(403, {
					message: `User "${username}" has a private collection`
				});
			}
			if (e.code === 'RATE_LIMITED') {
				throw error(429, {
					message: 'Rate limited by Discogs. Please try again in a minute.'
				});
			}
			throw error(e.status, { message: e.message });
		}
		console.error('Unexpected error:', e);
		throw error(500, { message: 'An unexpected error occurred' });
	}
};
