import { error, redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { fetchUserProfile, fetchUserWantlist, DiscogsAPIError } from '$lib/api/discogs';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';

export const load = async ({ params, cookies }: ServerLoadEvent) => {
	const { username } = params;

	if (!username) {
		throw error(400, 'Username is required');
	}

	const cookieToken = cookies.get('discogs_token');
	const token = cookieToken || env.DISCOGS_TOKEN;

	if (!token) {
		throw redirect(303, `/settings?redirect=/u/${encodeURIComponent(username)}/wantlist`);
	}

	try {
		const [profile, wantlist] = await Promise.all([
			fetchUserProfile(username, { userAgent: USER_AGENT, token }),
			fetchUserWantlist(username, { userAgent: USER_AGENT, token })
		]);

		return {
			profile,
			wantlist
		};
	} catch (e) {
		if (e instanceof DiscogsAPIError) {
			if (e.code === 'NOT_FOUND') {
				throw error(404, { message: `User "${username}" not found on Discogs` });
			}
			if (e.code === 'RATE_LIMITED') {
				throw error(429, { message: 'Rate limited by Discogs. Please try again in a minute.' });
			}
			throw error(e.status, { message: e.message });
		}
		console.error('Unexpected error:', e);
		throw error(500, { message: 'An unexpected error occurred' });
	}
};
