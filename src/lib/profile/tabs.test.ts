import { describe, it, expect } from 'vitest';
import { tabFromUrl, tabHref, stepTab, recordsHref, TABS, TAB_LABELS } from './tabs';

const u = (q: string) => new URL(`https://x.test/u/bob${q}`);

describe('profile tabs', () => {
	it('has five tabs with sentence-case labels', () => {
		expect(TABS.map((t) => TAB_LABELS[t])).toEqual(['Overview', 'Records', 'Charts', 'Activity', 'Extras']);
	});

	it('reads the tab', () => {
		expect(tabFromUrl(u(''))).toBe('overview');
		expect(tabFromUrl(u('?tab=charts'))).toBe('charts');
		expect(tabFromUrl(u('?tab=bogus'))).toBe('overview');
		expect(tabFromUrl(u('?tab=RECORDS'))).toBe('overview');
	});

	it('an old filter link with no tab opens Records', () => {
		expect(tabFromUrl(u('?genre=Rock'))).toBe('records');
		expect(tabFromUrl(u('?search=abc&page=2'))).toBe('records');
		expect(tabFromUrl(u('?tab=charts&genre=Rock'))).toBe('charts');
		expect(tabFromUrl(u('?utm=x'))).toBe('overview');
	});

	it('builds tab links and drops everything else', () => {
		expect(tabHref(u('?tab=records&genre=Rock'), 'overview')).toBe('/u/bob');
		expect(tabHref(u('?genre=Rock'), 'charts')).toBe('/u/bob?tab=charts');
	});

	it('steps and stops', () => {
		expect(stepTab('overview', -1)).toBe('overview');
		expect(stepTab('overview', 1)).toBe('records');
		expect(stepTab('extras', 1)).toBe('extras');
	});

	it('builds Records addresses', () => {
		const d = { search: '', genre: '', format: '', decade: '', sort: 'added', order: 'desc', page: 1 } as const;
		expect(recordsHref(u('?tab=records'), d)).toBe('/u/bob?tab=records');
		expect(recordsHref(u(''), { ...d, genre: 'Folk, World, & Country', page: 3 })).toBe(
			'/u/bob?tab=records&genre=Folk%2C+World%2C+%26+Country&page=3'
		);
		expect(recordsHref(u(''), { ...d, sort: 'year', order: 'asc' })).toBe('/u/bob?tab=records&sort=year&order=asc');
	});
});
