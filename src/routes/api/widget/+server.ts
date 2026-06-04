import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCollectionPage, fetchUserProfile, DiscogsAPIError } from '$lib/api/discogs';
import { cleanArtistName } from '$lib/utils/discogs';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';

const WIDGET_USERNAME = 'pottejd';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedWidget: { data: unknown; fetchedAt: number } | null = null;

export const GET: RequestHandler = async () => {
	if (cachedWidget && Date.now() - cachedWidget.fetchedAt < CACHE_TTL) {
		return json(cachedWidget.data);
	}

	const token = env.DISCOGS_TOKEN;
	if (!token) {
		return json({
			appName: 'Record Shelf',
			icon: '🎵',
			url: 'https://records.home',
			items: [{ label: 'Status', value: 'Token not configured', type: 'secondary' }],
			updatedAt: new Date().toISOString()
		});
	}

	try {
		const options = { userAgent: USER_AGENT, token };

		const [profile, firstPage] = await Promise.all([
			fetchUserProfile(WIDGET_USERNAME, options),
			fetchCollectionPage(WIDGET_USERNAME, 1, options)
		]);

		const items: Array<{ label: string; value: string; type: string }> = [
			{ label: 'Collection', value: `${profile.num_collection} records`, type: 'highlight' }
		];

		const recent = firstPage.items.slice(0, 3);
		for (const item of recent) {
			const artist =
				cleanArtistName(item.basic_information.artists?.[0]?.name ?? '') || 'Unknown';
			items.push({
				label: 'Recent',
				value: `${artist} - ${item.basic_information.title}`,
				type: 'secondary'
			});
		}

		const response = {
			appName: 'Record Shelf',
			icon: '🎵',
			url: 'https://records.home',
			items,
			updatedAt: new Date().toISOString()
		};

		cachedWidget = { data: response, fetchedAt: Date.now() };
		return json(response);
	} catch (e) {
		const msg = e instanceof DiscogsAPIError ? e.message : 'Unable to fetch';
		return json({
			appName: 'Record Shelf',
			icon: '🎵',
			url: 'https://records.home',
			items: [{ label: 'Status', value: msg, type: 'secondary' }],
			updatedAt: new Date().toISOString()
		});
	}
};
