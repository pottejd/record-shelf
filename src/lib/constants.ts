export const USER_AGENT = 'RecordShelf/0.8.0 +https://github.com/pottejd/record-shelf';

export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds (soft expiry — data considered fresh)
export const CACHE_TTL_SECONDS = Math.ceil(CACHE_TTL_MS / 1000); // 1 hour in seconds (for KV)

// Stale-while-revalidate window: entries physically persist this long in KV so a
// soft-expired collection can still be served (stale) while a fresh copy is fetched.
export const CACHE_STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const CACHE_STALE_TTL_SECONDS = Math.ceil(CACHE_STALE_TTL_MS / 1000); // 24 hours in seconds (for KV)

export const GENRE_COLORS: Record<string, string> = {
	Rock: '#e11d48',
	Electronic: '#8b5cf6',
	Jazz: '#f59e0b',
	'Hip Hop': '#10b981',
	Pop: '#ec4899',
	Classical: '#6366f1',
	Soul: '#f97316',
	'Funk / Soul': '#f97316',
	Funk: '#eab308',
	Reggae: '#22c55e',
	Blues: '#3b82f6',
	'Folk, World, & Country': '#84cc16',
	Latin: '#14b8a6',
	'Stage & Screen': '#a855f7',
	'Non-Music': '#64748b'
};

export function getGenreColor(genre: string): string {
	return GENRE_COLORS[genre] || '#6b7280';
}
