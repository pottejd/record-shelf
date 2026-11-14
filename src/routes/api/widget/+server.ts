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

function body(origin: string, items: WidgetItem[]) {
	return {
		appName: 'Record Shelf',
		icon: '🎵',
		url: origin,
		items,
		updatedAt: new Date().toISOString()
	};
}

// Reads the stored copy only: no Discogs call, no store write.
export const GET: RequestHandler = async ({ platform, url }) => {
	const username = env.WIDGET_USERNAME || 'pottejd';
	const meta = await getStore(platform).getJSON<SnapshotMeta>(metaKey('collection', username));

	if (!meta?.current) {
		return json(body(url.origin, [{ label: 'Status', value: 'Not loaded yet', type: 'secondary' }]), {
			headers: RESPONSE_HEADERS
		});
	}

	const items: WidgetItem[] = [
		{ label: 'Collection', value: `${meta.current.totalItems} records`, type: 'highlight' }
	];
	for (const r of meta.recent.slice(0, 3)) {
		items.push({ label: 'Recent', value: `${r.artist} - ${r.title}`, type: 'secondary' });
	}
	return json(body(url.origin, items), { headers: RESPONSE_HEADERS });
};
