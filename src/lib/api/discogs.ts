import type {
	DiscogsCollectionResponse,
	DiscogsCollectionItem,
	DiscogsPagination,
	DiscogsUserProfile,
	DiscogsWantlistResponse,
	CollectionStats
} from '$lib/types/discogs';
import { TOP_LIST_LIMIT, GRID_PREVIEW_LIMIT } from '$lib/constants';
import { cleanArtistName } from '$lib/utils/discogs';
import { DEFAULT_RETRY_AFTER_MS, type SyncKind } from '$lib/sync/types';

const DISCOGS_API_BASE = 'https://api.discogs.com';

export class DiscogsAPIError extends Error {
	constructor(
		message: string,
		public status: number,
		public code?: string,
		public retryAfterMs?: number
	) {
		super(message);
		this.name = 'DiscogsAPIError';
	}
}

interface FetchOptions {
	userAgent: string;
	token?: string;
}

export interface DiscogsResult<T> {
	data: T;
	remaining: number | null;
}

export interface ListPage {
	items: unknown[];
	pagination: DiscogsPagination;
}

let lastRemaining: number | null = null;
let lastReadingAt: number | null = null;
let last429At: number | null = null;

export function lastRateReading(): {
	remaining: number | null;
	at: number | null;
	last429At: number | null;
} {
	return { remaining: lastRemaining, at: lastReadingAt, last429At };
}

/**
 * Makes exactly one request to Discogs. Never sleeps or retries: a 429 throws
 * RATE_LIMITED immediately with the server's suggested wait in retryAfterMs.
 */
export async function discogsGet<T>(
	endpoint: string,
	options: FetchOptions
): Promise<DiscogsResult<T>> {
	const headers: Record<string, string> = {
		'User-Agent': options.userAgent,
		Accept: 'application/vnd.discogs.v2.discogs+json'
	};
	if (options.token) {
		headers['Authorization'] = `Discogs token=${options.token}`;
	}

	const response = await fetch(`${DISCOGS_API_BASE}${endpoint}`, { headers });

	const header = response.headers.get('X-Discogs-Ratelimit-Remaining');
	const parsed = header === null ? NaN : parseInt(header, 10);
	const remaining = Number.isFinite(parsed) ? parsed : null;
	lastRemaining = remaining;
	lastReadingAt = Date.now();

	if (response.ok) {
		try {
			return { data: (await response.json()) as T, remaining };
		} catch {
			throw new DiscogsAPIError('Invalid response from Discogs', 502, 'BAD_RESPONSE');
		}
	}

	if (response.status === 401) {
		throw new DiscogsAPIError('Invalid or expired Discogs token', 401, 'BAD_TOKEN');
	}
	if (response.status === 404) {
		throw new DiscogsAPIError('User not found', 404, 'NOT_FOUND');
	}
	if (response.status === 403) {
		throw new DiscogsAPIError('Collection is private', 403, 'PRIVATE');
	}
	if (response.status === 429) {
		last429At = Date.now();
		// Retry-After may be a non-numeric HTTP-date; fall back to the default.
		const retryAfter = parseInt(response.headers.get('Retry-After') ?? '', 10);
		const retryAfterMs =
			Number.isFinite(retryAfter) && retryAfter >= 0
				? retryAfter * 1000
				: DEFAULT_RETRY_AFTER_MS;
		throw new DiscogsAPIError(
			'Rate limited - please try again later',
			429,
			'RATE_LIMITED',
			retryAfterMs
		);
	}

	console.error(`Unexpected Discogs API response: ${response.status} ${response.statusText}`);
	throw new DiscogsAPIError('Discogs API request failed', 502, 'UPSTREAM_ERROR');
}

export function fetchProfile(
	username: string,
	options: FetchOptions
): Promise<DiscogsResult<DiscogsUserProfile>> {
	return discogsGet<DiscogsUserProfile>(`/users/${encodeURIComponent(username)}`, options);
}

export async function fetchListPage(
	kind: SyncKind,
	username: string,
	page: number,
	perPage: number,
	options: FetchOptions
): Promise<DiscogsResult<ListPage>> {
	const user = encodeURIComponent(username);
	const query = `page=${page}&per_page=${perPage}&sort=added&sort_order=desc`;
	if (kind === 'collection') {
		const r = await discogsGet<DiscogsCollectionResponse>(
			`/users/${user}/collection/folders/0/releases?${query}`,
			options
		);
		return {
			data: { items: r.data.releases, pagination: r.data.pagination },
			remaining: r.remaining
		};
	}
	const r = await discogsGet<DiscogsWantlistResponse>(`/users/${user}/wants?${query}`, options);
	return {
		data: { items: r.data.wants, pagination: r.data.pagination },
		remaining: r.remaining
	};
}

