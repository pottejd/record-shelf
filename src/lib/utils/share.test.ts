import { describe, it, expect } from 'vitest';
import {
	shareAddress,
	sampleEvenly,
	fitLine,
	fitBlock,
	layoutCard,
	shareText,
	CARD,
	type Measure,
	type CardMark,
	type CardText
} from './share';
import { LIGHT, SPINES_LIGHT, SPINE_EDGE_LIGHT } from '$lib/theme/tokens';
import { spineOf, type Spine } from '$lib/shelf/spines';
import type { CollectionStats, DiscogsCollectionItem } from '$lib/types/discogs';

/** A stand-in for the canvas: every character is 0.6em wide (0.65em when bold). */
const measure: Measure = (text, size, weight) => text.length * size * (weight >= 700 ? 0.65 : 0.6);

const stats = {
	totalItems: 679,
	totalArtists: 412,
	totalLabels: 230,
	dominantGenre: 'Folk, World, & Country',
	dominantDecade: '1970s',
	collectionSpan: 69,
	averageYear: 1984
} as CollectionStats;

function item(id: number): DiscogsCollectionItem {
	return {
		id,
		instance_id: id,
		folder_id: 1,
		rating: 0,
		date_added: '2024-01-01T00:00:00Z',
		basic_information: {
			id,
			title: `Record ${id}`,
			year: 1960 + (id % 60),
			artists: [{ id: 1, name: 'Someone', resource_url: '' }],
			formats: [{ name: 'Vinyl', qty: id % 5 === 0 ? '2' : '1', descriptions: ['LP'] }]
		}
	} as unknown as DiscogsCollectionItem;
}

const spines = (n: number): Spine[] => Array.from({ length: n }, (_, i) => spineOf(item(i + 1)));

type Rect = Extract<CardMark, { kind: 'rect' }>;

/** The ink board (as wide as the space inside the padding) and every rect standing on it. */
function shelfOf(marks: CardMark[]): { board: Rect; spines: Rect[] } {
	const rects = marks.filter((m): m is Rect => m.kind === 'rect');
	const board = rects.find((m) => m.fill === LIGHT.ink && m.x === CARD.pad && m.w === CARD.width - 2 * CARD.pad)!;
	expect(board).toBeDefined();
	return { board, spines: rects.filter((m) => m !== board && Math.abs(m.y + m.h - board.y) < 1e-9) };
}

const texts = (marks: CardMark[]) => marks.filter((m): m is CardText => m.kind === 'text');
const widthOf = (t: CardText) => measure(t.text, t.size, t.weight);
const left = (t: CardText) => (t.align === 'right' ? t.x - widthOf(t) : t.x);

function card(username: string, n = 64, badges = ['Curator', '70s purist', 'Hoarder', 'Crate digger']) {
	return layoutCard(
		{ username, address: shareAddress('record-shelf.pages.dev', username), stats, badges, spines: spines(n) },
		measure
	);
}

/** Every mark lies inside the picture; every text sits inside the frame's padding. */
function expectInside(marks: CardMark[]) {
	for (const m of marks) {
		if (m.kind === 'rect') {
			expect(m.x).toBeGreaterThanOrEqual(0);
			expect(m.y).toBeGreaterThanOrEqual(0);
			expect(m.x + m.w).toBeLessThanOrEqual(CARD.width + 1e-9);
			expect(m.y + m.h).toBeLessThanOrEqual(CARD.height + 1e-9);
		} else {
			expect(left(m)).toBeGreaterThanOrEqual(CARD.pad - 1e-9);
			expect(left(m) + widthOf(m)).toBeLessThanOrEqual(CARD.width - CARD.pad + 1e-9);
			expect(m.y).toBeGreaterThanOrEqual(CARD.pad);
			expect(m.y + m.size).toBeLessThanOrEqual(CARD.height - CARD.pad + 1e-9);
		}
	}
}

