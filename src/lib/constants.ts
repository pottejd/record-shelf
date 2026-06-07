export const USER_AGENT = 'RecordShelf/0.10.0 +https://github.com/pottejd/record-shelf';

export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds (soft expiry — data considered fresh)
export const CACHE_TTL_SECONDS = Math.ceil(CACHE_TTL_MS / 1000); // 1 hour in seconds (for KV)

// Stale-while-revalidate window: entries physically persist this long in KV so a
// soft-expired collection can still be served (stale) while a fresh copy is fetched.
export const CACHE_STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const CACHE_STALE_TTL_SECONDS = Math.ceil(CACHE_STALE_TTL_MS / 1000); // 24 hours in seconds (for KV)

// Similarity-score buckets for the head-to-head compare page.
export const SIMILARITY_THRESHOLDS = {
	TASTE_TWINS: 30,
	SIMILAR: 15,
	SOME_OVERLAP: 5
} as const;

// Max entries shown in chart breakdowns.
export const CHART_LIMITS = {
	TOP_GENRES: 8,
	TOP_STYLES: 12
} as const;

// Collection-size tiers for the profile "size" badge.
export const BADGE_SIZE_THRESHOLDS = {
	HOARDER: 1000,
	SERIOUS: 500,
	GROWING: 100,
	STARTED: 25
} as const;

// Top artists/labels/styles computed into collection stats.
export const TOP_LIST_LIMIT = 20;

// Size of cover-grid preview rows (recently added, top rated, random highlights).
export const GRID_PREVIEW_LIMIT = 12;

// Overlap records previewed on the compare page.
export const SHARED_RECORDS_PREVIEW = 30;

// Unique-to-each-user records previewed on the compare page.
export const UNIQUE_RECORDS_PREVIEW = 20;

// Shared artists listed on the compare page.
export const SHARED_ARTISTS_PREVIEW = 10;

// Genre rows shown in the compare page's genre-overlap chart.
export const GENRE_OVERLAP_LIMIT = 10;

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
