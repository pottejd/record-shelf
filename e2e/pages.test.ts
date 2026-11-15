import { test, expect, type Page } from '@playwright/test';
import { makeCollection, mockStored, mockStoredWantlist, withToken } from './fixtures/collection';

// The pages outside the profile, in the shelf look: the wantlist grid matches the
// Records grid, nothing scrolls sideways on a phone (even with a 30-character
// name in the title), and the Compare result names both people in its legend.

/** Thirty characters with no place to break: the worst case for a title. */
const LONG = 'abcdefghijklmnopqrstuvwxyz0123';

test.beforeEach(async ({ page: pw }) => {
	await withToken(pw);
});

/** Waits for fonts and for the background refresh and its status line to finish. */
async function settled(pw: Page): Promise<void> {
	await pw.evaluate(() => document.fonts.ready);
	await pw.waitForLoadState('networkidle');
}

const sidewaysScroll = (pw: Page) => pw.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [width, columns] of [[1280, 6], [390, 2]] as const) {
	test(`the wantlist grid has ${columns} columns at ${width}px`, async ({ page: pw }) => {
		await pw.setViewportSize({ width, height: 900 });
		await mockStoredWantlist(pw, 'wantuser', 40);
		await pw.goto('/u/wantuser/wantlist');
		await expect(pw.locator('h1')).toHaveText("wantuser's wantlist");
		await settled(pw);
		const grid = pw.locator('.wantlist-grid');
		await expect(grid.locator('.item-card')).toHaveCount(40);
		expect(await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns);
	});
}

test.describe('nothing scrolls sideways at 390px', () => {
	test.beforeEach(async ({ page: pw }) => {
		await pw.setViewportSize({ width: 390, height: 844 });
	});

	test('home, with its validation message', async ({ page: pw }) => {
		await pw.goto('/');
		await pw.getByRole('button', { name: 'Explore' }).click();
		await expect(pw.getByText('Please enter a username')).toBeVisible();
		await settled(pw);
		expect(await sidewaysScroll(pw)).toBe(0);
	});

	test('Settings', async ({ page: pw }) => {
		await pw.goto('/settings?redirect=/u/someone');
		await expect(pw.locator('h1')).toContainText('Settings');
		await settled(pw);
		expect(await sidewaysScroll(pw)).toBe(0);
	});

	test('the Compare form, with its error', async ({ page: pw }) => {
		await pw.goto('/compare');
		await pw.getByLabel('First collector').fill(LONG);
		await pw.getByLabel('Second collector').fill(LONG);
		await expect(pw.getByText('Enter two different usernames to compare')).toBeVisible();
		await settled(pw);
		expect(await sidewaysScroll(pw)).toBe(0);
	});

	test('a Compare result with a 30-character name', async ({ page: pw }) => {
		await mockStored(pw, LONG, makeCollection(300));
		await mockStored(pw, 'friend', makeCollection(200, 2));
		await pw.goto(`/compare/${LONG}/friend`);
		await expect(pw.locator('h1')).toContainText(`${LONG} vs friend`);
		await expect(pw.getByRole('heading', { name: 'Decade comparison' })).toBeVisible();
		await settled(pw);
		expect(await sidewaysScroll(pw)).toBe(0);
	});

	test('the wantlist with a 30-character name', async ({ page: pw }) => {
		await mockStoredWantlist(pw, LONG, 30);
		await pw.goto(`/u/${LONG}/wantlist`);
		await expect(pw.locator('h1')).toHaveText(`${LONG}'s wantlist`);
		await settled(pw);
		expect(await sidewaysScroll(pw)).toBe(0);
	});

	test('the error page', async ({ page: pw }) => {
		const res = await pw.goto('/no/such/page');
		expect(res?.status()).toBe(404);
		await expect(pw.locator('h1')).toHaveText('Not found');
		await expect(pw.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
		await settled(pw);
		expect(await sidewaysScroll(pw)).toBe(0);
	});
});

test('the Compare result names both people beside their colours, and every number says whose it is', async ({ page: pw }) => {
	await mockStored(pw, 'firstfan', makeCollection(300));
	await mockStored(pw, 'secondfan', makeCollection(200, 2));
	await pw.goto('/compare/firstfan/secondfan');
	const decades = pw.locator('section', { has: pw.getByRole('heading', { name: 'Decade comparison' }) });
	await expect(decades).toBeVisible();
	await settled(pw);

	const legend = decades.locator('.legend');
	await expect(legend).toContainText('firstfan');
	await expect(legend).toContainText('secondfan');
	// Each name sits beside a swatch in its chart colour: the first person colour 1, the second colour 2.
	const swatches = await legend.locator('.swatch').evaluateAll((els) => els.map((el) => el.getAttribute('style')));
	expect(swatches).toEqual(['background: var(--chart-1);', 'background: var(--chart-2);']);

	// Every number is visible text, and names its person for a screen reader too.
	const rows = decades.locator('.pair-row');
	expect(await rows.count()).toBeGreaterThan(3);
	const first = rows.first();
	await expect(first.locator('.side-1 .num')).toBeVisible();
	await expect(first.locator('.side-1 .num')).toContainText(/^firstfan: \d/);
	await expect(first.locator('.side-2 .num')).toContainText(/^secondfan: \d/);
});