export function computeCollectionStats(items: DiscogsCollectionItem[]): CollectionStats {
	const formatCounts: Record<string, number> = {};
	const formatDetailCounts: Record<string, number> = {};
	const genreCounts: Record<string, number> = {};
	const styleCounts: Record<string, number> = {};
	const decadeCounts: Record<string, number> = {};
	const yearCounts: Record<number, number> = {};
	const artistCounts: Record<string, number> = {};
	const labelCounts: Record<string, number> = {};
	const addedByMonthMap: Record<string, number> = {};

	const years: number[] = [];
	let oldestRelease: DiscogsCollectionItem['basic_information'] | null = null;
	let newestRelease: DiscogsCollectionItem['basic_information'] | null = null;

	const ratingBreakdown: Record<number, number> = {};
	let ratingSum = 0;
	let ratedCount = 0;

	for (const item of items) {
		const info = item.basic_information;

		// Track when items were added (by month), skipping unparseable dates so we
		// don't emit a "NaN-NaN" bucket into the activity timeline.
		const addedDate = new Date(item.date_added);
		if (!Number.isNaN(addedDate.getTime())) {
			const monthKey = `${addedDate.getFullYear()}-${String(addedDate.getMonth() + 1).padStart(2, '0')}`;
			addedByMonthMap[monthKey] = (addedByMonthMap[monthKey] || 0) + 1;
		}

		// Formats (main type)
		for (const format of info.formats) {
			const formatName = format.name;
			formatCounts[formatName] = (formatCounts[formatName] || 0) + 1;

			// Detailed format (e.g., "LP, Album" or "7", Single")
			if (format.descriptions && format.descriptions.length > 0) {
				const detailName = `${formatName} (${format.descriptions.slice(0, 2).join(', ')})`;
				formatDetailCounts[detailName] = (formatDetailCounts[detailName] || 0) + 1;
			} else {
				formatDetailCounts[formatName] = (formatDetailCounts[formatName] || 0) + 1;
			}
		}

		// Genres
		for (const genre of info.genres || []) {
			genreCounts[genre] = (genreCounts[genre] || 0) + 1;
		}

		// Styles
		for (const style of info.styles || []) {
			styleCounts[style] = (styleCounts[style] || 0) + 1;
		}

		// Years and decades
		if (info.year && info.year > 0) {
			const decade = Math.floor(info.year / 10) * 10;
			decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
			yearCounts[info.year] = (yearCounts[info.year] || 0) + 1;
			years.push(info.year);

			if (!oldestRelease || info.year < oldestRelease.year) {
				oldestRelease = info;
			}
			if (!newestRelease || info.year > newestRelease.year) {
				newestRelease = info;
			}
		}

		// Artists
		for (const artist of info.artists || []) {
			const name = cleanArtistName(artist.name);
			artistCounts[name] = (artistCounts[name] || 0) + 1;
		}

		// Labels
		for (const label of info.labels || []) {
			const name = label.name;
			if (name && name !== 'Not On Label') {
				labelCounts[name] = (labelCounts[name] || 0) + 1;
			}
		}

		// Ratings
		if (item.rating > 0) {
			ratingBreakdown[item.rating] = (ratingBreakdown[item.rating] || 0) + 1;
			ratingSum += item.rating;
			ratedCount++;
		}
	}

	// Sort and get top items
	const sortByCount = (obj: Record<string, number>) =>
		Object.entries(obj)
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));

	const topArtists = sortByCount(artistCounts).slice(0, TOP_LIST_LIMIT);
	const topLabels = sortByCount(labelCounts).slice(0, TOP_LIST_LIMIT);
	const topStyles = sortByCount(styleCounts).slice(0, TOP_LIST_LIMIT);

	// Recently added (already sorted by API)
	const recentlyAdded = items.slice(0, GRID_PREVIEW_LIMIT);

	// Added by month (last 12 months)
	const addedByMonth = Object.entries(addedByMonthMap)
		.sort((a, b) => a[0].localeCompare(b[0]))
		.slice(-12)
		.map(([date, count]) => ({ date, count }));

	// Calculate median year (true median: average the two middle values when even)
	const sortedYears = [...years].sort((a, b) => a - b);
	const mid = Math.floor(sortedYears.length / 2);
	const medianYear =
		sortedYears.length === 0
			? 0
			: sortedYears.length % 2 === 0
				? Math.round((sortedYears[mid - 1] + sortedYears[mid]) / 2)
				: sortedYears[mid];

	// Calculate average year
	const averageYear = years.length > 0
		? Math.round(years.reduce((a, b) => a + b, 0) / years.length)
		: 0;

	// Collection span (oldest to newest)
	const collectionSpan = oldestRelease && newestRelease
		? newestRelease.year - oldestRelease.year
		: 0;

	// Dominant decade
	const dominantDecade = Object.entries(decadeCounts)
		.sort((a, b) => b[1] - a[1])[0]?.[0] || '';

	// Dominant genre
	const dominantGenre = Object.entries(genreCounts)
		.sort((a, b) => b[1] - a[1])[0]?.[0] || '';

	// Artist diversity ratio (unique artists / total items)
	const uniqueArtistRatio = items.length > 0
		? Object.keys(artistCounts).length / items.length
		: 0;

	// Rating stats (accumulated in the main loop above)
	const averageRating = ratedCount > 0 ? ratingSum / ratedCount : 0;
	const topRatedItems = items
		.filter(i => i.rating >= 4)
		.sort((a, b) => b.rating - a.rating || a.basic_information.title.localeCompare(b.basic_information.title))
		.slice(0, GRID_PREVIEW_LIMIT);

	return {
		totalItems: items.length,
		totalArtists: Object.keys(artistCounts).length,
		totalLabels: Object.keys(labelCounts).length,
		formatBreakdown: formatCounts,
		formatDetailBreakdown: formatDetailCounts,
		genreBreakdown: genreCounts,
		styleBreakdown: styleCounts,
		decadeBreakdown: decadeCounts,
		yearBreakdown: yearCounts,
		topArtists,
		topLabels,
		topStyles,
		recentlyAdded,
		addedByMonth,
		oldestRelease,
		newestRelease,
		averageYear,
		medianYear,
		uniqueArtistRatio,
		collectionSpan,
		dominantDecade: dominantDecade ? `${dominantDecade}s` : '',
		dominantGenre,
		ratingBreakdown,
		averageRating,
		ratedCount,
		topRatedItems
	};
}
