import { test, expect } from '@playwright/test';

// These exercise the hardening that's hard to cover in unit tests: the response
// headers hooks.server.ts attaches, the kit.csp policy, the unauthenticated
// redirect gate, and the public widget endpoint.
//
// Note: /u/[username] fetches Discogs *server-side* in its load function, which
// Playwright's page.route (browser-only) cannot intercept — so these tests cover
// the auth gate (which needs no upstream call) rather than a stubbed collection
// render. They assume the preview server runs without a DISCOGS_TOKEN, which is
// the CI default.

test.describe('Security headers', () => {
	test('home response carries the hardening headers', async ({ page }) => {
		const response = await page.goto('/');
		expect(response).toBeTruthy();
		const headers = response!.headers();
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['x-frame-options']).toBe('DENY');
		expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
		expect(headers['permissions-policy']).toContain('camera=()');
	});

	test('a Content-Security-Policy restricts object-src and base-uri', async ({ page }) => {
		const response = await page.goto('/');
		// hash-mode CSP is a response header for SSR pages and a <meta> tag for
		// prerendered pages — accept either so the test is robust to both.
		const csp = response!.headers()['content-security-policy'];
		const policy =
			csp ??
			(await page
				.locator('meta[http-equiv="content-security-policy" i]')
				.getAttribute('content'));
		expect(policy, 'expected a CSP via header or meta tag').toBeTruthy();
		expect(policy).toContain("object-src 'none'");
		expect(policy).toContain("base-uri 'self'");
	});
});

test.describe('Auth gate', () => {
	test('/u/<user> redirects to /settings when no token is configured', async ({ page }) => {
		await page.goto('/u/someuser');
		await page.waitForURL('**/settings**');
		expect(page.url()).toContain('/settings');
		// Preserves where to return after the token is entered.
		expect(decodeURIComponent(page.url())).toContain('/u/someuser');
	});
});

test.describe('Widget API', () => {
	test('returns JSON with permissive CORS and a stable shape', async ({ request }) => {
		const res = await request.get('/api/widget');
		expect(res.ok()).toBeTruthy();
		expect(res.headers()['access-control-allow-origin']).toBe('*');
		const body = await res.json();
		expect(body.appName).toBe('Record Shelf');
		expect(Array.isArray(body.items)).toBe(true);
		expect(body.items.length).toBeGreaterThan(0);
	});
});
