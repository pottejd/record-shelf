import type { RequestHandler } from '@sveltejs/kit';
import { version } from '$app/environment';
import { getStore } from '$lib/server/store';
import { fingerprint, writerFingerprints } from '$lib/server/writers';

// The server never calls Discogs, so there is no rate-limit reading to report:
// Discogs calls are made by the visitor's browser and show in its network tab.
//
// `writers` is how many token fingerprints STORE_WRITERS lists. For a visitor
// with a token cookie, `fingerprint` is that token's fingerprint (the value to
// put in STORE_WRITERS; it is one-way, and is shown only to the browser that
// sent the token) and `writer` says whether it is listed.
export const GET: RequestHandler = async ({ platform, cookies }) => {
	const allowed = writerFingerprints();
	const token = cookies.get('discogs_token');
	const mine = token ? await fingerprint(token) : null;
	const body = {
		store: getStore(platform).backend,
		version,
		writers: allowed.length,
		writer: mine !== null && allowed.includes(mine),
		fingerprint: mine
	};
	return new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
	});
};
