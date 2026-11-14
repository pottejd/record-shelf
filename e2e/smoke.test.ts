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
		await page.locator('a.home-link').click();
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
		await expect(toggle).toHaveAttribute('aria-label', 'Toggle theme: system');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-label', 'Toggle theme: light');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-label', 'Toggle theme: dark');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-label', 'Toggle theme: system');
	});
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
