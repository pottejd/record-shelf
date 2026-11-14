import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	computeCollectionStats,
	DiscogsAPIError,
	discogsGet,
	fetchListPage,
	lastRateReading
} from './discogs';
import type { DiscogsCollectionItem } from '$lib/types/discogs';

function makeItem(overrides: Partial<{
	id: number;
	title: string;
	year: number;
	genres: string[];
	styles: string[];
	artists: Array<{ id: number; name: string; resource_url: string }>;
	labels: Array<{ id: number; name: string; catno: string; resource_url: string }>;
	formats: Array<{ name: string; qty: string; descriptions?: string[] }>;
	rating: number;
	date_added: string;
}>): DiscogsCollectionItem {
	const {
		id = 1,
		title = 'Test Album',
		year = 2000,
		genres = ['Rock'],
		styles = ['Alternative Rock'],
		artists = [{ id: 1, name: 'Test Artist', resource_url: '' }],
		labels = [{ id: 1, name: 'Test Label', catno: 'TL-001', resource_url: '' }],
		formats = [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }],
		rating = 0,
		date_added = '2024-01-15T10:00:00-08:00'
	} = overrides;

	return {
		id,
		instance_id: id,
		folder_id: 1,
		rating,
		date_added,
		basic_information: {
			id,
			title,
			year,
			thumb: '',
			resource_url: '',
			artists,
			labels,
			formats,
			genres,
			styles
		}
	};
}