/** Texts that share any height lie apart side by side, so no line runs into another. */
function expectNoOverlap(marks: CardMark[]) {
	const t = texts(marks);
	for (let i = 0; i < t.length; i++) {
		for (let j = i + 1; j < t.length; j++) {
			const sameRow = t[i].y < t[j].y + t[j].size && t[j].y < t[i].y + t[i].size;
			if (sameRow) {
				// A fact's label and value share a row: they must not touch.
				const [a, b] = [t[i], t[j]].sort((p, q) => left(p) - left(q));
				expect(left(a) + widthOf(a)).toBeLessThan(left(b));
			} else {
				const [a, b] = [t[i], t[j]].sort((p, q) => p.y - q.y);
				expect(a.y + a.size).toBeLessThanOrEqual(b.y + 1e-9);
			}
		}
	}
}

describe('shareAddress', () => {
	it('is the host, /u/ and the name', () => {
		expect(shareAddress('record-shelf.pages.dev', 'bob')).toBe('record-shelf.pages.dev/u/bob');
		expect(shareAddress('localhost:4173', 'bob')).toBe('localhost:4173/u/bob');
	});
});

describe('sampleEvenly', () => {
	const hundred = Array.from({ length: 100 }, (_, i) => i);

	it('spreads n picks from the first to the last', () => {
		expect(sampleEvenly(hundred, 4)).toEqual([0, 33, 66, 99]);
	});

	it('returns the whole list when it is shorter than n', () => {
		expect(sampleEvenly(['a', 'b', 'c'], 64)).toEqual(['a', 'b', 'c']);
	});

	it('returns nothing for n 0, and the first for n 1', () => {
		expect(sampleEvenly(hundred, 0)).toEqual([]);
		expect(sampleEvenly(hundred, 1)).toEqual([0]);
		expect(sampleEvenly([], 64)).toEqual([]);
	});

	it('keeps the order and never repeats', () => {
		const picked = sampleEvenly(hundred, 64);
		expect(picked).toHaveLength(64);
		expect(picked).toEqual([...picked].sort((a, b) => a - b));
		expect(new Set(picked).size).toBe(64);
	});
});

describe('fitLine', () => {
	it('keeps the size when the text fits, and shrinks until it does, however long', () => {
		expect(fitLine('bob', measure, { weight: 400, maxWidth: 300, max: 20 })).toBe(20);
		const long = 'x'.repeat(200);
		const size = fitLine(long, measure, { weight: 400, maxWidth: 334, max: 20 });
		expect(size).toBeGreaterThan(0);
		expect(measure(long, size, 400)).toBeLessThanOrEqual(334);
	});
});

describe('fitBlock', () => {
	const opts = { weight: 800, maxWidth: 334, max: 36, min: 30, floor: 24 };
	const pieces = (t: string) => t.split(/(?= )/);

	it('keeps one line at the largest size that fits, down to min', () => {
		expect(fitBlock(pieces("bob's shelf"), measure, opts)).toEqual({ size: 36, lines: ["bob's shelf"] });
		const fit = fitBlock(pieces("bobbybob's shelf"), measure, opts);
		expect(fit.lines).toEqual(["bobbybob's shelf"]);
		expect(fit.size).toBeGreaterThanOrEqual(30);
	});

	it('then breaks between pieces onto two lines, shrinking no further than floor', () => {
		const fit = fitBlock(pieces("abcdefghijklmn's shelf"), measure, opts);
		expect(fit.lines).toEqual(["abcdefghijklmn's", 'shelf']);
		expect(fit.size).toBeGreaterThanOrEqual(24);
		for (const line of fit.lines) expect(measure(line, fit.size, 800)).toBeLessThanOrEqual(334);
	});

	it('at floor, breaks a piece too long for a line where it reaches the edge, losing nothing', () => {
		const name = 'abcdefghijklmnopqrstuvwxyz1234';
		const fit = fitBlock(pieces(`${name}'s shelf`), measure, opts);
		expect(fit.size).toBe(24);
		expect(fit.lines.join('').replace(/ /g, '')).toBe(`${name}'sshelf`);
		for (const line of fit.lines) expect(measure(line, fit.size, 800)).toBeLessThanOrEqual(334);
	});

	it('breaks the address before /u/', () => {
		const address = 'record-shelf.pages.dev/u/abcdefghijklmnopqrstuvwxyz1234';
		const fit = fitBlock(address.split(/(?=\/u\/)/), measure, { weight: 400, maxWidth: 334, max: 18, min: 13, floor: 13 });
		expect(fit.lines).toEqual(['record-shelf.pages.dev', '/u/abcdefghijklmnopqrstuvwxyz1234']);
	});
});

