import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getStore } from '$lib/server/store';
import { metaKey } from '$lib/server/sync';
import type { SnapshotMeta } from '$lib/sync/types';

// Public, cacheable, embeddable from any dashboard.
const RESPONSE_HEADERS = {
	'cache-control': 'public, max-age=300',
	'access-control-allow-origin': '*'
};

type WidgetItem = { label: string; value: string; type: string };

/** `updatedAt` is when the data was fetched: the stored copy's completion time. */
function body(origin: string, items: WidgetItem[], updatedAt: number) {
	return {
		appName: 'Record Shelf',
		icon: '🎵',
		url: origin,
		items,
		updatedAt: new Date(updatedAt).toISOString()
	};
}

// Reads the stored copy only: no Discogs call, no store write.
export const GET: RequestHandler = async ({ platform, url }) => {
	const username = env.WIDGET_USERNAME || 'pottejd';
	const meta = await getStore(platform).getJSON<SnapshotMeta>(metaKey('collection', username));

	if (!meta?.current) {
		return json(body(url.origin, [{ label: 'Status', value: 'Not loaded yet', type: 'secondary' }], Date.now()), {
			headers: RESPONSE_HEADERS
		});
	}

	const items: WidgetItem[] = [
		{ label: 'Collection', value: `${meta.current.totalItems} records`, type: 'highlight' }
	];
	for (const r of meta.recent.slice(0, 3)) {
		items.push({ label: 'Recent', value: `${r.artist} - ${r.title}`, type: 'secondary' });
	}
	// A current snapshot is always completed; the fallback only satisfies the type.
	return json(body(url.origin, items, meta.current.completedAt ?? Date.now()), { headers: RESPONSE_HEADERS });
};