describe('computeCollectionStats', () => {
	it('returns zeroed stats for empty collection', () => {
		const stats = computeCollectionStats([]);
		expect(stats.totalItems).toBe(0);
		expect(stats.totalArtists).toBe(0);
		expect(stats.totalLabels).toBe(0);
		expect(stats.averageYear).toBe(0);
		expect(stats.medianYear).toBe(0);
		expect(stats.collectionSpan).toBe(0);
		expect(stats.dominantDecade).toBe('');
		expect(stats.dominantGenre).toBe('');
		expect(stats.uniqueArtistRatio).toBe(0);
		expect(stats.averageRating).toBe(0);
		expect(stats.ratedCount).toBe(0);
		expect(stats.topRatedItems).toEqual([]);
		expect(stats.oldestRelease).toBeNull();
		expect(stats.newestRelease).toBeNull();
	});

	it('counts total items correctly', () => {
		const items = [makeItem({ id: 1 }), makeItem({ id: 2 }), makeItem({ id: 3 })];
		const stats = computeCollectionStats(items);
		expect(stats.totalItems).toBe(3);
	});

	it('counts unique artists and computes diversity ratio', () => {
		const items = [
			makeItem({ id: 1, artists: [{ id: 1, name: 'Artist A', resource_url: '' }] }),
			makeItem({ id: 2, artists: [{ id: 1, name: 'Artist A', resource_url: '' }] }),
			makeItem({ id: 3, artists: [{ id: 2, name: 'Artist B', resource_url: '' }] })
		];
		const stats = computeCollectionStats(items);
		expect(stats.totalArtists).toBe(2);
		expect(stats.uniqueArtistRatio).toBeCloseTo(2 / 3);
	});

	it('strips disambiguation numbers from artist names', () => {
		const items = [
			makeItem({ id: 1, artists: [{ id: 1, name: 'Nirvana (2)', resource_url: '' }] }),
			makeItem({ id: 2, artists: [{ id: 2, name: 'Nirvana', resource_url: '' }] })
		];
		const stats = computeCollectionStats(items);
		// Both should be counted as "Nirvana"
		expect(stats.totalArtists).toBe(1);
		expect(stats.topArtists[0].name).toBe('Nirvana');
		expect(stats.topArtists[0].count).toBe(2);
	});

	it('excludes "Not On Label" from label counts', () => {
		const items = [
			makeItem({ id: 1, labels: [{ id: 1, name: 'Not On Label', catno: '', resource_url: '' }] }),
			makeItem({ id: 2, labels: [{ id: 2, name: 'Warp Records', catno: 'WAP-01', resource_url: '' }] })
		];
		const stats = computeCollectionStats(items);
		expect(stats.totalLabels).toBe(1);
		expect(stats.topLabels[0].name).toBe('Warp Records');
	});

	it('computes genre and style breakdowns', () => {
		const items = [
			makeItem({ id: 1, genres: ['Rock', 'Electronic'], styles: ['Indie Rock'] }),
			makeItem({ id: 2, genres: ['Electronic'], styles: ['Ambient', 'Indie Rock'] }),
			makeItem({ id: 3, genres: ['Rock'], styles: ['Punk'] })
		];
		const stats = computeCollectionStats(items);
		expect(stats.genreBreakdown).toEqual({ Rock: 2, Electronic: 2 });
		expect(stats.styleBreakdown).toEqual({ 'Indie Rock': 2, Ambient: 1, Punk: 1 });
		expect(stats.dominantGenre).toBe('Rock'); // Rock and Electronic are tied, but Rock appears first
	});

	it('computes decade and year breakdowns', () => {
		const items = [
			makeItem({ id: 1, year: 1975 }),
			makeItem({ id: 2, year: 1978 }),
			makeItem({ id: 3, year: 1985 })
		];
		const stats = computeCollectionStats(items);
		expect(stats.decadeBreakdown).toEqual({ 1970: 2, 1980: 1 });
		expect(stats.yearBreakdown).toEqual({ 1975: 1, 1978: 1, 1985: 1 });
		expect(stats.dominantDecade).toBe('1970s');
	});

	it('ignores year=0 for decade/year calculations', () => {
		const items = [
			makeItem({ id: 1, year: 0 }),
			makeItem({ id: 2, year: 1990 })
		];
		const stats = computeCollectionStats(items);
		expect(stats.yearBreakdown).toEqual({ 1990: 1 });
		expect(stats.oldestRelease?.year).toBe(1990);
		expect(stats.newestRelease?.year).toBe(1990);
		expect(stats.collectionSpan).toBe(0);
	});

	it('finds oldest and newest releases', () => {
		const items = [
			makeItem({ id: 1, title: 'Old Album', year: 1965 }),
			makeItem({ id: 2, title: 'New Album', year: 2023 }),
			makeItem({ id: 3, title: 'Mid Album', year: 1995 })
		];
		const stats = computeCollectionStats(items);
		expect(stats.oldestRelease?.title).toBe('Old Album');
		expect(stats.newestRelease?.title).toBe('New Album');
		expect(stats.collectionSpan).toBe(2023 - 1965);
	});

	it('computes average and median year', () => {
		const items = [
			makeItem({ id: 1, year: 1970 }),
			makeItem({ id: 2, year: 1980 }),
			makeItem({ id: 3, year: 2020 })
		];
		const stats = computeCollectionStats(items);
		expect(stats.averageYear).toBe(Math.round((1970 + 1980 + 2020) / 3));
		expect(stats.medianYear).toBe(1980);
	});

	it('computes median as the average of the two middle years for an even count', () => {
		const items = [1970, 1980, 1990, 2020].map((year, i) => makeItem({ id: i + 1, year }));
		const stats = computeCollectionStats(items);
		expect(stats.medianYear).toBe(1985); // (1980 + 1990) / 2
	});

	it('skips items with an unparseable date_added (no NaN-NaN month bucket)', () => {
		const items = [
			makeItem({ id: 1, date_added: 'not-a-date' }),
			makeItem({ id: 2, date_added: '2024-03-15T00:00:00-00:00' })
		];
		const stats = computeCollectionStats(items);
		expect(stats.addedByMonth.some((m) => m.date.includes('NaN'))).toBe(false);
		expect(stats.addedByMonth).toHaveLength(1);
	});

	it('computes format breakdowns including detail', () => {
		const items = [
			makeItem({ id: 1, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }] }),
			makeItem({ id: 2, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['7"', 'Single'] }] }),
			makeItem({ id: 3, formats: [{ name: 'CD', qty: '1' }] })
		];
		const stats = computeCollectionStats(items);
		expect(stats.formatBreakdown).toEqual({ Vinyl: 2, CD: 1 });
		expect(stats.formatDetailBreakdown).toEqual({
			'Vinyl (LP, Album)': 1,
			'Vinyl (7", Single)': 1,
			CD: 1
		});
	});

	it('computes rating stats', () => {
		const items = [
			makeItem({ id: 1, rating: 5 }),
			makeItem({ id: 2, rating: 4 }),
			makeItem({ id: 3, rating: 3 }),
			makeItem({ id: 4, rating: 0 })  // unrated
		];
		const stats = computeCollectionStats(items);
		expect(stats.ratedCount).toBe(3);
		expect(stats.averageRating).toBe(4);
		expect(stats.ratingBreakdown).toEqual({ 5: 1, 4: 1, 3: 1 });
		expect(stats.topRatedItems).toHaveLength(2); // rating >= 4
		expect(stats.topRatedItems[0].rating).toBe(5);
	});

	it('returns empty rating stats when nothing is rated', () => {
		const items = [
			makeItem({ id: 1, rating: 0 }),
			makeItem({ id: 2, rating: 0 })
		];
		const stats = computeCollectionStats(items);
		expect(stats.ratedCount).toBe(0);
		expect(stats.averageRating).toBe(0);
		expect(stats.ratingBreakdown).toEqual({});
		expect(stats.topRatedItems).toEqual([]);
	});

	it('limits recentlyAdded to 12 items', () => {
		const items = Array.from({ length: 20 }, (_, i) => makeItem({ id: i + 1 }));
		const stats = computeCollectionStats(items);
		expect(stats.recentlyAdded).toHaveLength(12);
	});

	it('limits topArtists and topLabels to 20', () => {
		const items = Array.from({ length: 25 }, (_, i) =>
			makeItem({
				id: i + 1,
				artists: [{ id: i + 1, name: `Artist ${i}`, resource_url: '' }],
				labels: [{ id: i + 1, name: `Label ${i}`, catno: `L-${i}`, resource_url: '' }]
			})
		);
		const stats = computeCollectionStats(items);
		expect(stats.topArtists).toHaveLength(20);
		expect(stats.topLabels).toHaveLength(20);
	});

	it('groups addedByMonth correctly', () => {
		const items = [
			makeItem({ id: 1, date_added: '2024-01-15T10:00:00Z' }),
			makeItem({ id: 2, date_added: '2024-01-20T10:00:00Z' }),
			makeItem({ id: 3, date_added: '2024-02-05T10:00:00Z' })
		];
		const stats = computeCollectionStats(items);
		expect(stats.addedByMonth).toEqual([
			{ date: '2024-01', count: 2 },
			{ date: '2024-02', count: 1 }
		]);
	});
});

