import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The look guard. Every .svelte file under src/ and src/app.css (outside its
 * token blocks) must stay inside the Shelf look: no colour literals, gradients
 * (other than repeating ones), shadows (other than inset), rounded corners
 * (other than 0 and 50%), old colour/gradient/shadow variables, or all-caps.
 *
 * PENDING lists files not converted yet. A task that converts a file removes
 * its entry; a task that deletes or moves a pending file removes its entry too.
 * Files not listed here, including every new file, are checked from the start.
 */
export const PENDING: string[] = [
	'src/lib/components/ArtistLoyalty.svelte',
	'src/lib/components/BarChart.svelte',
	'src/lib/components/browser/FilterControls.svelte',
	'src/lib/components/browser/Pagination.svelte',
	'src/lib/components/browser/RecordCard.svelte',
	'src/lib/components/browser/SearchBar.svelte',
	'src/lib/components/browser/SortToolbar.svelte',
	'src/lib/components/CollectingActivity.svelte',
	'src/lib/components/CollectingCalendar.svelte',
	'src/lib/components/CollectionBrowser.svelte',
	'src/lib/components/CollectionDNA.svelte',
	'src/lib/components/CollectionDrawer.svelte',
	'src/lib/components/CollectionExport.svelte',
	'src/lib/components/CollectionQuiz.svelte',
	'src/lib/components/CollectionTimeline.svelte',
	'src/lib/components/CoverGrid.svelte',
	'src/lib/components/DayPatterns.svelte',
	'src/lib/components/DonutChart.svelte',
	'src/lib/components/DuplicateDetector.svelte',
	'src/lib/components/FormatDrilldown.svelte',
	'src/lib/components/FormatUpgrades.svelte',
	'src/lib/components/GenreEvolution.svelte',
	'src/lib/components/KeyboardHelp.svelte',
	'src/lib/components/LazyImage.svelte',
	'src/lib/components/LazySection.svelte',
	'src/lib/components/Milestones.svelte',
	'src/lib/components/NewVsVintage.svelte',
	'src/lib/components/profile/LoadingBanner.svelte',
	'src/lib/components/profile/OldestNewestHighlights.svelte',
	'src/lib/components/profile/ProfileActivity.svelte',
	'src/lib/components/profile/ProfileCharts.svelte',
	'src/lib/components/profile/ProfileCollection.svelte',
	'src/lib/components/profile/ProfileHeader.svelte',
	'src/lib/components/profile/ProfileInsights.svelte',
	'src/lib/components/profile/ProfileOverview.svelte',
	'src/lib/components/profile/ProfileShare.svelte',
	'src/lib/components/RandomPicker.svelte',
	'src/lib/components/RatingsOverview.svelte',
	'src/lib/components/RecentlyAdded.svelte',
	'src/lib/components/Recommendations.svelte',
	'src/lib/components/SectionNav.svelte',
	'src/lib/components/ShareableCard.svelte',
	'src/lib/components/SkeletonProfile.svelte',
	'src/lib/components/SkeletonWantlist.svelte',
	'src/lib/components/StatCard.svelte',
	'src/lib/components/TimelineChart.svelte',
	'src/lib/components/TopList.svelte',
	'src/lib/components/ValueEstimate.svelte',
	'src/lib/components/YearHeatmap.svelte',
	'src/routes/+error.svelte',
	'src/routes/+layout.svelte',
	'src/routes/+page.svelte',
	'src/routes/compare/+page.svelte',
	'src/routes/compare/[user1=username]/[user2=username]/+page.svelte',
	'src/routes/settings/+page.svelte',
	'src/routes/u/[username=username]/+page.svelte',
	'src/routes/u/[username=username]/wantlist/+page.svelte'
];

export interface Violation {
	line: number;
	rule: string;
	text: string;
}

