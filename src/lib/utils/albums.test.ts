import { describe, it, expect } from 'vitest';
import { getAlbumKey, groupAlbums, findDuplicates } from './albums';
import type { DiscogsCollectionItem } from '$lib/types/discogs';

function item(overrides: {
	id?: number;
	instance_id?: number;
	master_id?: number;
	title?: string;
	artist?: string;
	formats?: string[];
}): DiscogsCollectionItem {
	const { id = 1, instance_id = id, master_id, title = 'Album', artist = 'Artist', formats = ['Vinyl'] } =
		overrides;
	return {
		id,
		instance_id,
		folder_id: 1,
		rating: 0,
		date_added: '2024-01-01T00:00:00-00:00',
		basic_information: {
			id,
			master_id,
			title,
			year: 2000,
			thumb: '',
			resource_url: '',
			artists: [{ id: 1, name: artist, resource_url: '' }],
			labels: [],
			formats: formats.map((name) => ({ name, qty: '1' })),
			genres: [],
			styles: []
		}
	} as DiscogsCollectionItem;
}

describe('getAlbumKey', () => {
	it('uses master_id when present', () => {
		expect(getAlbumKey(item({ master_id: 42 }))).toBe('master:42');
	});

	it('falls back to normalized artist + title (case/whitespace-insensitive)', () => {
		const a = getAlbumKey(item({ title: '  Kid A ', artist: 'Radiohead' }));
		const b = getAlbumKey(item({ title: 'kid a', artist: 'radiohead' }));
		expect(a).toBe(b);
	});

	it('strips disambiguation from the artist in the key', () => {
		expect(getAlbumKey(item({ title: 'X', artist: 'Nirvana (2)' }))).toBe(
			getAlbumKey(item({ title: 'X', artist: 'Nirvana' }))
		);
	});
});

describe('groupAlbums / findDuplicates', () => {
	it('groups items that share an album key', () => {
		const items = [
			item({ id: 1, master_id: 7 }),
			item({ id: 2, master_id: 7 }),
			item({ id: 3, master_id: 9 })
		];
		const groups = groupAlbums(items);
		expect(groups).toHaveLength(2);
	});

	it('findDuplicates returns only groups with more than one item', () => {
		const items = [
			item({ id: 1, master_id: 7 }), // dup
			item({ id: 2, master_id: 7 }), // dup
			item({ id: 3, master_id: 9 }) // single
		];
		const dups = findDuplicates(items);
		expect(dups).toHaveLength(1);
		expect(dups[0].items).toHaveLength(2);
	});

	it('treats a master and a title-keyed item as different albums', () => {
		const items = [item({ id: 1, master_id: 7, title: 'A' }), item({ id: 2, title: 'A' })];
		expect(findDuplicates(items)).toHaveLength(0);
	});
});
