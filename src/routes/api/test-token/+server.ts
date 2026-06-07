import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { USER_AGENT } from '$lib/constants';

export const POST: RequestHandler = async ({ request }) => {
	const token = request.headers.get('X-Discogs-Token');

	if (!token) {
		return json({ error: 'No token provided' }, { status: 400 });
	}

	try {
		const response = await fetch('https://api.discogs.com/oauth/identity', {
			headers: {
				'Authorization': `Discogs token=${token}`,
				'User-Agent': USER_AGENT
			}
		});

		if (!response.ok) {
			if (response.status === 401) {
				return json({ error: 'Invalid token' }, { status: 401 });
			}
			return json({ error: 'Failed to verify token' }, { status: response.status });
		}

		let data: unknown;
		try {
			data = await response.json();
		} catch {
			return json({ error: 'Unexpected response from Discogs' }, { status: 502 });
		}

		const username =
			data && typeof data === 'object' && typeof (data as { username?: unknown }).username === 'string'
				? (data as { username: string }).username
				: null;

		if (!username) {
			return json({ error: 'Unexpected response from Discogs' }, { status: 502 });
		}

		return json({ success: true, username });
	} catch (error) {
		return json({ error: 'Failed to connect to Discogs' }, { status: 500 });
	}
};
