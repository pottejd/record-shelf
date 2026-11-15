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
import { PACE_MS, type SyncKind } from '$lib/sync/types';

// Every Discogs call is made by the visitor's browser, never by the server.
// What a browser can and cannot do here was checked against Discogs on 2026-11-14:
// - a 200, 401, 403 or 404 answer can be read; a 429 cannot (it carries no CORS
//   header), so it looks exactly like a lost connection;
// - the rate-limit and Retry-After headers cannot be read;
// - a token sent as a header costs a preflight for every address, and the
//   preflight counts against the rate limit. A token in the query string does not.

const DISCOGS_API_BASE = 'https://api.discogs.com';

export class DiscogsAPIError extends Error {
	constructor(
		message: string,
		public status: number,
		public code?: string
	) {
		super(message);
		this.name = 'DiscogsAPIError';
	}
}

/** Discogs is rate-limiting, or gave no answer a browser can read: wait and try again. */
export function isBusy(e: unknown): boolean {
	return e instanceof DiscogsAPIError && (e.code === 'RATE_LIMITED' || e.code === 'UNREACHABLE');
}

export interface ListPage {
	items: unknown[];
	pagination: DiscogsPagination;
}

export interface PriceSuggestions {
	[condition: string]: { currency: string; value: number };
}

// One queue for every Discogs call this page makes, whatever it is for: each
// call takes the next free slot, and slots are PACE_MS apart.
let paceMs = PACE_MS;
let nextSlotAt = 0;

function takeSlot(): Promise<void> {
	const now = Date.now();
	const at = Math.max(now, nextSlotAt);
	nextSlotAt = at + paceMs;
	return at > now ? new Promise((resolve) => setTimeout(resolve, at - now)) : Promise.resolve();
}

/** Sets the gap between calls, or restores it with `null`. Clears the queue either way. */
export function setPaceForTests(ms: number | null): void {
	paceMs = ms ?? PACE_MS;
	nextSlotAt = 0;
}

/**
 * Makes exactly one request to Discogs, in its turn. Never retries: the caller
 * decides what a busy answer means.
 */
export async function discogsGet<T>(endpoint: string, token?: string): Promise<T> {
	await takeSlot();
	const auth = token ? `${endpoint.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : '';

	let response: Response;
	try {
		response = await fetch(`${DISCOGS_API_BASE}${endpoint}${auth}`, { credentials: 'omit' });
	} catch {
		throw new DiscogsAPIError('Could not reach Discogs', 0, 'UNREACHABLE');
	}

	if (response.ok) {
		try {
			return (await response.json()) as T;
		} catch {
			throw new DiscogsAPIError('Invalid response from Discogs', 502, 'BAD_RESPONSE');
		}
	}
	if (response.status === 401) throw new DiscogsAPIError('Invalid or expired Discogs token', 401, 'BAD_TOKEN');
	if (response.status === 404) throw new DiscogsAPIError('User not found', 404, 'NOT_FOUND');
	if (response.status === 403) throw new DiscogsAPIError('Collection is private', 403, 'PRIVATE');
	if (response.status === 429) throw new DiscogsAPIError('Discogs is busy', 429, 'RATE_LIMITED');

	console.error(`Unexpected Discogs API response: ${response.status} ${response.statusText}`);
	throw new DiscogsAPIError('Discogs API request failed', 502, 'UPSTREAM_ERROR');
}

export function fetchProfile(username: string, token: string): Promise<DiscogsUserProfile> {
	return discogsGet<DiscogsUserProfile>(`/users/${encodeURIComponent(username)}`, token);
}

/** One page of a list. With no token, Discogs answers only if the list is public. */
export async function fetchListPage(
	kind: SyncKind,
	username: string,
	page: number,
	perPage: number,
	token: string | undefined
): Promise<ListPage> {
	const user = encodeURIComponent(username);
	const query = `page=${page}&per_page=${perPage}&sort=added&sort_order=desc`;
	if (kind === 'collection') {
		const r = await discogsGet<DiscogsCollectionResponse>(`/users/${user}/collection/folders/0/releases?${query}`, token);
		return { items: r.releases, pagination: r.pagination };
	}
	const r = await discogsGet<DiscogsWantlistResponse>(`/users/${user}/wants?${query}`, token);
	return { items: r.wants, pagination: r.pagination };
}

/** Who the token belongs to. */
export async function fetchIdentity(token: string): Promise<{ username: string }> {
	const data = await discogsGet<{ username?: unknown }>('/oauth/identity', token);
	if (typeof data?.username !== 'string') {
		throw new DiscogsAPIError('Unexpected response from Discogs', 502, 'BAD_RESPONSE');
	}
	return { username: data.username };
}

/** The Settings page's token test, as a line to show the visitor. */
export async function checkToken(token: string): Promise<{ success: boolean; message: string }> {
	try {
		return { success: true, message: `Connected as: ${(await fetchIdentity(token)).username}` };
	} catch (e) {
		if (isBusy(e)) return { success: false, message: 'Discogs is busy or unreachable. Try again in a minute.' };
		const rejected = e instanceof DiscogsAPIError && e.code === 'BAD_TOKEN';
		return { success: false, message: rejected ? 'Invalid token' : 'Failed to verify token' };
	}
}

export function fetchPriceSuggestions(releaseId: number, token: string): Promise<PriceSuggestions> {
	return discogsGet<PriceSuggestions>(`/marketplace/price_suggestions/${releaseId}`, token);
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