describe('layoutCard', () => {
	it('is drawn on the ground in a frame, title in ink at weight 800', () => {
		const marks = card('bob');
		expect(marks[0]).toEqual({ kind: 'rect', x: 0, y: 0, w: CARD.width, h: CARD.height, fill: LIGHT.ground });
		const title = texts(marks).find((t) => t.text === "bob's shelf");
		expect(title).toMatchObject({ weight: 800, fill: LIGHT.ink });
	});

	it('shows the facts of today’s card, in sentence case, and the address in muted text', () => {
		const t = texts(card('bob')).map((m) => m.text);
		expect(t).toContain('Record Shelf');
		expect(t).toContain('679 records, 412 artists, 230 labels');
		expect(t).toContain('Curator, 70s purist, Hoarder, Crate digger');
		for (const s of ['Top genre', 'Folk, World, & Country', 'Favorite era', '1970s', 'Year span', '69 years', 'Avg. year', '1984']) {
			expect(t).toContain(s);
		}
		const address = texts(card('bob')).find((m) => m.text === 'record-shelf.pages.dev/u/bob');
		expect(address).toMatchObject({ fill: LIGHT.muted });
	});

	it('draws 64 spines on an ink board in the spine colours, filling the board', () => {
		const marks = card('bob');
		const { board, spines: onBoard } = shelfOf(marks);
		const colours = onBoard.filter((m) => SPINES_LIGHT.includes(m.fill));
		expect(colours).toHaveLength(64);
		expect(onBoard.filter((m) => m.fill === SPINE_EDGE_LIGHT)).toHaveLength(64);
		expect(Math.min(...colours.map((m) => m.x))).toBe(CARD.pad);
		expect(Math.max(...colours.map((m) => m.x + m.w))).toBeCloseTo(board.x + board.w, 6);
	});

	it('puts a few spines at the left of the board, and draws the bare board when empty', () => {
		const { spines: onBoard } = shelfOf(card('bob', 3));
		expect(onBoard.filter((m) => SPINES_LIGHT.includes(m.fill) && m.w > 1)).toHaveLength(3);
		expect(Math.min(...onBoard.map((m) => m.x))).toBe(CARD.pad);
		expect(Math.max(...onBoard.map((m) => m.x + m.w))).toBeLessThan(CARD.width / 2);

		const empty = card('bob', 0);
		expect(shelfOf(empty).spines).toEqual([]);
		expectInside(empty);
	});

	it('fits a 30-character name: nothing is cut off, nothing leaves the picture, nothing overlaps', () => {
		for (const name of ['abcdefghijklmnopqrstuvwxyz1234', 'abcdefghijklmn', 'bob', 'a'.repeat(50)]) {
			const marks = card(name);
			expectInside(marks);
			expectNoOverlap(marks);
			const all = texts(marks).map((t) => t.text).join(' ');
			expect(all.replace(/\s+/g, '')).toContain(`${name}'sshelf`);
			expect(all.replace(/\s+/g, '')).toContain(`record-shelf.pages.dev/u/${name}`);
		}
	});

	it('leaves out facts the stats do not have, as today', () => {
		const bare = { ...stats, dominantGenre: '', dominantDecade: '', collectionSpan: 0, averageYear: 0 } as CollectionStats;
		const t = texts(
			layoutCard({ username: 'bob', address: 'h/u/bob', stats: bare, badges: [], spines: [] }, measure)
		).map((m) => m.text);
		expect(t).not.toContain('Top genre');
		expect(t).not.toContain('Avg. year');
		expect(t).toContain('679 records, 412 artists, 230 labels');
	});
});

describe('shareText', () => {
	it('keeps today’s text with the real address', () => {
		expect(shareText('bob', stats, 'record-shelf.pages.dev/u/bob')).toBe(
			"bob's Record Collection\n679 Records | 412 Artists | 230 Labels\nTop Genre: Folk, World, & Country\nDominant Era: 1970s\nrecord-shelf.pages.dev/u/bob"
		);
	});
});
