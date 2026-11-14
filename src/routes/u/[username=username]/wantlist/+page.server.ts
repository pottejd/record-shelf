import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { DiscogsWantlistItem } from '$lib/types/discogs';
import type { StoredInitial } from '$lib/sync/types';
import { readStored } from '$lib/server/sync';
import { getStore } from '$lib/server/store';

// Reads only the stored copy: the browser fetches the records through the sync API.
export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const { username } = params;
	if (!cookies.get('discogs_token')) {
		throw redirect(303, `/settings?redirect=/u/${encodeURIComponent(username)}/wantlist`);
	}
	const stored = (await readStored('wantlist', username, getStore(platform), Date.now())) as
		| StoredInitial<DiscogsWantlistItem>
		| null;
	return { username, stored };
};
