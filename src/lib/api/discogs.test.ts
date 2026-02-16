import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	computeCollectionStats,
	DiscogsAPIError,
	fetchCollectionPage,
	fetchUserCollection,
	fetchUserProfile
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

describe('fetch functions', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	const opts = { userAgent: 'TestAgent/1.0', token: 'test-token' };

	function mockResponse(data: unknown, status = 200) {
		return {
			ok: status >= 200 && status < 300,
			status,
			statusText: status === 200 ? 'OK' : 'Error',
			headers: new Headers(),
			json: async () => data
		};
	}

	beforeEach(() => {
		vi.useFakeTimers();
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	describe('fetchDiscogs (via fetchUserProfile)', () => {
		it('returns parsed JSON on success', async () => {
			mockFetch.mockResolvedValue(mockResponse({ username: 'testuser', id: 1 }));

			const result = await fetchUserProfile('testuser', opts);
			expect(result.username).toBe('testuser');
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.discogs.com/users/testuser',
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: 'Discogs token=test-token'
					})
				})
			);
		});

		it('throws NOT_FOUND on 404', async () => {
			mockFetch.mockResolvedValue(mockResponse(null, 404));

			await expect(fetchUserProfile('ghost', opts))
				.rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
		});

		it('throws PRIVATE on 403', async () => {
			mockFetch.mockResolvedValue(mockResponse(null, 403));

			await expect(fetchUserProfile('private', opts))
				.rejects.toMatchObject({ code: 'PRIVATE', status: 403 });
		});

		it('retries on 429 with exponential backoff', async () => {
			mockFetch
				.mockResolvedValueOnce(mockResponse(null, 429))
				.mockResolvedValueOnce(mockResponse({ username: 'testuser', id: 1 }));

			const promise = fetchUserProfile('testuser', opts);
			// First attempt gets 429, retry after BASE_DELAY_MS * 2^0 = 1000ms
			await vi.advanceTimersByTimeAsync(1100);
			const result = await promise;

			expect(result.username).toBe('testuser');
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('respects Retry-After header on 429', async () => {
			const headers429 = new Headers({ 'Retry-After': '2' });
			mockFetch
				.mockResolvedValueOnce({ ok: false, status: 429, headers: headers429, statusText: 'Too Many Requests' })
				.mockResolvedValueOnce(mockResponse({ username: 'testuser', id: 1 }));

			const promise = fetchUserProfile('testuser', opts);
			// Retry-After: 2 → 2000ms delay
			await vi.advanceTimersByTimeAsync(2100);
			const result = await promise;

			expect(result.username).toBe('testuser');
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('throws RATE_LIMITED after max retries on 429', async () => {
			mockFetch.mockResolvedValue(mockResponse(null, 429));

			const promise = fetchUserProfile('testuser', opts);
			// Attach handler before advancing to prevent unhandled rejection
			const assertion = expect(promise).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
			// 4 attempts (0,1,2,3), delays: 1000, 2000, 4000 = 7000ms
			await vi.advanceTimersByTimeAsync(8000);

			await assertion;
			expect(mockFetch).toHaveBeenCalledTimes(4);
		});

		it('works without auth token', async () => {
			mockFetch.mockResolvedValue(mockResponse({ username: 'testuser', id: 1 }));

			await fetchUserProfile('testuser', { userAgent: 'TestAgent/1.0' });
			const callHeaders = mockFetch.mock.calls[0][1].headers;
			expect(callHeaders.Authorization).toBeUndefined();
		});
	});

	describe('fetchCollectionPage', () => {
		it('returns items and pagination', async () => {
			const apiResponse = {
				releases: [{ id: 1, basic_information: { title: 'Album' } }],
				pagination: { page: 1, pages: 3, per_page: 100, items: 250, urls: {} }
			};
			mockFetch.mockResolvedValue(mockResponse(apiResponse));

			const result = await fetchCollectionPage('testuser', 1, opts);

			expect(result.items).toEqual(apiResponse.releases);
			expect(result.pagination.pages).toBe(3);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('page=1&per_page=100'),
				expect.any(Object)
			);
		});
	});

	describe('fetchUserCollection', () => {
		function makePageResponse(page: number, totalPages: number, items: unknown[]) {
			return mockResponse({
				releases: items,
				pagination: { page, pages: totalPages, per_page: 100, items: totalPages * 100, urls: {} }
			});
		}

		it('paginates through all pages', async () => {
			mockFetch
				.mockResolvedValueOnce(makePageResponse(1, 2, [{ id: 1 }]))
				.mockResolvedValueOnce(makePageResponse(2, 2, [{ id: 2 }]));

			const promise = fetchUserCollection('testuser', opts);
			// Pagination delay between pages: 1100ms
			await vi.advanceTimersByTimeAsync(1200);
			const result = await promise;

			expect(result.items).toHaveLength(2);
			expect(result.totalPages).toBe(2);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('respects maxPages limit', async () => {
			mockFetch
				.mockResolvedValueOnce(makePageResponse(1, 5, [{ id: 1 }]))
				.mockResolvedValueOnce(makePageResponse(2, 5, [{ id: 2 }]));

			const promise = fetchUserCollection('testuser', opts, 2);
			await vi.advanceTimersByTimeAsync(1200);
			const result = await promise;

			expect(result.items).toHaveLength(2);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('calls progress callback', async () => {
			mockFetch
				.mockResolvedValueOnce(makePageResponse(1, 2, [{ id: 1 }]))
				.mockResolvedValueOnce(makePageResponse(2, 2, [{ id: 2 }]));

			const onProgress = vi.fn();
			const promise = fetchUserCollection('testuser', opts, undefined, onProgress);
			await vi.advanceTimersByTimeAsync(1200);
			await promise;

			expect(onProgress).toHaveBeenCalledTimes(2);
			expect(onProgress).toHaveBeenCalledWith(1, 200); // after page 1
			expect(onProgress).toHaveBeenCalledWith(2, 200); // after page 2
		});

		it('handles single page collection without delay', async () => {
			mockFetch.mockResolvedValueOnce(makePageResponse(1, 1, [{ id: 1 }]));

			const result = await fetchUserCollection('testuser', opts);

			expect(result.items).toHaveLength(1);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});
});