describe('DiscogsAPIError', () => {
	it('creates error with status and code', () => {
		const err = new DiscogsAPIError('Not found', 404, 'NOT_FOUND');
		expect(err.message).toBe('Not found');
		expect(err.status).toBe(404);
		expect(err.code).toBe('NOT_FOUND');
		expect(err.name).toBe('DiscogsAPIError');
		expect(err).toBeInstanceOf(Error);
	});

	it('works without code', () => {
		const err = new DiscogsAPIError('Server error', 500);
		expect(err.code).toBeUndefined();
	});
});

describe('discogsGet', () => {
	const opts = { userAgent: 'T/1', token: 'tok' };
	const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
		new Response(JSON.stringify(body), { status, headers });

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('returns data and the remaining budget from X-Discogs-Ratelimit-Remaining', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => res(200, { a: 1 }, { 'X-Discogs-Ratelimit-Remaining': '42' })));
		expect(await discogsGet('/x', opts)).toEqual({ data: { a: 1 }, remaining: 42 });
		expect(lastRateReading().remaining).toBe(42);
	});
	it('reports remaining as null when the header is absent', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => res(200, {})));
		expect((await discogsGet('/x', opts)).remaining).toBeNull();
	});
	it('on 429 throws RATE_LIMITED at once, without a second fetch', async () => {
		const f = vi.fn(async () => res(429, {}, { 'Retry-After': '7' }));
		vi.stubGlobal('fetch', f);
		await expect(discogsGet('/x', opts)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterMs: 7000 });
		expect(f).toHaveBeenCalledTimes(1);
		expect(lastRateReading().last429At).not.toBeNull();
	});
	it('uses 30000 ms when Retry-After is missing or not a number', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => res(429, {}, { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' })));
		await expect(discogsGet('/x', opts)).rejects.toMatchObject({ retryAfterMs: 30000 });
	});
	it('sends no Authorization header when no token is given', async () => {
		const f = vi.fn(async (_url: string, _init?: RequestInit) => res(200, {}));
		vi.stubGlobal('fetch', f);
		await discogsGet('/x', { userAgent: 'T/1' });
		expect((f.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Authorization');
	});
	it('maps 401, 403, 404 and other statuses like fetchDiscogs', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		for (const [status, code] of [[401, 'BAD_TOKEN'], [403, 'PRIVATE'], [404, 'NOT_FOUND'], [500, 'UPSTREAM_ERROR']] as const) {
			vi.stubGlobal('fetch', vi.fn(async () => res(status, {})));
			await expect(discogsGet('/x', opts)).rejects.toMatchObject({ code });
		}
	});
});

describe('fetchListPage', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('requests the collection endpoint and returns releases as items', async () => {
		const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ pagination: { page: 2, pages: 3, per_page: 100, items: 250, urls: {} }, releases: [{ id: 1 }] })));
		vi.stubGlobal('fetch', f);
		const r = await fetchListPage('collection', 'Some User', 2, 100, { userAgent: 'T/1', token: 't' });
		expect(f.mock.calls[0][0]).toBe('https://api.discogs.com/users/Some%20User/collection/folders/0/releases?page=2&per_page=100&sort=added&sort_order=desc');
		expect(r.data.items).toEqual([{ id: 1 }]);
		expect(r.data.pagination.pages).toBe(3);
	});
	it('requests the wants endpoint and returns wants as items', async () => {
		const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ pagination: { page: 1, pages: 1, per_page: 1, items: 1, urls: {} }, wants: [{ id: 9 }] })));
		vi.stubGlobal('fetch', f);
		const r = await fetchListPage('wantlist', 'u', 1, 1, { userAgent: 'T/1' });
		expect(f.mock.calls[0][0]).toBe('https://api.discogs.com/users/u/wants?page=1&per_page=1&sort=added&sort_order=desc');
		expect(r.data.items).toEqual([{ id: 9 }]);
	});
});
