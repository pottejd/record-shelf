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
