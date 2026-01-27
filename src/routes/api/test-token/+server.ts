import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const USER_AGENT = 'RecordShelf/0.1.0 +https://github.com/record-shelf/record-shelf';

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

		const data = await response.json();
		return json({ success: true, username: data.username });
	} catch (error) {
		return json({ error: 'Failed to connect to Discogs' }, { status: 500 });
	}
};
