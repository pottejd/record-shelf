import type { DiscogsCollectionItem } from '$lib/types/discogs';
import { cleanArtistName } from './discogs';

/**
 * A stable key identifying the "same album" across copies/pressings:
 * the Discogs master id when available, else normalized artist + title.
 */
export function getAlbumKey(item: DiscogsCollectionItem): string {
	const info = item.basic_information;
	if (info.master_id) return `master:${info.master_id}`;
	const title = info.title.toLowerCase().trim();
	const artist = cleanArtistName(info.artists?.[0]?.name ?? '')
		.toLowerCase()
		.trim();
	return `title:${artist}:${title}`;
}

export interface AlbumGroup {
	key: string;
	items: DiscogsCollectionItem[];
}

/** Groups collection items by album identity (see getAlbumKey). */
export function groupAlbums(items: DiscogsCollectionItem[]): AlbumGroup[] {
	const map = new Map<string, DiscogsCollectionItem[]>();
	for (const item of items) {
		const key = getAlbumKey(item);
		const existing = map.get(key);
		if (existing) existing.push(item);
		else map.set(key, [item]);
	}
	return [...map.entries()].map(([key, groupItems]) => ({ key, items: groupItems }));
}

/** Album groups the collection holds more than one copy/variant of. */
export function findDuplicates(items: DiscogsCollectionItem[]): AlbumGroup[] {
	return groupAlbums(items).filter((group) => group.items.length > 1);
}
