import { test, expect } from '@playwright/test';

// Note: `/` server-redirects to the configured profile (/u/pottejd). Without a
// token configured (the CI default), that profile bounces on to /settings. The
// old home-page search form is therefore not reachable at `/`, so these tests
// target the redirect and the directly-reachable pages instead.

test.describe('Home redirect', () => {
	test('redirects to the configured profile, then to settings without a token', async ({ page }) => {
		await page.goto('/');
		await page.waitForURL('**/settings**');
		// The settings redirect preserves the intended profile destination.
		expect(decodeURIComponent(page.url())).toContain('/u/pottejd');
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