const HEX = '[0-9a-fA-F]';
// A hex colour: # then exactly 3, 4, 6 or 8 hex digits, ending there.
// Not after a word character, "&" (numeric entity), "{" (Svelte block tag) or "/"
// (URL fragment); not followed by "{" (a selector such as #feed {).
const HEX_COLOUR = new RegExp(
	`(?<![\\w&{/])#(?:${HEX}{8}|${HEX}{6}|${HEX}{4}|${HEX}{3})(?![\\w-])(?!\\s*\\{)`,
	'g'
);
// An anchor or id value such as href="#decade" is not a colour even if every letter is a hex digit.
const ANCHOR_BEFORE = /(?:href|id|for|name|aria-[a-z]+)\s*=\s*["']?$/;

const RULES: { rule: string; test: (line: string) => boolean }[] = [
	{
		rule: 'hex colour',
		test: (line) =>
			[...line.matchAll(HEX_COLOUR)].some((m) => !ANCHOR_BEFORE.test(line.slice(0, m.index)))
	},
	{ rule: 'rgb/rgba/hsl colour', test: (line) => /(?<![\w-])(?:rgba?|hsla?)\(/i.test(line) },
	{ rule: 'linear-gradient', test: (line) => /(?<!repeating-)linear-gradient\(/.test(line) },
	{ rule: 'radial-gradient', test: (line) => /radial-gradient\(/.test(line) },
	{
		rule: 'box-shadow other than inset or none',
		test: (line) =>
			[...line.matchAll(/box-shadow\s*:\s*([^;}"']*)/g)].some(
				(m) => !/^(?:inset\b|none\b)/.test(m[1].trim())
			)
	},
	{
		rule: 'border-radius other than 0 or 50%',
		test: (line) =>
			[...line.matchAll(/border-radius\s*:\s*([^;}"']*)/g)].some(
				(m) => !/^(?:0|50%)(?:px)?\s*(?:!important)?$/.test(m[1].trim())
			)
	},
	{ rule: 'old colour variable', test: (line) => /var\(--color-/.test(line) },
	{ rule: 'old gradient variable', test: (line) => /var\(--gradient-/.test(line) },
	{ rule: 'old shadow variable', test: (line) => /var\(--shadow-/.test(line) },
	{ rule: 'uppercase text', test: (line) => /text-transform\s*:\s*uppercase/.test(line) }
];

export function findViolations(text: string): Violation[] {
	const found: Violation[] = [];
	text.split('\n').forEach((line, i) => {
		for (const { rule, test } of RULES) {
			if (test(line)) found.push({ line: i + 1, rule, text: line.trim() });
		}
	});
	return found;
}

/** Blank out the token blocks of app.css, keeping line numbers. */
export function withoutTokenBlocks(css: string): string {
	const selectors = [
		':root {',
		'html[data-theme="dark"] {',
		'@media (prefers-color-scheme: dark) {'
	];
	let out = css;
	for (const selector of selectors) {
		const at = out.indexOf(selector);
		if (at < 0) continue;
		let depth = 0;
		let end = at;
		for (let i = at; i < out.length; i++) {
			if (out[i] === '{') depth++;
			if (out[i] === '}' && --depth === 0) {
				end = i + 1;
				break;
			}
		}
		out = out.slice(0, at) + out.slice(at, end).replace(/[^\n]/g, ' ') + out.slice(end);
	}
	return out;
}

const appCss = readFileSync(fileURLToPath(new URL('../../app.css', import.meta.url)), 'utf8');

// Every .svelte file under src/, as text, keyed by repo-relative path.
const svelteFiles = Object.fromEntries(
	Object.entries(
		import.meta.glob('/src/**/*.svelte', { query: '?raw', import: 'default', eager: true })
	).map(([path, text]) => [path.slice(1), text as string])
);

describe('look guard', () => {
	const files: Record<string, string> = {
		...Object.fromEntries(Object.entries(svelteFiles).filter(([p]) => !PENDING.includes(p))),
		'src/app.css': withoutTokenBlocks(appCss)
	};

	for (const [file, text] of Object.entries(files)) {
		it(`${file} keeps to the Shelf look`, () => {
			const found = findViolations(text).map((v) => `${file}:${v.line} ${v.rule}: ${v.text}`);
			expect(found).toEqual([]);
		});
	}

	it('every pending file exists', () => {
		expect(PENDING.filter((p) => !(p in svelteFiles))).toEqual([]);
	});
});

describe('the guard matcher', () => {
	const rules = (s: string) => findViolations(s).map((v) => v.rule);

	it('catches real colour literals', () => {
		expect(rules('color: #fff;')).toEqual(['hex colour']);
		expect(rules('color: #ABCD;')).toEqual(['hex colour']);
		expect(rules('background: #6366f1;')).toEqual(['hex colour']);
		expect(rules('x: #11223344;')).toEqual(['hex colour']);
		expect(rules('background: linear-gradient(#fff, #000);')).toContain('hex colour');
		expect(rules('<rect fill="#6366f1" />')).toEqual(['hex colour']);
		expect(rules("const c = '#6366f1';")).toEqual(['hex colour']);
		expect(rules('<div style="color:#abc">')).toEqual(['hex colour']);
		expect(rules('a: rgb(1, 2, 3)')).toEqual(['rgb/rgba/hsl colour']);
		expect(rules('a: rgba(0,0,0,.3)')).toEqual(['rgb/rgba/hsl colour']);
		expect(rules('a: hsl(10 20% 30%)')).toEqual(['rgb/rgba/hsl colour']);
	});

	it('lets entities, block tags, anchors and selectors through', () => {
		expect(rules('<p>it&#8217;s &#x2019; &#128512;</p>')).toEqual([]);
		expect(rules('{#each items as item}')).toEqual([]);
		expect(rules('{#if ok}{/if}{#snippet row()}')).toEqual([]);
		expect(rules('<a href="#decade">Decade</a>')).toEqual([]);
		expect(rules('<section id="#facade">')).toEqual([]);
		expect(rules('goto(`/u/x#decade`)')).toEqual([]);
		expect(rules('#feed { margin: 0 }')).toEqual([]);
		expect(rules('a: #1234567;')).toEqual([]); // 7 digits is not a colour
	});

	it('catches gradients, shadows, radii, old variables and all-caps', () => {
		expect(rules('background: linear-gradient(red, blue);')).toEqual(['linear-gradient']);
		expect(rules('background: repeating-linear-gradient(red, blue);')).toEqual([]);
		expect(rules('background: radial-gradient(red, blue);')).toEqual(['radial-gradient']);
		expect(rules('box-shadow: 0 1px 2px var(--ink);')).toEqual([
			'box-shadow other than inset or none'
		]);
		expect(rules('box-shadow: inset 0 0 0 1px var(--ink);')).toEqual([]);
		expect(rules('box-shadow: none;')).toEqual([]);
		expect(rules('border-radius: 8px;')).toEqual(['border-radius other than 0 or 50%']);
		expect(rules('border-radius: 0;')).toEqual([]);
		expect(rules('border-radius: 50%;')).toEqual([]);
		expect(rules('color: var(--color-text);')).toEqual(['old colour variable']);
		expect(rules('background: var(--gradient-brand);')).toEqual(['old gradient variable']);
		expect(rules('box-shadow: var(--shadow-md);')).toEqual([
			'box-shadow other than inset or none',
			'old shadow variable'
		]);
		expect(rules('text-transform: uppercase;')).toEqual(['uppercase text']);
	});

	it('reports the line number and leaves token blocks of app.css out', () => {
		expect(findViolations('a\nb\ncolor: #fff;')[0].line).toBe(3);
		const css = ':root {\n\t--a: #fff;\n}\nhtml {\n\tcolor: #fff;\n}';
		expect(findViolations(withoutTokenBlocks(css)).map((v) => v.line)).toEqual([5]);
	});
});
