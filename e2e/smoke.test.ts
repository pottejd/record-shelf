import { test, expect } from '@playwright/test';

// `/` is the username search: anyone can look up any Discogs username from it.
// Opening a profile still needs a token, so without one the visitor is sent to
// Settings and brought back to the profile they asked for.

test.describe('Home page', () => {
	test('shows the username search, with no token needed to see it', async ({ page }) => {
		await page.goto('/');
		expect(new URL(page.url()).pathname).toBe('/');
		await expect(page.locator('h1')).toHaveText('Record Shelf');
		await expect(page.getByLabel('Discogs username')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Explore' })).toBeVisible();
	});

	test('looking up a username without a token goes to Settings and remembers the profile asked for', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Discogs username').fill('someuser');
		await page.getByRole('button', { name: 'Explore' }).click();
		await page.waitForURL('**/settings**');
		expect(decodeURIComponent(page.url())).toContain('redirect=/u/someuser');
	});

	test('looking up a username with a token opens that profile', async ({ page }) => {
		await page.context().addCookies([{ name: 'discogs_token', value: 'e2e', url: 'http://localhost:4173' }]);
		await page.route('**/api/collection/anotheruser**', (route) =>
			route.fulfill({ status: 404, json: { status: 'error', code: 'NOT_FOUND', message: 'User not found' } }));
		await page.goto('/');
		await page.getByLabel('Discogs username').fill('anotheruser');
		await page.getByRole('button', { name: 'Explore' }).click();
		await page.waitForURL('**/u/anotheruser');
		await expect(page.getByRole('alert')).toHaveText('No Discogs user named "anotheruser".');
	});

	test('the brand link on a profile leads back to the search', async ({ page }) => {
		await page.context().addCookies([{ name: 'discogs_token', value: 'e2e', url: 'http://localhost:4173' }]);
		await page.route('**/api/collection/anotheruser**', (route) =>
			route.fulfill({ status: 404, json: { status: 'error', code: 'NOT_FOUND', message: 'User not found' } }));
		await page.goto('/u/anotheruser');
		await page.getByRole('link', { name: 'Record Shelf home' }).click();
		await page.waitForURL((url) => url.pathname === '/');
		await expect(page.getByLabel('Discogs username')).toBeVisible();
	});
});

test.describe('Theme toggle', () => {
	test('theme toggle button is visible', async ({ page }) => {
		await page.goto('/settings');
		const toggle = page.locator('.theme-toggle');
		await expect(toggle).toBeVisible();
	});

	test('cycles theme on click', async ({ page }) => {
		await page.goto('/settings');
		const toggle = page.locator('.theme-toggle');

		// Default is 'system'
		await expect(toggle).toHaveText('Theme: system');

		await toggle.click();
		await expect(toggle).toHaveText('Theme: light');

		await toggle.click();
		await expect(toggle).toHaveText('Theme: dark');

		await toggle.click();
		await expect(toggle).toHaveText('Theme: system');
	});
});

// What a browser does: the first theme-color meta, in tree order, whose media matches.
const effectiveThemeColour = (page: import('@playwright/test').Page) =>
	page.evaluate(() => {
		const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
		const hit = metas.find((m) => !m.media || matchMedia(m.media).matches);
		return hit?.content ?? null;
	});

test.describe('Theme colour of the browser bar', () => {
	const LIGHT = '#ECEEE8';
	const DARK = '#131815';
	const cases = [
		{ scheme: 'light', stored: null, want: LIGHT },
		{ scheme: 'dark', stored: null, want: DARK },
		{ scheme: 'dark', stored: 'light', want: LIGHT },
		{ scheme: 'light', stored: 'dark', want: DARK },
		{ scheme: 'dark', stored: 'dark', want: DARK },
		{ scheme: 'light', stored: 'light', want: LIGHT }
	] as const;

	for (const { scheme, stored, want } of cases) {
		test(`system ${scheme}, ${stored ?? 'nothing'} chosen: ${want}, before and after hydration`, async ({
			browser
		}) => {
			const context = await browser.newContext({ colorScheme: scheme });
			const page = await context.newPage();
			if (stored) {
				await page.addInitScript((v) => localStorage.setItem('record-shelf-theme', v), stored);
			}
			await page.goto('/settings');
			await expect(page.locator('.theme-toggle')).toBeVisible();
			expect(await effectiveThemeColour(page)).toBe(want);
			await page.reload();
			expect(await effectiveThemeColour(page)).toBe(want);
			await context.close();
		});
	}

	test('theme-init.js sets it before the app starts (no JavaScript beyond it)', async ({
		browser
	}) => {
		const context = await browser.newContext({ colorScheme: 'dark', javaScriptEnabled: true });
		const page = await context.newPage();
		await page.addInitScript(() => localStorage.setItem('record-shelf-theme', 'light'));
		await page.route('**/_app/immutable/**/*.js', (route) => route.abort());
		await page.goto('/settings');
		expect(await effectiveThemeColour(page)).toBe(LIGHT);
		await context.close();
	});

	test('switching the theme updates it without a reload', async ({ browser }) => {
		const context = await browser.newContext({ colorScheme: 'dark' });
		const page = await context.newPage();
		await page.goto('/settings');
		const toggle = page.locator('.theme-toggle');
		await expect(toggle).toHaveText('Theme: system');
		expect(await effectiveThemeColour(page)).toBe(DARK);
		await toggle.click();
		await expect(toggle).toHaveText('Theme: light');
		expect(await effectiveThemeColour(page)).toBe(LIGHT);
		await toggle.click();
		await expect(toggle).toHaveText('Theme: dark');
		expect(await effectiveThemeColour(page)).toBe(DARK);
		await toggle.click();
		await expect(toggle).toHaveText('Theme: system');
		expect(await effectiveThemeColour(page)).toBe(DARK);
		await context.close();
	});
});

test.describe('Colour scheme of the browser\'s own parts (scrollbars, controls)', () => {
	const cases = [
		{ scheme: 'light', stored: null, want: 'light' },
		{ scheme: 'dark', stored: null, want: 'dark' },
		{ scheme: 'dark', stored: 'light', want: 'light' },
		{ scheme: 'light', stored: 'dark', want: 'dark' }
	] as const;

	for (const { scheme, stored, want } of cases) {
		test(`system ${scheme}, ${stored ?? 'nothing'} chosen: ${want}`, async ({ browser }) => {
			const context = await browser.newContext({ colorScheme: scheme });
			const page = await context.newPage();
			if (stored) await page.addInitScript((v) => localStorage.setItem('record-shelf-theme', v), stored);
			await page.goto('/settings');
			await expect(page.locator('.theme-toggle')).toBeVisible();
			expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(want);
			await context.close();
		});
	}
});

test.describe('Compare page', () => {
	test('renders compare form', async ({ page }) => {
		await page.goto('/compare');
		await expect(page.locator('h1')).toContainText('Head-to-Head');
	});
});

test.describe('Settings page', () => {
	test('renders settings page', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.locator('h1')).toContainText('Settings');
	});
});
