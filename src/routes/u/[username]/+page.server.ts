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
		return {
			collection: cached.data,
			cached: true,
			cachedAt: cached.cachedAt
		};
	}

	// Fetch fresh
	try {
		const collection = await fetchFullUserCollection(username, {
			userAgent: USER_AGENT,
			token
		});

		await writeCache(platform, username, collection);

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
