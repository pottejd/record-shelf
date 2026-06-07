import type { DiscogsCollectionItem } from '$lib/types/discogs';

/**
 * Strips a trailing Discogs disambiguation number from an artist name,
 * e.g. "Nirvana (2)" -> "Nirvana". Leaves all other text untouched.
 */
export function cleanArtistName(name: string): string {
	return name.replace(/\s*\(\d+\)$/, '');
}

/**
 * Formats a list of Discogs artists into a single display string with
 * disambiguation numbers removed, e.g. [{name:'A (2)'},{name:'B'}] -> "A, B".
 */
export function formatArtists(artists: Array<{ name: string }>): string {
	return artists.map((a) => cleanArtistName(a.name)).join(', ');
}

export interface ItemSearchFields {
	title: string;
	artists: string;
	labels: string;
	catno: string;
}

/**
 * Lowercased searchable fields for a collection item. Used to build the
 * CollectionBrowser search index once per item, and as an on-the-fly fallback
 * so an item missing from the index can't silently bypass the query filter.
 */
export function itemSearchFields(item: DiscogsCollectionItem): ItemSearchFields {
	const info = item.basic_information;
	return {
		title: info.title.toLowerCase(),
		artists: info.artists.map((a) => a.name.toLowerCase()).join(' '),
		labels: info.labels?.map((l) => l.name.toLowerCase()).join(' ') || '',
		catno: info.labels?.map((l) => l.catno.toLowerCase()).join(' ') || ''
	};
}
