// The share picture: the address it prints, the spines it draws, and its layout.
// One layout feeds both the preview on the page and the PNG drawn on a canvas,
// so the two always show the same thing, always in the light colours.

import type { CollectionStats } from '$lib/types/discogs';
import type { Spine } from '$lib/shelf/spines';
import { LIGHT, SPINES_LIGHT, SPINE_EDGE_LIGHT } from '$lib/theme/tokens';

/** The address of a profile on the host the page is on. */
export function shareAddress(host: string, username: string): string {
	return `${host}/u/${username}`;
}

/** `n` items spread evenly from the first to the last, in order; the whole list when it is shorter. */
export function sampleEvenly<T>(list: T[], n: number): T[] {
	if (list.length <= n) return [...list];
	if (n <= 0) return [];
	if (n === 1) return [list[0]];
	return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

/** The picture's size in its own units; the PNG is drawn at twice this. */
export const CARD = { width: 400, height: 500, pad: 33, frame: 3 } as const;

/** The site's web font (src/app.css, --font-sans), named for the canvas. */
export const CARD_FONT_FAMILY = 'Bricolage Grotesque Variable';

export function cardFont(size: number, weight: number): string {
	return `${weight} ${size}px '${CARD_FONT_FAMILY}', 'Segoe UI', system-ui, sans-serif`;
}

/** The width of `text` at `size` and `weight` in the card's font. */
export type Measure = (text: string, size: number, weight: number) => number;

export interface Fit {
	size: number;
	lines: string[];
}

/** The size, from `max` down, at which `text` fits `maxWidth` on one line. It always fits. */
export function fitLine(
	text: string,
	measure: Measure,
	{ weight, maxWidth, max }: { weight: number; maxWidth: number; max: number }
): number {
	let size = max;
	while (size > 0.25 && measure(text, size, weight) > maxWidth) size -= size > 4 ? 1 : 0.25;
	return size;
}

/**
 * Text in a block that shrinks, then wraps, and is never cut off. `pieces` joined
 * make the text, and a line may break only between pieces (the title breaks at its
 * spaces, the address before "/u/").
 * 1. One line, from `max` down to `min`.
 * 2. Else whole pieces on at most two lines, from `max` down to `floor`.
 * 3. Else at `floor`, a piece too long for a line is broken where it reaches the edge.
 */
export function fitBlock(
	pieces: string[],
	measure: Measure,
	{ weight, maxWidth, max, min, floor }: { weight: number; maxWidth: number; max: number; min: number; floor: number }
): Fit {
	const width = (s: string, size: number) => measure(s, size, weight);
	const text = pieces.join('');
	for (let size = max; size >= min; size--) {
		if (width(text, size) <= maxWidth) return { size, lines: [text] };
	}
	for (let size = max; size >= floor; size--) {
		const lines = pack(pieces, size, false);
		if (lines && lines.length <= 2) return { size, lines };
	}
	return { size: floor, lines: pack(pieces, floor, true)! };

	function pack(all: string[], size: number, split: boolean): string[] | null {
		const lines: string[] = [];
		let line = '';
		for (const piece of all) {
			if (width((line + piece).trim(), size) <= maxWidth) {
				line += piece;
				continue;
			}
			if (line.trim()) lines.push(line.trim());
			line = piece.trimStart();
			if (width(line, size) <= maxWidth) continue;
			if (!split) return null;
			while (width(line, size) > maxWidth) {
				let n = 1;
				while (n < line.length && width(line.slice(0, n + 1), size) <= maxWidth) n++;
				lines.push(line.slice(0, n));
				line = line.slice(n);
			}
		}
		if (line.trim()) lines.push(line.trim());
		return lines;
	}
}

export interface CardRect {
	kind: 'rect';
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
}

/** One line of text. `y` is the top of a line box as tall as the font size;
 *  `x` is the left edge, or the right edge when `align` is right. */
export interface CardText {
	kind: 'text';
	x: number;
	y: number;
	text: string;
	size: number;
	weight: number;
	fill: string;
	align: 'left' | 'right';
}

export type CardMark = CardRect | CardText;

export interface CardInput {
	username: string;
	address: string;
	stats: CollectionStats;
	badges: string[];
	/** Already sampled, in shelf order. */
	spines: Spine[];
}

/** The board grows into the room the text leaves, between these heights; a spine
 *  is at most 12 units per unit of thickness on a 104-unit board, as on the page. */
const BOARD = { min: 40, max: 104, ledge: 8, unitPerHeight: 12 / 104 } as const;
const ROW = 30;
const TEXT = 18;
const LINE = 20;

const count = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** The facts today's card shows, in sentence case; facts the stats lack are left out. */
function facts(s: CollectionStats): [string, string][] {
	const out: [string, string][] = [];
	if (s.dominantGenre) out.push(['Top genre', s.dominantGenre]);
	if (s.dominantDecade) out.push(['Favorite era', s.dominantDecade]);
	if (s.collectionSpan) out.push(['Year span', `${s.collectionSpan} years`]);
	if (s.averageYear) out.push(['Avg. year', String(s.averageYear)]);
	return out;
}

/** Everything on the picture, in drawing (and reading) order. */
export function layoutCard(c: CardInput, measure: Measure): CardMark[] {
	const { width: W, height: H, pad: P, frame: F } = CARD;
	const inner = W - 2 * P;
	const marks: CardMark[] = [];
	const rect = (x: number, y: number, w: number, h: number, fill: string) =>
		marks.push({ kind: 'rect', x, y, w, h, fill });
	const text = (t: string, x: number, y: number, size: number, weight: number, fill: string, align: 'left' | 'right' = 'left') =>
		marks.push({ kind: 'text', x, y, text: t, size, weight, fill, align });
	/** One line at `size`, or smaller to fit `maxWidth`, centred in a slot `slot` tall. */
	const line = (t: string, x: number, y: number, slot: number, size: number, weight: number, fill: string, maxWidth = inner, align: 'left' | 'right' = 'left') => {
		const fitted = fitLine(t, measure, { weight, maxWidth, max: size });
		text(t, x, y + (slot - fitted) / 2, fitted, weight, fill, align);
	};

	rect(0, 0, W, H, LIGHT.ground);
	rect(0, 0, W, F, LIGHT.ink);
	rect(0, H - F, W, F, LIGHT.ink);
	rect(0, 0, F, H, LIGHT.ink);
	rect(W - F, 0, F, H, LIGHT.ink);

	let y = P;
	text('Record Shelf', P, y, TEXT, 700, LIGHT.ink);
	y += TEXT + 18;

	const title = fitBlock(`${c.username}'s shelf`.split(/(?= )/), measure, { weight: 800, maxWidth: inner, max: 36, min: 30, floor: 24 });
	for (const l of title.lines) {
		text(l, P, y, title.size, 800, LIGHT.ink);
		y += title.size * 1.05;
	}

	y += 8;
	const { totalItems, totalArtists, totalLabels } = c.stats;
	line(`${count(totalItems, 'record')}, ${count(totalArtists, 'artist')}, ${count(totalLabels, 'label')}`, P, y, LINE, LINE, 400, LIGHT.muted);
	y += LINE;
	if (c.badges.length) {
		y += 6;
		line(c.badges.slice(0, 4).join(', '), P, y, LINE, LINE, 600, LIGHT.ink);
		y += LINE;
	}
	y += 20;

	// The address sits at the foot; the facts sit under the board; the board takes the room between.
	const address = fitBlock(c.address.split(/(?=\/u\/)/), measure, { weight: 400, maxWidth: inner, max: TEXT, min: 13, floor: 13 });
	const step = address.size * 1.15;
	const addressTop = H - P - address.size - step * (address.lines.length - 1);
	const rows = facts(c.stats);
	const room = addressTop - 16 - rows.length * ROW - 10 - BOARD.ledge - y;
	const board = Math.min(BOARD.max, Math.max(BOARD.min, room));

	// One shelf: the spines stand left-aligned on an ink board, filling it when there are enough.
	const units = c.spines.reduce((a, s) => a + s.width, 0);
	const unit = units > 0 ? Math.min(inner / units, board * BOARD.unitPerHeight) : 0;
	let x = P;
	for (const s of c.spines) {
		const w = s.width * unit;
		const h = s.height * board;
		const top = y + board - h;
		rect(x, top, w, h, SPINES_LIGHT[s.colour]);
		rect(x + w - Math.min(1, w), top, Math.min(1, w), h, SPINE_EDGE_LIGHT);
		x += w;
	}
	rect(P, y + board, inner, BOARD.ledge, LIGHT.ink);
	y += board + BOARD.ledge + 10;

	for (const [label, value] of rows) {
		text(label, P, y + (ROW - TEXT) / 2, TEXT, 400, LIGHT.muted);
		const beside = inner - measure(label, TEXT, 400) - 16;
		line(value, W - P, y, ROW, TEXT, 600, LIGHT.ink, beside, 'right');
		y += ROW;
	}

	let ay = addressTop;
	for (const l of address.lines) {
		text(l, P, ay, address.size, 400, LIGHT.muted);
		ay += step;
	}
	return marks;
}

/** A canvas measure in the card's font. */
export function canvasMeasure(ctx: CanvasRenderingContext2D): Measure {
	return (text, size, weight) => {
		ctx.font = cardFont(size, weight);
		return ctx.measureText(text).width;
	};
}

/** Draws the marks. Text is placed as CSS places a line box with line-height 1, so
 *  the PNG matches the preview. */
export function drawCard(ctx: CanvasRenderingContext2D, marks: CardMark[]): void {
	ctx.textBaseline = 'alphabetic';
	for (const m of marks) {
		ctx.fillStyle = m.fill;
		if (m.kind === 'rect') {
			ctx.fillRect(m.x, m.y, m.w, m.h);
			continue;
		}
		ctx.font = cardFont(m.size, m.weight);
		ctx.textAlign = m.align;
		const box = ctx.measureText(m.text);
		const ascent = box.fontBoundingBoxAscent ?? m.size * 0.8;
		const descent = box.fontBoundingBoxDescent ?? m.size * 0.2;
		ctx.fillText(m.text, m.x, m.y + (m.size + ascent - descent) / 2);
	}
}

/** "Copy text": today's text, with the address the page is really on. */
export function shareText(username: string, stats: CollectionStats, address: string): string {
	return `${username}'s Record Collection
${stats.totalItems} Records | ${stats.totalArtists} Artists | ${stats.totalLabels} Labels
Top Genre: ${stats.dominantGenre || 'Various'}
Dominant Era: ${stats.dominantDecade || 'Mixed'}
${address}`;
}
