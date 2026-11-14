import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
	checkToken,
	computeCollectionStats,
	DiscogsAPIError,
	discogsGet,
	fetchIdentity,
	fetchListPage,
	fetchPriceSuggestions,
	fetchProfile,
	isBusy,
	setPaceForTests
} from './discogs';
import { PACE_MS } from '$lib/sync/types';
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

const res =(status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
/** The Authorization header a call was made with, or null. */
const authOf = (init?: RequestInit) => new Headers(init?.headers).get('authorization');

describe('discogsGet (called from the browser)', () => {
	beforeEach(() => setPaceForTests(0));
	afterEach(() => {
		setPaceForTests(null);
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('sends the token in the Authorization header, never in the address, and no cookies', async () => {
		const f = vi.fn(async (_url: string, _init?: RequestInit) => res(200, { a: 1 }));
		vi.stubGlobal('fetch', f);
		expect(await discogsGet('/x', 'to ken')).toEqual({ a: 1 });
		expect(await discogsGet('/y?page=2', 'tok')).toEqual({ a: 1 });
		expect(f.mock.calls.map((c) => c[0])).toEqual(['https://api.discogs.com/x', 'https://api.discogs.com/y?page=2']);
		expect(f.mock.calls.map((c) => authOf(c[1]))).toEqual(['Discogs token=to ken', 'Discogs token=tok']);
		expect(f.mock.calls.map((c) => c[1]?.credentials)).toEqual(['omit', 'omit']);
	});
	it('sends no token and no headers when none is given, so that call needs no preflight', async () => {
		const f = vi.fn(async (_url: string, _init?: RequestInit) => res(200));
		vi.stubGlobal('fetch', f);
		await discogsGet('/x?page=1');
		expect(f.mock.calls[0]).toEqual(['https://api.discogs.com/x?page=1', { credentials: 'omit' }]);
	});
	it('a token that cannot be sent as a header is a bad token, and Discogs is not called', async () => {
		// A browser refuses to send such a header at all, which would otherwise look like "Discogs is busy".
		const f = vi.fn(async () => res(200));
		vi.stubGlobal('fetch', f);
		for (const token of ['line\nbreak', 'snowman ☃']) {
			await expect(discogsGet('/x', token)).rejects.toMatchObject({ code: 'BAD_TOKEN', status: 401 });
		}
		expect(f).not.toHaveBeenCalled();
	});
	it('a 429 is RATE_LIMITED and a request with no readable answer is UNREACHABLE; both count as busy, one fetch each', async () => {
		const limited = vi.fn(async () => res(429));
		vi.stubGlobal('fetch', limited);
		const first = await discogsGet('/x', 'tok').catch((e) => e);
		expect(first).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
		expect(limited).toHaveBeenCalledTimes(1);

		// What a browser sees for Discogs' 429: it carries no CORS header.
		const blocked = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
		vi.stubGlobal('fetch', blocked);
		const second = await discogsGet('/x', 'tok').catch((e) => e);
		expect(second).toMatchObject({ code: 'UNREACHABLE' });
		expect(second).toBeInstanceOf(DiscogsAPIError);
		expect(blocked).toHaveBeenCalledTimes(1);

		expect([isBusy(first), isBusy(second)]).toEqual([true, true]);
		expect([isBusy(new DiscogsAPIError('x', 404, 'NOT_FOUND')), isBusy(new Error('x')), isBusy(null)]).toEqual([false, false, false]);
	});
	it('maps 401, 403, 404, other statuses and an unreadable body to error codes', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		for (const [status, code] of [[401, 'BAD_TOKEN'], [403, 'PRIVATE'], [404, 'NOT_FOUND'], [500, 'UPSTREAM_ERROR']] as const) {
			vi.stubGlobal('fetch', vi.fn(async () => res(status)));
			await expect(discogsGet('/x', 'tok')).rejects.toMatchObject({ code });
		}
		vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })));
		await expect(discogsGet('/x', 'tok')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
	});
	it('never puts the token in an error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn(async () => res(500)));
		const e = (await discogsGet('/x', 'SECRET-TOKEN').catch((err) => err)) as Error;
		expect(`${e.message} ${e.stack} ${JSON.stringify(vi.mocked(console.error).mock.calls)}`).not.toContain('SECRET-TOKEN');
	});
});

