import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCollectionPage, fetchUserProfile, DiscogsAPIError } from '$lib/api/discogs';
import { cleanArtistName } from '$lib/utils/discogs';
import { kvGetJSON, kvPutJSON } from '$lib/server/cache';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

// Public, cacheable, embeddable from any dashboard.
const RESPONSE_HEADERS = {
	'cache-control': 'public, max-age=300',
	'access-control-allow-origin': '*'
};

function widgetKey(username: string): string {
	return `widget:${username.toLowerCase()}`;
}

function fallback(items: Array<{ label: string; value: string; type: string }>) {
	return {
		appName: 'Record Shelf',
		icon: '🎵',
		url: 'https://records.home',
		items,
		updatedAt: new Date().toISOString()
	};
}

export const GET: RequestHandler = async ({ platform }) => {
	const username = env.WIDGET_USERNAME || 'pottejd';

	// KV-backed cache (shared across isolates, unlike the previous per-isolate Map).
	const cached = await kvGetJSON<unknown>(platform, widgetKey(username));
	if (cached) {
		return json(cached, { headers: RESPONSE_HEADERS });
	}

	const token = env.DISCOGS_TOKEN;
	if (!token) {
		return json(fallback([{ label: 'Status', value: 'Token not configured', type: 'secondary' }]), {
			headers: RESPONSE_HEADERS
		});
	}

	try {
		const options = { userAgent: USER_AGENT, token };
		const [profile, firstPage] = await Promise.all([
			fetchUserProfile(username, options),
			fetchCollectionPage(username, 1, options)
		]);

		const items: Array<{ label: string; value: string; type: string }> = [
			{ label: 'Collection', value: `${profile.num_collection ?? 0} records`, type: 'highlight' }
		];
		for (const item of firstPage.items.slice(0, 3)) {
			const artist = cleanArtistName(item.basic_information.artists?.[0]?.name ?? '') || 'Unknown';
			items.push({
				label: 'Recent',
				value: `${artist} - ${item.basic_information.title}`,
				type: 'secondary'
			});
		}

		const response = fallback(items);
		await kvPutJSON(platform, widgetKey(username), response, CACHE_TTL_SECONDS);
		return json(response, { headers: RESPONSE_HEADERS });
	} catch (e) {
		const msg = e instanceof DiscogsAPIError ? e.message : 'Unable to fetch';
		return json(fallback([{ label: 'Status', value: msg, type: 'secondary' }]), {
			headers: RESPONSE_HEADERS
		});
	}
};
