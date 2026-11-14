import { test, expect, type Page, type Route } from '@playwright/test';

const item = (n: number) => ({
	id: n, instance_id: n, folder_id: 1, rating: 0, date_added: '2026-01-01T00:00:00-00:00',
	basic_information: { id: n, title: `Album ${n}`, year: 1990, thumb: '', resource_url: '', artists: [{ id: 1, name: 'Artist', resource_url: '' }], labels: [{ id: 1, name: 'Label', catno: '1', resource_url: '' }], formats: [{ name: 'Vinyl', qty: '1' }], genres: ['Rock'], styles: [] }
});
const itemsOf = (p: number, count: number) => Array.from({ length: count }, (_, i) => item((p - 1) * 100 + i + 1));
/** A stored page, as the site's sync endpoint returns it. */
const stored = (p: number, count: number) => ({ status: 'ok', snapshot: 'S1', page: p, totalPages: 2, totalItems: 150, items: itemsOf(p, count) });
const profile = { id: 1, username: 'someuser', avatar_url: '', location: '' };
const complete = () => ({ status: 'complete', snapshot: 'S1', completedAt: Date.now() });

async function withToken(pw: Page) {
	await pw.context().addCookies([{ name: 'discogs_token', value: 'e2e', url: 'http://localhost:4173' }]);
}

/** Answers a Discogs call the way Discogs does for a list of 150 records: readable from any origin. */
function fromDiscogs(route: Route) {
	const url = new URL(route.request().url());
	const headers = { 'access-control-allow-origin': '*' };
	if (url.pathname === '/users/someuser') return route.fulfill({ json: profile, headers });
	const p = Number(url.searchParams.get('page'));
	const perPage = Number(url.searchParams.get('per_page'));
	return route.fulfill({
		headers,
		json: { pagination: { page: p, pages: Math.ceil(150 / perPage), per_page: perPage, items: 150, urls: {} }, releases: itemsOf(p, p === 1 ? Math.min(perPage, 100) : 50) }
	});
}

test('renders a profile from the stored copy without calling Discogs', async ({ page: pw }) => {
	await withToken(pw);
	let discogsCalls = 0;
	await pw.route('https://api.discogs.com/**', (route) => { discogsCalls++; return route.abort(); });
	await pw.route('**/api/collection/someuser**', async (route) => {
		const req = route.request();
		if (req.method() === 'POST') {
			const body = req.postDataJSON();
			return route.fulfill({ json: body.action === 'start' ? { ...stored(1, 100), profile } : complete() });
		}
		return route.fulfill({ json: stored(2, 50) });
	});
	await pw.goto('/u/someuser');
	await expect(pw.locator('h1')).toHaveText('someuser');
	await expect(pw.locator('#overview')).toContainText('150');
	expect(discogsCalls).toBe(0);
});

test('a list nobody has stored is fetched from Discogs by the browser and handed to the site page by page', async ({ page: pw }) => {
	await withToken(pw);
	const discogs: Array<{ url: URL; auth: string }> = [];
	const handed: Array<{ page: number; items: number; profile?: string }> = [];
	const sent: string[] = [];
	await pw.route('https://api.discogs.com/**', (route) => {
		discogs.push({ url: new URL(route.request().url()), auth: route.request().headers()['authorization'] ?? 'no-token' });
		return fromDiscogs(route);
	});
	await pw.route('**/api/collection/someuser**', async (route) => {
		const req = route.request();
		if (req.method() !== 'POST') return route.fulfill({ json: { status: 'missing' } });
		sent.push(req.postData() ?? '');
		const body = req.postDataJSON();
		if (body.action === 'start') return route.fulfill({ json: { status: 'open', snapshot: 'S1', store: true } });
		if (body.action === 'page') {
			handed.push({ page: body.page, items: body.items.length, ...(body.profile ? { profile: body.profile.username } : {}) });
			return route.fulfill({ json: { status: 'stored' } });
		}
		return route.fulfill({ json: complete() });
	});
	await pw.goto('/u/someuser');
	await expect(pw.locator('h1')).toHaveText('someuser');
	await expect(pw.locator('#overview')).toContainText('150', { timeout: 15_000 });
	await expect.poll(() => sent.some((body) => body.includes('"complete"')), { timeout: 15_000 }).toBe(true);

	// One call with no token to check the list is public, then the token in a header, never in the address.
	expect(discogs.map(({ url, auth }) => `${url.pathname.split('/').pop()} ${url.searchParams.get('page') ?? ''} ${auth}`))
		.toEqual(['releases 1 no-token', 'releases 1 Discogs token=e2e', 'someuser  Discogs token=e2e', 'releases 2 Discogs token=e2e']);
	expect(discogs.some(({ url }) => url.search.includes('token'))).toBe(false);
	expect(handed).toEqual([{ page: 1, items: 100, profile: 'someuser' }, { page: 2, items: 50 }]);
	// The token never goes to the site in a request body.
	expect(sent.join('\n')).not.toContain('e2e');
});

test('when Discogs gives no readable answer the busy banner shows, the records stay, and the load resumes', async ({ page: pw }) => {
	await withToken(pw);
	await pw.clock.install();
	let failures = 0;
	await pw.route('https://api.discogs.com/**', (route) => {
		// What a rate-limited call looks like to a browser: no readable answer.
		if (failures++ === 0) return route.abort();
		return fromDiscogs(route);
	});
	await pw.route('**/api/collection/someuser**', async (route) => {
		const req = route.request();
		if (req.method() !== 'POST') return route.fulfill({ json: { status: 'missing' } });
		const body = req.postDataJSON();
		if (body.action === 'start') return route.fulfill({ json: { ...stored(1, 100), profile } });
		return route.fulfill({ json: body.action === 'page' ? { status: 'stored' } : complete() });
	});
	await pw.goto('/u/someuser');
	await expect(pw.getByText(/Discogs is busy or unreachable — retrying in \d+s\./)).toBeVisible();
	await expect(pw.locator('h1')).toHaveText('someuser');

	await pw.clock.fastForward(31_000);
	await expect(pw.locator('#overview')).toContainText('150', { timeout: 15_000 });
	await expect(pw.getByText(/Discogs is busy/)).toHaveCount(0);
});

test('an unknown user gets a plain message', async ({ page: pw }) => {
	await withToken(pw);
	await pw.route('**/api/collection/someuser**', (route) =>
		route.fulfill({ status: 404, json: { status: 'error', code: 'NOT_FOUND', message: 'User not found' } }));
	await pw.goto('/u/someuser');
	await expect(pw.getByRole('alert')).toHaveText('No Discogs user named "someuser".');
});

test('a user Discogs does not know gets the same plain message, and the site is asked to drop any copy', async ({ page: pw }) => {
	await withToken(pw);
	const actions: string[] = [];
	await pw.route('https://api.discogs.com/**', (route) =>
		route.fulfill({ status: 404, json: { message: 'User does not exist or may have been deleted.' }, headers: { 'access-control-allow-origin': '*' } }));
	await pw.route('**/api/collection/someuser**', async (route) => {
		const body = route.request().postDataJSON();
		actions.push(body.action);
		return route.fulfill({ json: body.action === 'start' ? { status: 'open', snapshot: 'S1', store: true } : { status: 'dropped' } });
	});
	await pw.goto('/u/someuser');
	await expect(pw.getByRole('alert')).toHaveText('No Discogs user named "someuser".');
	expect(actions).toEqual(['start', 'drop']);
});
