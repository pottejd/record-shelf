import { test, expect, type Page } from '@playwright/test';

const item = (n: number) => ({
	id: n, instance_id: n, folder_id: 1, rating: 0, date_added: '2026-01-01T00:00:00-00:00',
	basic_information: { id: n, title: `Album ${n}`, year: 1990, thumb: '', resource_url: '', artists: [{ id: 1, name: 'Artist', resource_url: '' }], labels: [{ id: 1, name: 'Label', catno: '1', resource_url: '' }], formats: [{ name: 'Vinyl', qty: '1' }], genres: ['Rock'], styles: [] }
});
const page = (p: number, count: number) => ({
	status: 'ok', snapshot: 'S1', page: p, totalPages: 2, totalItems: 150, source: 'discogs', stored: true, nextDelayMs: 0,
	items: Array.from({ length: count }, (_, i) => item((p - 1) * 100 + i + 1))
});
const profile = { id: 1, username: 'someuser', avatar_url: '', location: '' };

async function withToken(pw: Page) {
	await pw.context().addCookies([{ name: 'discogs_token', value: 'e2e', url: 'http://localhost:4173' }]);
}

test('renders a profile from the sync API and reports the full record count', async ({ page: pw }) => {
	await withToken(pw);
	await pw.route('**/api/collection/someuser**', async (route) => {
		const req = route.request();
		if (req.method() === 'POST') {
			const body = req.postDataJSON();
			return route.fulfill({ json: body.action === 'start' ? { ...page(1, 100), profile } : { status: 'complete', snapshot: 'S1', completedAt: Date.now() } });
		}
		return route.fulfill({ json: page(2, 50) });
	});
	await pw.goto('/u/someuser');
	await expect(pw.locator('h1')).toHaveText('someuser');
	await expect(pw.locator('#overview')).toContainText('150');
});

test('a wait result shows the busy banner and then recovers', async ({ page: pw }) => {
	await withToken(pw);
	let gets = 0;
	await pw.route('**/api/collection/someuser**', async (route) => {
		const req = route.request();
		if (req.method() === 'POST') {
			const body = req.postDataJSON();
			return route.fulfill({ json: body.action === 'start' ? { ...page(1, 100), profile } : { status: 'complete', snapshot: 'S1', completedAt: Date.now() } });
		}
		return route.fulfill({ json: gets++ === 0 ? { status: 'wait', retryAfterMs: 2000 } : page(2, 50) });
	});
	await pw.goto('/u/someuser');
	await expect(pw.getByText(/Discogs is busy — resuming in \d+s\./)).toBeVisible();
	await expect(pw.locator('#overview')).toContainText('150', { timeout: 10_000 });
	await expect(pw.getByText(/Discogs is busy/)).toHaveCount(0);
});

test('an unknown user gets a plain message', async ({ page: pw }) => {
	await withToken(pw);
	await pw.route('**/api/collection/someuser**', (route) =>
		route.fulfill({ status: 404, json: { status: 'error', code: 'NOT_FOUND', message: 'User not found' } }));
	await pw.goto('/u/someuser');
	await expect(pw.getByRole('alert')).toHaveText('No Discogs user named "someuser".');
});
