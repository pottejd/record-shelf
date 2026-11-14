import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { DiscogsCollectionItem } from '$lib/types/discogs';
import type { StoredInitial } from '$lib/sync/types';
import { readStored } from '$lib/server/sync';
import { getStore } from '$lib/server/store';

// Reads only the two stored copies: the browser fetches the records through the
// sync API and computes the comparison itself.
export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const { user1, user2 } = params;
	if (!cookies.get('discogs_token')) {
		throw redirect(303, `/settings?redirect=/compare/${encodeURIComponent(user1)}/${encodeURIComponent(user2)}`);
	}
	const store = getStore(platform);
	const read = async (username: string) => ({
		username,
		stored: (await readStored('collection', username, store, Date.now())) as StoredInitial<DiscogsCollectionItem> | null
	});
	const [first, second] = await Promise.all([read(user1), read(user2)]);
	return { user1: first, user2: second };
};
