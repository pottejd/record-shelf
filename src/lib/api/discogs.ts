import type {
	DiscogsCollectionResponse,
	DiscogsCollectionItem,
	DiscogsUserProfile,
	CollectionStats,
	UserCollection
} from '$lib/types/discogs';

const DISCOGS_API_BASE = 'https://api.discogs.com';
const PER_PAGE = 100; // Max allowed by Discogs

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

interface FetchOptions {
	userAgent: string;
	token?: string;
}

async function fetchDiscogs<T>(
	endpoint: string,
	options: FetchOptions
): Promise<T> {
	const headers: Record<string, string> = {
		'User-Agent': options.userAgent,
		Accept: 'application/vnd.discogs.v2.discogs+json'
	};

	if (options.token) {
		headers['Authorization'] = `Discogs token=${options.token}`;
	}

	const response = await fetch(`${DISCOGS_API_BASE}${endpoint}`, { headers });

	if (!response.ok) {
		if (response.status === 404) {
			throw new DiscogsAPIError('User not found', 404, 'NOT_FOUND');
		}
		if (response.status === 403) {
			throw new DiscogsAPIError('Collection is private', 403, 'PRIVATE');
		}
		if (response.status === 429) {
			throw new DiscogsAPIError('Rate limited - please try again later', 429, 'RATE_LIMITED');
		}
		throw new DiscogsAPIError(`API error: ${response.statusText}`, response.status);
	}

	return response.json();
}

export async function fetchUserProfile(
	username: string,
	options: FetchOptions
): Promise<DiscogsUserProfile> {
	return fetchDiscogs<DiscogsUserProfile>(`/users/${username}`, options);
}

export async function fetchUserCollection(
	username: string,
	options: FetchOptions,
	onProgress?: (fetched: number, total: number) => void
): Promise<DiscogsCollectionItem[]> {
	const allItems: DiscogsCollectionItem[] = [];
	let page = 1;
	let totalPages = 1;

	while (page <= totalPages) {
		const response = await fetchDiscogs<DiscogsCollectionResponse>(
			`/users/${username}/collection/folders/0/releases?page=${page}&per_page=${PER_PAGE}&sort=added&sort_order=desc`,
			options
		);

		allItems.push(...response.releases);
		totalPages = response.pagination.pages;

		if (onProgress) {
			onProgress(allItems.length, response.pagination.items);
		}

		page++;

		// Small delay to be nice to the API
		if (page <= totalPages) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	return allItems;
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

	for (const item of items) {
		const info = item.basic_information;

		// Track when items were added (by month)
		const addedDate = new Date(item.date_added);
		const monthKey = `${addedDate.getFullYear()}-${String(addedDate.getMonth() + 1).padStart(2, '0')}`;
		addedByMonthMap[monthKey] = (addedByMonthMap[monthKey] || 0) + 1;

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
			const name = artist.name.replace(/\s*\(\d+\)$/, ''); // Remove disambiguation numbers
			artistCounts[name] = (artistCounts[name] || 0) + 1;
		}

		// Labels
		for (const label of info.labels || []) {
			const name = label.name;
			if (name && name !== 'Not On Label') {
				labelCounts[name] = (labelCounts[name] || 0) + 1;
			}
		}
	}

	// Sort and get top items
	const sortByCount = (obj: Record<string, number>) =>
		Object.entries(obj)
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));

	const topArtists = sortByCount(artistCounts).slice(0, 20);
	const topLabels = sortByCount(labelCounts).slice(0, 20);
	const topStyles = sortByCount(styleCounts).slice(0, 20);

	// Recently added (already sorted by API)
	const recentlyAdded = items.slice(0, 12);

	// Added by month (last 12 months)
	const addedByMonth = Object.entries(addedByMonthMap)
		.sort((a, b) => a[0].localeCompare(b[0]))
		.slice(-12)
		.map(([date, count]) => ({ date, count }));

	// Calculate median year
	const sortedYears = years.sort((a, b) => a - b);
	const medianYear = sortedYears.length > 0
		? sortedYears[Math.floor(sortedYears.length / 2)]
		: 0;

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

	// Rating stats
	const ratingBreakdown: Record<number, number> = {};
	let ratingSum = 0;
	let ratedCount = 0;
	for (const item of items) {
		if (item.rating > 0) {
			ratingBreakdown[item.rating] = (ratingBreakdown[item.rating] || 0) + 1;
			ratingSum += item.rating;
			ratedCount++;
		}
	}
	const averageRating = ratedCount > 0 ? ratingSum / ratedCount : 0;
	const topRatedItems = items
		.filter(i => i.rating >= 4)
		.sort((a, b) => b.rating - a.rating || a.basic_information.title.localeCompare(b.basic_information.title))
		.slice(0, 12);

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

export async function fetchFullUserCollection(
	username: string,
	options: FetchOptions,
	onProgress?: (fetched: number, total: number) => void
): Promise<UserCollection> {
	const profile = await fetchUserProfile(username, options);
	const items = await fetchUserCollection(username, options, onProgress);
	const stats = computeCollectionStats(items);

	return {
		profile,
		items,
		stats,
		fetchedAt: Date.now()
	};
}
