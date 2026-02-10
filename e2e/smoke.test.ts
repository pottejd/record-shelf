import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
	test('renders title and search form', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toHaveText('Record Shelf');
		await expect(page.locator('input[type="text"]')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toHaveText('Explore');
	});

	test('shows error when submitting empty username', async ({ page }) => {
		await page.goto('/');
		await page.locator('button[type="submit"]').click();
		await expect(page.locator('.error-message')).toHaveText('Please enter a username');
	});

	test('navigates to user page on form submit', async ({ page }) => {
		await page.goto('/');
		await page.locator('input[type="text"]').fill('testuser');
		await page.locator('button[type="submit"]').click();
		await page.waitForURL('**/u/testuser');
		expect(page.url()).toContain('/u/testuser');
	});

	test('has settings link', async ({ page }) => {
		await page.goto('/');
		const settingsLink = page.locator('a[href="/settings"]');
		await expect(settingsLink).toBeVisible();
	});

	test('has compare link', async ({ page }) => {
		await page.goto('/');
		const compareLink = page.locator('a[href="/compare"]');
		await expect(compareLink).toBeVisible();
		await expect(compareLink).toContainText('Compare Two Collections');
	});

	test('has feature cards', async ({ page }) => {
		await page.goto('/');
		const features = page.locator('.feature');
		await expect(features).toHaveCount(3);
	});
});

test.describe('Theme toggle', () => {
	test('theme toggle button is visible', async ({ page }) => {
		await page.goto('/');
		const toggle = page.locator('.theme-toggle');
		await expect(toggle).toBeVisible();
	});

	test('cycles theme on click', async ({ page }) => {
		await page.goto('/');
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

test.describe('Navigation', () => {
	test('can navigate from home to settings and back', async ({ page }) => {
		await page.goto('/');
		await page.locator('a[href="/settings"]').click();
		await page.waitForURL('**/settings');
		expect(page.url()).toContain('/settings');
	});

	test('can navigate from home to compare', async ({ page }) => {
		await page.goto('/');
		await page.locator('a[href="/compare"]').click();
		await page.waitForURL('**/compare');
		expect(page.url()).toContain('/compare');
	});
});
