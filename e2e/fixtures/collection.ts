import type { Page, Route } from '@playwright/test';
import type { DiscogsCollectionItem, DiscogsWantlistItem, DiscogsFormat } from '../../src/lib/types/discogs';

/** A small seeded generator, so the same seed always makes the same collection. */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** The day the made-up copies were "taken": fixed, so dates never drift between runs. */
const TODAY = Date.UTC(2026, 10, 14);
const DAY = 24 * 60 * 60 * 1000;
const COVER_HOST = 'https://covers.invalid';

const GENRES: Array<[string, number]> = [
	['Rock', 34], ['Electronic', 18], ['Jazz', 14], ['Funk / Soul', 11],
	['Hip Hop', 8], ['Pop', 7], ['Folk, World, & Country', 5], ['Classical', 3]
];
const STYLES: Record<string, string[]> = {
	Rock: ['Indie Rock', 'Prog Rock', 'Psychedelic Rock', 'Punk'],
	Electronic: ['Ambient', 'Techno', 'House', 'Synth-pop'],
	Jazz: ['Hard Bop', 'Fusion', 'Modal'],
	'Funk / Soul': ['Soul', 'Disco', 'Funk'],
	'Hip Hop': ['Boom Bap', 'Instrumental'],
	Pop: ['Synth-pop', 'Europop'],
	'Folk, World, & Country': ['Folk', 'Country', 'Afrobeat'],
	Classical: ['Baroque', 'Romantic']
};
const WORDS_A = ['Midnight', 'Velvet', 'Paper', 'Electric', 'Quiet', 'Golden', 'Broken', 'Hollow', 'Neon', 'Salt', 'Winter', 'Distant', 'Copper', 'Slow', 'Orange', 'Glass'];
const WORDS_B = ['Garden', 'Machine', 'Harbour', 'Letters', 'Static', 'Parade', 'Orchard', 'Signals', 'Weather', 'Rooms', 'Engines', 'Tides', 'Mirrors', 'Fields', 'Hours', 'Sessions'];
const NAMES_A = ['The', 'Los', 'Little', 'Saint', 'Big', 'Madame', 'Young', 'Old'];
const NAMES_B = ['Lanterns', 'Foxes', 'Ramblers', 'Pilots', 'Tapes', 'Orchids', 'Owls', 'Wolves', 'Anchors', 'Strangers'];
const LABELS = ['Blue Door', 'Kestrel', 'Northbound', 'Sunday Best', 'Tin Roof', 'Plain Sight', 'Harvest Moon', 'Low Light', 'Cedar', 'Parallel'];

/** Three titles of exactly 90 characters. */
const LONG_TITLES = [
	'The Complete Unabridged Recordings of the Midnight Orchestra Performing Live at the Old Hall',
	'Songs for Rainy Afternoons, Long Train Journeys, Empty Libraries and Other Quiet Places Once',
	'A Collection of Early Experiments, Unreleased Demos, Alternate Takes and Rehearsal Tapes Ok'
].map((t) => t.slice(0, 90));
const NON_LATIN = [
	{ artist: 'さくら楽団', title: '夜明けの音楽 〜 静かな朝' },
	{ artist: 'Оркестр Заря', title: 'Времена года: Зимняя симфония' }
];

function pick<T>(r: () => number, list: T[]): T { return list[Math.floor(r() * list.length)]; }

function weighted(r: () => number, list: Array<[string, number]>): string {
	const total = list.reduce((s, [, w]) => s + w, 0);
	let x = r() * total;
	for (const [name, w] of list) { if ((x -= w) < 0) return name; }
	return list[0][0];
}

function yearOf(r: () => number): number {
	const x = r();
	if (x < 0.01) return 0;
	// A hump in the 1970s, a long tail either side, 1955 to 2024.
	const y = x < 0.4 ? 1974 + (r() + r() + r() - 1.5) * 8 : 1955 + r() * 69;
	return Math.min(2024, Math.max(1955, Math.round(y)));
}

function formatOf(r: () => number): DiscogsFormat {
	const x = r();
	if (x < 0.84) return { name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] };
	if (x < 0.92) return { name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album'] };
	if (x < 0.96) return { name: 'Vinyl', qty: '1', descriptions: ['7"', '45 RPM', 'Single'] };
	if (x < 0.98) return { name: 'Vinyl', qty: '1', descriptions: ['10"'] };
	return { name: 'CD', qty: '1', descriptions: ['Album'] };
}

