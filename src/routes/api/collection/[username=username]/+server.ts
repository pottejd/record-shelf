import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchFullUserCollection, fetchCollectionPage, DiscogsAPIError } from '$lib/api/discogs';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';
import { readCache, writeCache, invalidateCache } from '$lib/server/cache';

// Responses are cookie-authed, so only browser-private caching is safe (never
// shared/edge caching, which would risk leaking one user's data to another).
const PRIVATE_CACHE = { 'cache-control': 'private, max-age=60' };

export const GET: RequestHandler = async ({ params, platform, cookies, url }) => {
	const { username } = params;

	if (!username) {
		throw error(400, 'Username is required');
	}

	const token = cookies.get('discogs_token') || env.DISCOGS_TOKEN;
	if (!token) {
		throw error(401, 'Discogs token required');
	}

	// Single-page fetch for progressive loading
	const pageParam = url.searchParams.get('page');
	if (pageParam) {
		const page = parseInt(pageParam, 10);
		if (isNaN(page) || page < 1) {
			throw error(400, 'Invalid page number');
		}
		try {
			const result = await fetchCollectionPage(username, page, {
				userAgent: USER_AGENT,
				token
			});
			return json(result, { headers: PRIVATE_CACHE });
		} catch (e) {
			if (e instanceof DiscogsAPIError) {
				if (e.code === 'RATE_LIMITED') {
					throw error(429, 'Rate limited by Discogs API. Please try again in a minute.');
				}
				throw error(e.status, e.message);
			}
			throw error(500, 'Failed to fetch collection page');
		}
	}

	// Full collection fetch (used by cache refresh, etc.)
	// Try cache first
	const cached = await readCache(platform, username);
	if (cached) {
		// Stale-while-revalidate: serve the stale copy now and refresh in the
		// background so the next request is fresh, without blocking this one.
		if (cached.stale && platform?.context?.waitUntil) {
			platform.context.waitUntil(
				fetchFullUserCollection(username, { userAgent: USER_AGENT, token })
					.then((fresh) => writeCache(platform, username, fresh))
					.catch((err) => console.error('Background cache refresh failed:', err))
			);
		}
		return json(
			{
				...cached.data,
				cached: true,
				cachedAt: cached.cachedAt
			},
			{ headers: PRIVATE_CACHE }
		);
	}

	try {
		const collection = await fetchFullUserCollection(username, {
			userAgent: USER_AGENT,
			token
		});

		await writeCache(platform, username, collection);

		return json(
			{
				...collection,
				cached: false
			},
			{ headers: PRIVATE_CACHE }
		);
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

export const DELETE: RequestHandler = async ({ params, platform, cookies }) => {
	const { username } = params;

	if (!username) {
		throw error(400, 'Username is required');
	}

	const token = cookies.get('discogs_token') || env.DISCOGS_TOKEN;
	if (!token) {
		throw error(401, 'Authentication required to invalidate cache');
	}

	await invalidateCache(platform, username);

	return json({ success: true });
};
