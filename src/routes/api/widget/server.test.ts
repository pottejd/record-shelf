import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import { GET } from './+server';
import { getStore, resetMemoryStoreForTests } from '$lib/server/store';
import { metaKey } from '$lib/server/sync';

const event = () => ({ platform: undefined, url: new URL('https://shelf.example/api/widget') }) as any;

beforeEach(() => { resetMemoryStoreForTests(); vi.clearAllMocks(); for (const k of Object.keys(mockEnv)) delete mockEnv[k]; mockEnv.DISCOGS_TOKEN = 'must-be-ignored'; });

describe('widget endpoint', () => {
	it('builds from the stored meta with no Discogs call and no store write', async () => {
		const store = getStore(undefined);
		await store.putJSON(metaKey('collection', 'pottejd'), {
			profile: {}, pending: null,
			current: { id: '1', totalItems: 1234, totalPages: 13, startedAt: 1, completedAt: 2 },
			recent: [{ artist: 'A', title: 'One' }, { artist: 'B', title: 'Two' }, { artist: 'C', title: 'Three' }]
		}, 60);
		const put = vi.spyOn(store, 'putJSON');
		const res = await GET(event());
		const body = await res.json();
		expect(body.items).toEqual([
			{ label: 'Collection', value: '1234 records', type: 'highlight' },
			{ label: 'Recent', value: 'A - One', type: 'secondary' },
			{ label: 'Recent', value: 'B - Two', type: 'secondary' },
			{ label: 'Recent', value: 'C - Three', type: 'secondary' }
		]);
		expect(body.url).toBe('https://shelf.example');
		expect(res.headers.get('access-control-allow-origin')).toBe('*');
		expect(res.headers.get('cache-control')).toBe('public, max-age=300');
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(put).not.toHaveBeenCalled();
	});
	it('says "Not loaded yet" when nothing is stored, still without calling Discogs', async () => {
		const body = await (await GET(event())).json();
		expect(body.items).toEqual([{ label: 'Status', value: 'Not loaded yet', type: 'secondary' }]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
	it('uses WIDGET_USERNAME when set', async () => {
		mockEnv.WIDGET_USERNAME = 'Other';
		await getStore(undefined).putJSON(metaKey('collection', 'other'), { profile: {}, pending: null, recent: [], current: { id: '1', totalItems: 5, totalPages: 1, startedAt: 1, completedAt: 2 } }, 60);
		expect((await (await GET(event())).json()).items[0].value).toBe('5 records');
	});
});
