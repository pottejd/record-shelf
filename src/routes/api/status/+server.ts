import type { RequestHandler } from '@sveltejs/kit';
import { version } from '$app/environment';
import { lastRateReading } from '$lib/api/discogs';
import { getStore } from '$lib/server/store';

export const GET: RequestHandler = ({ platform }) =>
	new Response(
		JSON.stringify({ store: getStore(platform).backend, version, discogs: lastRateReading() }),
		{ headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
	);
