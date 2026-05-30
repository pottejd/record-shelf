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
