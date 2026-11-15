import { test, expect } from '@playwright/test';
import { makeCollection, mockStored, withToken } from './fixtures/collection';

test.beforeEach(async ({ page: pw }) => {
	await withToken(pw);
});

test('a tab changes the address and the content, and Back returns', async ({ page: pw }) => {
	const net = await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('#overview')).toBeVisible();
	await expect(pw.locator('#overview')).toContainText('150');
	// The fixture's copy is older than a day, so a background refresh follows the
	// first load; let it finish before counting.
	await pw.waitForLoadState('networkidle');
	const before = net.collectionCalls();
	await pw.getByRole('link', { name: 'Charts' }).click();
	await expect(pw).toHaveURL(/\/u\/tabuser\?tab=charts$/);
	await expect(pw.locator('#charts')).toBeVisible();
	await expect(pw.locator('#overview')).toHaveCount(0);
	await expect(pw.getByRole('link', { name: 'Charts' })).toHaveAttribute('aria-current', 'page');
	expect(net.collectionCalls()).toBe(before); // no reload of data
	expect(net.discogsCalls()).toBe(0);
	await pw.goBack();
	await expect(pw.locator('#overview')).toBeVisible();
	await expect(pw).toHaveURL(/\/u\/tabuser$/);
	expect(net.collectionCalls()).toBe(before);
	expect(net.discogsCalls()).toBe(0);
});

test('a link opens on its tab; an unknown tab shows Overview', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=activity');
	await expect(pw.locator('#activity')).toBeVisible();
	await expect(pw.getByRole('link', { name: 'Activity' })).toHaveAttribute('aria-current', 'page');
	await pw.goto('/u/tabuser?tab=bogus');
	await expect(pw.locator('#overview')).toBeVisible();
	await expect(pw.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
});

test('Records filters live next to the tab and survive Back', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records');
	await expect(pw.locator('#records')).toBeVisible();
	// Until Task 11 the selects sit behind the "Filters" button.
	await pw.getByRole('button', { name: 'Filters' }).click();
	await pw.getByLabel('Genre', { exact: true }).selectOption('Jazz');
	await expect(pw).toHaveURL(/\?tab=records&genre=Jazz$/);

	await pw.getByRole('link', { name: 'Charts' }).click();
	await expect(pw).toHaveURL(/\/u\/tabuser\?tab=charts$/);
	await expect(pw.locator('#charts')).toBeVisible();

	await pw.goBack();
	await expect(pw.locator('#records')).toBeVisible();
	await expect(pw).toHaveURL(/\?tab=records&genre=Jazz$/);
	await pw.getByRole('button', { name: 'Filters' }).click();
	await expect(pw.getByLabel('Genre', { exact: true })).toHaveValue('Jazz');
});

test('clicking the open tab changes nothing', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records');
	await expect(pw.locator('#records')).toBeVisible();
	await pw.getByRole('button', { name: 'Filters' }).click();
	await pw.getByLabel('Genre', { exact: true }).selectOption('Jazz');
	await expect(pw).toHaveURL(/\?tab=records&genre=Jazz$/);
	const steps = await pw.evaluate(() => history.length);

	const records = pw.getByRole('link', { name: 'Records' });
	await expect(records).toHaveAttribute('href', '/u/tabuser?tab=records');
	await expect(records).toHaveAttribute('aria-current', 'page');
	await records.click();
	// Nothing should happen, so there is no event to wait for: give a navigation time to show.
	await pw.waitForTimeout(500);

	await expect(pw).toHaveURL(/\?tab=records&genre=Jazz$/);
	await expect(pw.getByLabel('Genre', { exact: true })).toHaveValue('Jazz');
	expect(await pw.evaluate(() => history.length)).toBe(steps);
});

const cards = '#records .item-card';

test('a page number in the address opens on that page', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records&page=2');
	await expect(pw.locator(cards)).toHaveCount(48);
	await expect(pw).toHaveURL(/\?tab=records&page=2$/);
});

test('the Records page survives a trip to another tab and Back', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records');
	await expect(pw.locator(cards)).toHaveCount(24);
	await pw.getByRole('button', { name: /Show more/ }).click();
	await expect(pw.locator(cards)).toHaveCount(48);
	await expect(pw).toHaveURL(/\?tab=records&page=2$/);

	await pw.getByRole('link', { name: 'Charts' }).click();
	await expect(pw.locator('#charts')).toBeVisible();
	await pw.goBack();

	await expect(pw.locator('#records')).toBeVisible();
	await expect(pw.locator(cards)).toHaveCount(48);
	await expect(pw).toHaveURL(/\?tab=records&page=2$/);
});

test('changing a filter on page 2 returns to page 1', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records&page=2');
	await expect(pw.locator(cards)).toHaveCount(48);
	await pw.getByRole('button', { name: 'Filters' }).click();
	await pw.getByLabel('Genre', { exact: true }).selectOption('Rock');
	await expect(pw).toHaveURL(/\?tab=records&genre=Rock$/);
	await expect(pw.locator(cards)).toHaveCount(24);
});

test('an old filter link opens Records', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?genre=Rock');
	await expect(pw.locator('#records')).toBeVisible();
	await expect(pw.getByRole('link', { name: 'Records' })).toHaveAttribute('aria-current', 'page');
	// The address gains the tab once the router is up, keeping the filter.
	await expect(pw).toHaveURL(/\?tab=records&genre=Rock$/);
	await pw.getByRole('button', { name: 'Filters' }).click();
	await expect(pw.getByLabel('Genre', { exact: true })).toHaveValue('Rock');
});

test('j and k move between tabs; / opens Records and focuses search', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('#overview')).toBeVisible();
	await pw.keyboard.press('j');
	await expect(pw.locator('#records')).toBeVisible();
	await expect(pw).toHaveURL(/\?tab=records$/);
	await pw.keyboard.press('k');
	await expect(pw.locator('#overview')).toBeVisible();
	await pw.keyboard.press('/');
	await expect(pw.locator('#records')).toBeVisible();
	await expect(pw.locator('#records input[type="search"]')).toBeFocused();
});

test('a long username does not make the page scroll sideways at 390px', async ({ page: pw }) => {
	const name = 'a'.repeat(30);
	await mockStored(pw, name, makeCollection(150));
	await pw.setViewportSize({ width: 390, height: 844 });
	await pw.goto(`/u/${name}`);
	await expect(pw.locator('h1')).toHaveText(`${name}'s shelf`);
	await expect(pw.locator('#overview')).toBeVisible();
	expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
