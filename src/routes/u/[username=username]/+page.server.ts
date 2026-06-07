import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchFullUserCollection, DiscogsAPIError } from '$lib/api/discogs';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';
import { readCache, writeCache } from '$lib/server/cache';

export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const { username } = params;

	if (!username) {
		throw error(400, 'Username is required');
	}

	// Get token from cookie first, then fall back to env var
	const cookieToken = cookies.get('discogs_token');
	const token = cookieToken || env.DISCOGS_TOKEN;

	if (!token) {
		throw redirect(303, `/settings?redirect=/u/${encodeURIComponent(username)}`);
	}

	// Try cache first
	const cached = await readCache(platform, username);
	if (cached) {
		// Stale-while-revalidate: serve the cached copy immediately, and if it's
		// past its freshness window kick off a background refresh so the next visit
		// is fresh (mirrors /api/collection's SWR behaviour).
		if (cached.stale && platform?.context?.waitUntil) {
			platform.context.waitUntil(
				fetchFullUserCollection(username, { userAgent: USER_AGENT, token })
					.then((full) => writeCache(platform, username, full))
					.catch((err) => console.error('Background stale-cache refresh failed:', err))
			);
		}
		return {
			collection: cached.data,
			cached: true,
			cachedAt: cached.cachedAt
		};
	}

	// Fetch fresh — only first page for fast initial render
	try {
		const collection = await fetchFullUserCollection(username, {
			userAgent: USER_AGENT,
			token
		}, 1);

		if (collection.items.length >= collection.totalDiscogsItems) {
			// Complete on the first page — cache it synchronously.
			await writeCache(platform, username, collection);
		} else if (platform?.context?.waitUntil) {
			// Large collection: the first page is enough to render now, but fetch the
			// remaining pages in the background and cache the full set so the next
			// visit is a cache hit instead of re-fetching everything from Discogs.
			platform.context.waitUntil(
				fetchFullUserCollection(username, { userAgent: USER_AGENT, token })
					.then((full) => writeCache(platform, username, full))
					.catch((err) => console.error('Background full-collection cache failed:', err))
			);
		}

		return {
			collection,
			cached: false
		};
	} catch (e) {
		if (e instanceof DiscogsAPIError) {
			if (e.code === 'BAD_TOKEN') {
				throw redirect(303, `/settings?redirect=/u/${encodeURIComponent(username)}`);
			}
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
