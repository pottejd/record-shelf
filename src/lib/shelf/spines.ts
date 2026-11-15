import type { DiscogsCollectionItem } from '$lib/types/discogs';
import type { LoaderPhase } from '$lib/sync/engine';

export interface Spine {
	key: number;
	item: DiscogsCollectionItem;
	year: number;
	units: 1 | 2 | 4;
	width: number;
	height: 1 | 0.9 | 0.56;
	colour: number;
}

export const PER_SHELF = { wide: 230, narrow: 115 } as const;
export const MAX_SHELVES = { wide: 6, narrow: 8 } as const;
/** ink, cream, tan, grey, red, blue, mustard, green, plum */
export const SPINE_WEIGHTS = [5, 6, 4, 3, 2, 2, 2, 1, 1] as const;
export const THICKNESS = { min: 0.8, max: 1.4 } as const;

const COLOUR_TABLE: number[] = SPINE_WEIGHTS.flatMap((w, i) => new Array<number>(w).fill(i));

/** Fixed hash: spine looks never change between releases of the site. */
export function mix(id: number, salt: number): number {
	let h = (Math.imul(id | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
	h ^= h >>> 16;
	h = Math.imul(h, 0x7feb352d) >>> 0;
	h ^= h >>> 15;
	h = Math.imul(h, 0x846ca68b) >>> 0;
	return (h ^ (h >>> 16)) >>> 0;
}

function unitsOf(item: DiscogsCollectionItem): 1 | 2 | 4 {
	let total = 0;
	for (const f of item.basic_information.formats ?? []) {
		const q = parseInt(f.qty, 10);
		total += Number.isFinite(q) && q > 0 ? q : 1;
	}
	if (total <= 1) return 1;
	return total === 2 ? 2 : 4;
}

function heightOf(item: DiscogsCollectionItem): 1 | 0.9 | 0.56 {
	const d = (item.basic_information.formats ?? []).flatMap((f) => f.descriptions ?? []);
	if (d.includes('12"') || d.includes('LP')) return 1;
	if (d.includes('10"')) return 0.9;
	if (d.includes('7"')) return 0.56;
	return 1;
}

export function spineOf(item: DiscogsCollectionItem): Spine {
	const releaseId = item.basic_information.id;
	const units = unitsOf(item);
	const thickness = THICKNESS.min + ((THICKNESS.max - THICKNESS.min) * mix(releaseId, 1)) / 2 ** 32;
	return {
		key: item.instance_id,
		item,
		year: item.basic_information.year || 0,
		units,
		width: units * thickness,
		height: heightOf(item),
		colour: COLOUR_TABLE[mix(releaseId, 2) % COLOUR_TABLE.length]
	};
}

export function shelfOrder(items: DiscogsCollectionItem[]): Spine[] {
	const artist = (s: Spine) => s.item.basic_information.artists?.[0]?.name ?? '';
	return items.map(spineOf).sort((a, b) => {
		if ((a.year === 0) !== (b.year === 0)) return a.year === 0 ? 1 : -1;
		return (
			a.year - b.year ||
			artist(a).localeCompare(artist(b)) ||
			(a.item.basic_information.title ?? '').localeCompare(b.item.basic_information.title ?? '') ||
			String(a.key).localeCompare(String(b.key), undefined, { numeric: true })
		);
	});
}

export function shelfCount(total: number, perShelf: number): number {
	return Math.max(1, Math.ceil(total / perShelf));
}

/** Splits in order into exactly `count` shelves of about equal total width. */
export function splitShelves(spines: Spine[], count: number): Spine[][] {
	const n = Math.max(1, Math.floor(count));
	const rows: Spine[][] = Array.from({ length: n }, () => []);
	const total = spines.reduce((a, s) => a + s.width, 0);
	let before = 0;
	for (const s of spines) {
		const mid = before + s.width / 2;
		rows[Math.min(n - 1, Math.floor((mid / total) * n))].push(s);
		before += s.width;
	}
	return rows;
}

export function shelfTitle(shelf: Spine[]): string {
	const years = shelf.map((s) => s.year).filter((y) => y > 0);
	if (!years.length) return 'Year unknown';
	const lo = Math.min(...years);
	const hi = Math.max(...years);
	return lo === hi ? String(lo) : `${lo} to ${hi}`;
}

/** Which list the shelf draws while records are still loading. */
export function shelfSource<T>(
	prev: T[],
	s: { items: T[]; phase: LoaderPhase; background: boolean },
	storedComplete: boolean
): T[] {
	if (s.phase === 'done') return s.items;
	if (s.background) return prev;
	if (s.phase === 'error') return s.items.length ? s.items : prev;
	if (storedComplete) return prev;
	return s.items;
}
