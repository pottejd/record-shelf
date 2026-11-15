import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	LIGHT,
	DARK,
	SPINES_LIGHT,
	SPINES_DARK,
	CHART_LIGHT,
	CHART_DARK,
	CHART_OTHER_LIGHT,
	CHART_OTHER_DARK,
	SHADES_LIGHT,
	SHADES_DARK,
	SHADE_TEXT_LIGHT,
	SHADE_TEXT_DARK,
	SPINE_EDGE_LIGHT,
	type Palette
} from './tokens';

/** The text between the braces of the first block whose selector is exactly `selector`. */
function block(source: string, selector: string, from = 0): string {
	const at = source.indexOf(selector + ' {', from);
	if (at < 0) throw new Error(`no block for ${selector}`);
	let depth = 0;
	for (let i = source.indexOf('{', at); i < source.length; i++) {
		if (source[i] === '{') depth++;
		if (source[i] === '}' && --depth === 0) return source.slice(source.indexOf('{', at) + 1, i);
	}
	throw new Error(`unbalanced block for ${selector}`);
}

function pairs(body: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
	return out;
}

const css = readFileSync(fileURLToPath(new URL('../../app.css', import.meta.url)), 'utf8');

const root = pairs(block(css, ':root'));
const darkAttr = pairs(block(css, 'html[data-theme="dark"]'));
const mediaStart = css.indexOf('@media (prefers-color-scheme: dark)');
const darkMedia = pairs(block(css, 'html:not([data-theme="light"])', mediaStart));

function expectPalette(vars: Record<string, string>, p: Palette) {
	expect(vars['--ground']).toBe(p.ground);
	expect(vars['--ink']).toBe(p.ink);
	expect(vars['--muted']).toBe(p.muted);
	expect(vars['--hairline']).toBe(p.hairline);
	expect(vars['--track']).toBe(p.track);
	expect(vars['--accent']).toBe(p.accent);
	expect(vars['--on-ink']).toBe(p.onInk);
}

function expectSets(
	vars: Record<string, string>,
	spines: string[],
	chart: string[],
	other: string,
	shades: string[],
	shadeText: string[]
) {
	spines.forEach((c, i) => expect(vars[`--spine-${i + 1}`]).toBe(c));
	chart.forEach((c, i) => expect(vars[`--chart-${i + 1}`]).toBe(c));
	expect(vars['--chart-other']).toBe(other);
	shades.forEach((c, i) => expect(vars[`--shade-${i + 1}`]).toBe(c));
	shadeText.forEach((c, i) => expect(vars[`--shade-${i + 1}-text`]).toBe(c));
}

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe('tokens', () => {
	it('light tokens in app.css match tokens.ts', () => {
		expectPalette(root, LIGHT);
		expectSets(root, SPINES_LIGHT, CHART_LIGHT, CHART_OTHER_LIGHT, SHADES_LIGHT, SHADE_TEXT_LIGHT);
		expect(root['--spine-edge']).toBe('rgba(24,32,28,0.3)');
		expect(SPINE_EDGE_LIGHT).toBe(root['--spine-edge']);
		expect(root['--cover-edge']).toBe('rgba(24,32,28,0.12)');
	});

	it('dark tokens match tokens.ts in both dark blocks', () => {
		expect(Object.keys(darkAttr).length).toBeGreaterThan(0);
		expect(darkAttr).toEqual(darkMedia);
		expectPalette(darkAttr, DARK);
		expectSets(darkAttr, SPINES_DARK, CHART_DARK, CHART_OTHER_DARK, SHADES_DARK, SHADE_TEXT_DARK);
		expect(darkAttr['--spine-edge']).toBe('rgba(0,0,0,0.45)');
		expect(darkAttr['--cover-edge']).toBe('rgba(232,235,227,0.16)');
	});

	it('the fixed sizes are declared', () => {
		expect(root['--rule']).toBe('4px');
		expect(root['--section-gap']).toBe('56px');
		expect(root['--page-max']).toBe('1280px');
		expect(root['--page-pad']).toBe('clamp(20px, 4.4%, 56px)');
		expect(root['--control']).toBe('52px');
		expect(root['--touch']).toBe('44px');
		expect(root['--font-sans']).toContain('Bricolage Grotesque Variable');
	});

	it('text colours clear 4.5:1 on their ground', () => {
		for (const t of [LIGHT, DARK]) {
			expect(contrast(t.ink, t.ground)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(t.muted, t.ground)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(t.accent, t.ground)).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('every shade holds ink or ground text at 4.5:1', () => {
		for (const [t, shades] of [
			[LIGHT, SHADES_LIGHT],
			[DARK, SHADES_DARK]
		] as const) {
			for (const s of shades) {
				const best = Math.max(contrast(s, t.ink), contrast(s, t.ground));
				expect(best).toBeGreaterThanOrEqual(4.5);
			}
		}
	});

	it('the text on each shade is whichever of ink or ground reads better there', () => {
		for (const [t, shades, text] of [
			[LIGHT, SHADES_LIGHT, SHADE_TEXT_LIGHT],
			[DARK, SHADES_DARK, SHADE_TEXT_DARK]
		] as const) {
			expect(text).toHaveLength(shades.length);
			shades.forEach((s, i) => {
				const better = contrast(s, t.ink) >= contrast(s, t.ground) ? t.ink : t.ground;
				expect(text[i]).toBe(better);
				expect(contrast(s, text[i])).toBeGreaterThanOrEqual(4.5);
			});
		}
	});
});