function basic(r: () => number, id: number, special: { artist: string; title: string } | null, longTitle: string | null) {
	const artist = special?.artist ?? `${pick(r, NAMES_A)} ${pick(r, NAMES_B)}`;
	const title = special?.title ?? longTitle ?? `${pick(r, WORDS_A)} ${pick(r, WORDS_B)}`;
	const genre = weighted(r, GENRES);
	const genres = [genre];
	if (r() < 0.12) genres.push(weighted(r, GENRES.filter(([g]) => g !== genre)));
	return {
		id, title, year: yearOf(r),
		thumb: `${COVER_HOST}/thumb/${id}.jpg`, cover_image: `${COVER_HOST}/cover/${id}.jpg`,
		resource_url: `${COVER_HOST}/releases/${id}`,
		artists: [{ id: 1000 + (id % 400), name: artist, resource_url: '' }],
		labels: [{ id: 2000 + (id % 10), name: pick(r, LABELS), catno: `LS-${100 + (id % 900)}`, resource_url: '' }],
		formats: [formatOf(r)],
		genres,
		styles: r() < 0.7 ? [pick(r, STYLES[genre])] : []
	};
}

/**
 * A made-up collection in a realistic mix: mostly single LPs, some doubles, a few
 * 7-inch, 10-inch and CD; years 1955 to 2024 with a hump in the 1970s; added over
 * the last six years. The same `n` and `seed` always give the same list.
 */
export function makeCollection(n: number, seed = 1): DiscogsCollectionItem[] {
	const r = rng(seed);
	const longAt = [1, 2, 3].map((k) => Math.floor((n * k) / 7));
	const latinAt = [4, 5].map((k) => Math.floor((n * k) / 7));
	return Array.from({ length: n }, (_, i) => {
		const id = seed * 1_000_000 + i + 1;
		const li = longAt.indexOf(i);
		const ni = latinAt.indexOf(i);
		const info = basic(r, id, ni >= 0 ? NON_LATIN[ni] : null, li >= 0 ? LONG_TITLES[li] : null);
		const added = TODAY - Math.floor(r() * 6 * 365 * DAY);
		return {
			id, instance_id: id, folder_id: 1,
			rating: r() < 0.4 ? 1 + Math.floor(r() * 5) : 0,
			date_added: new Date(added).toISOString(),
			basic_information: info
		};
	});
}

function makeWantlist(n: number, seed: number): DiscogsWantlistItem[] {
	return makeCollection(n, seed).map(({ id, rating, date_added, basic_information }) => ({ id, rating, date_added, basic_information }));
}

export async function withToken(pw: Page): Promise<void> {
	await pw.context().addCookies([{ name: 'discogs_token', value: 'e2e', url: 'http://localhost:4173' }]);
}

const PAGE = 100;
const profileOf = (username: string) => ({ id: 1, username, avatar_url: `${COVER_HOST}/avatar/${username}.jpg`, location: 'Somewhere, Nowhere' });

/** Nothing leaves the machine: covers get a flat colour, every other outside request is aborted. */
async function keepLocal(pw: Page): Promise<void> {
	await pw.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => route.abort());
	await pw.route((url) => url.hostname === 'covers.invalid', (route) => {
		let h = 0;
		for (const ch of route.request().url()) h = (h * 31 + ch.charCodeAt(0)) % 360;
		return route.fulfill({
			contentType: 'image/svg+xml',
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="hsl(${h} 30% 45%)"/></svg>`
		});
	});
}

/** Answers the sync API for a complete stored copy, 100 per page. */
async function answerStored(pw: Page, kind: 'collection' | 'wantlist', username: string, items: unknown[]) {
	const totalPages = Math.max(1, Math.ceil(items.length / PAGE));
	const pageOf = (p: number) => ({
		status: 'ok', snapshot: 'S1', page: p, totalPages, totalItems: items.length,
		items: items.slice((p - 1) * PAGE, p * PAGE)
	});
	let calls = 0;
	await pw.route(`**/api/${kind}/${username}**`, async (route: Route) => {
		const req = route.request();
		if (req.method() === 'POST') {
			const body = req.postDataJSON();
			return route.fulfill({
				json: body.action === 'start' ? { ...pageOf(1), profile: profileOf(username) } : { status: 'complete', snapshot: 'S1', completedAt: TODAY }
			});
		}
		calls++;
		return route.fulfill({ json: pageOf(Number(new URL(req.url()).searchParams.get('page')) || 1) });
	});
	return () => calls;
}

/** A complete stored collection for `username`; Discogs is never reached (calls are aborted and counted). */
export async function mockStored(pw: Page, username: string, items: DiscogsCollectionItem[]): Promise<{ collectionCalls: () => number; discogsCalls: () => number }> {
	let discogs = 0;
	await keepLocal(pw);
	await pw.route('https://api.discogs.com/**', (route) => { discogs++; return route.abort(); });
	const collectionCalls = await answerStored(pw, 'collection', username, items);
	return { collectionCalls, discogsCalls: () => discogs };
}

/** A complete stored wantlist of `n` made-up records for `username`. */
export async function mockStoredWantlist(pw: Page, username: string, n: number): Promise<void> {
	await keepLocal(pw);
	await answerStored(pw, 'wantlist', username, makeWantlist(n, 7));
}
