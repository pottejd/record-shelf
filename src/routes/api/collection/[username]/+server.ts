import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchFullUserCollection, DiscogsAPIError } from '$lib/api/discogs';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';
import { readCache, writeCache, invalidateCache } from '$lib/server/cache';

export const GET: RequestHandler = async ({ params, platform }) => {
	const { username } = params;

	if (!username) {
		throw error(400, 'Username is required');
	}

	// Try cache first
	const cached = await readCache(platform, username);
	if (cached) {
		return json({
			...cached.data,
			cached: true,
			cachedAt: cached.cachedAt
		});
	}

	// Fetch fresh data from Discogs
	try {
		const token = env.DISCOGS_TOKEN;
		const collection = await fetchFullUserCollection(username, {
			userAgent: USER_AGENT,
			token
		});

		await writeCache(platform, username, collection);

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

export const DELETE: RequestHandler = async ({ params, platform }) => {
	const { username } = params;

	if (!username) {
		throw error(400, 'Username is required');
	}

	await invalidateCache(platform, username);

	return json({ success: true });
};