describe('one shared queue paces every Discogs call', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setPaceForTests(null);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	/** Stubs Discogs and records when each call reaches it. */
	const callTimes = () => {
		const at: number[] = [];
		vi.stubGlobal('fetch', vi.fn(async () => { at.push(Date.now()); return res(200, { pagination: {}, releases: [], wants: [], username: 'u' }); }));
		return at;
	};

	it('calls that carry a token leave two slots apart, whatever they are for: Discogs counts the preflight too', async () => {
		const at = callTimes();
		const t0 = Date.now();
		const all = Promise.all([
			fetchListPage('collection', 'u', 1, 100, 'tok'),
			fetchProfile('u', 'tok'),
			fetchPriceSuggestions(7, 'tok'),
			fetchIdentity('tok')
		]);
		await vi.advanceTimersByTimeAsync(PACE_MS * 6);
		await all;
		expect(at.map((t) => t - t0)).toEqual([0, PACE_MS * 2, PACE_MS * 4, PACE_MS * 6]);
	});
	it('a call with no token takes one slot: it has no preflight', async () => {
		const at = callTimes();
		const t0 = Date.now();
		const all = Promise.all([
			fetchListPage('collection', 'u', 1, 1, undefined),
			fetchListPage('collection', 'u', 1, 100, 'tok'),
			fetchListPage('wantlist', 'u', 1, 1, undefined),
			fetchProfile('u', 'tok')
		]);
		await vi.advanceTimersByTimeAsync(PACE_MS * 4);
		await all;
		expect(at.map((t) => t - t0)).toEqual([0, PACE_MS, PACE_MS * 3, PACE_MS * 4]);
	});
	it('a minute of calls that carry a token stays inside the 60 requests Discogs allows, counting each preflight', async () => {
		const at = callTimes();
		const all = Promise.all(Array.from({ length: 40 }, (_, i) => fetchPriceSuggestions(i + 1, 'tok')));
		await vi.advanceTimersByTimeAsync(120_000);
		await all;
		const inFirstMinute = at.filter((t) => t - at[0] < 60_000).length;
		expect(inFirstMinute * 2).toBeLessThanOrEqual(60);
		// ...and is no slower than that needs.
		expect(inFirstMinute).toBeGreaterThanOrEqual(25);
	});
	it('a call made after a quiet spell goes at once', async () => {
		const f = vi.fn(async () => res(200));
		vi.stubGlobal('fetch', f);
		await discogsGet('/a');
		await vi.advanceTimersByTimeAsync(PACE_MS * 5);
		const t = Date.now();
		await discogsGet('/b');
		expect(Date.now()).toBe(t);
		expect(f).toHaveBeenCalledTimes(2);
	});
});

describe('endpoints', () => {
	beforeEach(() => setPaceForTests(0));
	afterEach(() => {
		setPaceForTests(null);
		vi.unstubAllGlobals();
	});
	const stub = (body: unknown) => {
		const f = vi.fn(async (_url: string, _init?: RequestInit) => res(200, body));
		vi.stubGlobal('fetch', f);
		return f;
	};

	it('fetchListPage requests the collection endpoint with the token and returns releases as items', async () => {
		const f = stub({ pagination: { page: 2, pages: 3, per_page: 100, items: 250, urls: {} }, releases: [{ id: 1 }] });
		const r = await fetchListPage('collection', 'Some User', 2, 100, 't');
		expect(f.mock.calls[0][0]).toBe('https://api.discogs.com/users/Some%20User/collection/folders/0/releases?page=2&per_page=100&sort=added&sort_order=desc');
		expect(authOf(f.mock.calls[0][1])).toBe('Discogs token=t');
		expect(r.items).toEqual([{ id: 1 }]);
		expect(r.pagination.pages).toBe(3);
	});
	it('fetchListPage requests the wants endpoint and returns wants as items; no token, no Authorization header', async () => {
		const f = stub({ pagination: { page: 1, pages: 1, per_page: 1, items: 1, urls: {} }, wants: [{ id: 9 }] });
		const r = await fetchListPage('wantlist', 'u', 1, 1, undefined);
		expect(f.mock.calls[0][0]).toBe('https://api.discogs.com/users/u/wants?page=1&per_page=1&sort=added&sort_order=desc');
		expect(authOf(f.mock.calls[0][1])).toBeNull();
		expect(r.items).toEqual([{ id: 9 }]);
	});
	it('fetchProfile, fetchIdentity and fetchPriceSuggestions ask the right addresses with the token', async () => {
		const f = stub({ username: 'u' });
		await fetchProfile('Some User', 't');
		expect(await fetchIdentity('t')).toEqual({ username: 'u' });
		await fetchPriceSuggestions(42, 't');
		expect(f.mock.calls.map((c) => c[0])).toEqual([
			'https://api.discogs.com/users/Some%20User',
			'https://api.discogs.com/oauth/identity',
			'https://api.discogs.com/marketplace/price_suggestions/42'
		]);
		expect(f.mock.calls.map((c) => authOf(c[1]))).toEqual(['Discogs token=t', 'Discogs token=t', 'Discogs token=t']);
	});
	it('fetchIdentity rejects an answer with no username', async () => {
		stub({ id: 1 });
		await expect(fetchIdentity('t')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
	});
});

describe('checkToken (the Settings page test)', () => {
	beforeEach(() => setPaceForTests(0));
	afterEach(() => {
		setPaceForTests(null);
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('asks Discogs directly who the token belongs to', async () => {
		const f = vi.fn(async (_url: string, _init?: RequestInit) => res(200, { username: 'someone' }));
		vi.stubGlobal('fetch', f);
		expect(await checkToken('tok')).toEqual({ success: true, message: 'Connected as: someone' });
		expect(f.mock.calls.map((c) => [c[0], authOf(c[1])])).toEqual([['https://api.discogs.com/oauth/identity', 'Discogs token=tok']]);
	});
	it('says a token that cannot be sent is invalid, rather than blaming Discogs', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => res(200, { username: 'someone' })));
		expect(await checkToken('bad\ntoken')).toEqual({ success: false, message: 'Invalid token' });
	});
	it('says a rejected token is invalid', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => res(401)));
		expect(await checkToken('tok')).toEqual({ success: false, message: 'Invalid token' });
	});
	it('says so when Discogs is busy or cannot be reached, rather than blaming the token', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
		const result = await checkToken('tok');
		expect(result.success).toBe(false);
		expect(result.message).toMatch(/busy or unreachable/);
	});
	it('reports any other failure plainly', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn(async () => res(500)));
		expect(await checkToken('tok')).toEqual({ success: false, message: 'Failed to verify token' });
	});
});
