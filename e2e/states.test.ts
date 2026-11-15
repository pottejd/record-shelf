import { test, expect, type Page } from '@playwright/test';
import { makeCollection, mockStored, withToken } from './fixtures/collection';

test.beforeEach(async ({ page: pw }) => {
	await withToken(pw);
});

/**
 * Slows the fixture's replies for `username`: the first `start` by `firstStart` ms,
 * the background refresh's `start` by `refreshStart` ms, every stored page by
 * `page` ms. The fixture's copy is over a day old, so the first load is followed by
 * a refresh, and between the two the status line has nothing to say.
 */
async function slowReplies(pw: Page, username: string, { firstStart = 250, refreshStart = 80, page = 40 } = {}) {
	let starts = 0;
	await pw.route(`**/api/collection/${username}**`, async (route) => {
		const req = route.request();
		let wait = page;
		if (req.method() === 'POST') {
			wait = req.postDataJSON().action === 'start' ? (starts++ === 0 ? firstStart : refreshStart) : 0;
		}
		await new Promise((resolve) => setTimeout(resolve, wait));
		return route.fallback();
	});
}

interface Sample { status: string; tabs: number | null; board: number | null; heading: number | null }

/**
 * Every frame from the first, writes down the status line's text and where the tab
 * row's foot, the first board on screen and the heading named `heading` sit on the
 * page (null while one is not there).
 */
async function watchLayout(pw: Page, heading: string): Promise<void> {
	await pw.addInitScript((heading) => {
		const samples: unknown[] = [];
		(window as unknown as { samples: unknown[] }).samples = samples;
		const top = (el: Element | null | undefined, edge: 'top' | 'bottom' = 'top') =>
			el ? el.getBoundingClientRect()[edge] + scrollY : null;
		const frame = () => {
			const main = document.querySelector('main');
			if (main) {
				samples.push({
					status: [...main.querySelectorAll('.loading-banner')].map((el) => el.textContent?.trim()).join(' '),
					tabs: top(main.querySelector('.tabs'), 'bottom'),
					board: top([...main.querySelectorAll('.board')].find((b) => b.getClientRects().length > 0)),
					heading: top([...main.querySelectorAll('h2')].find((h) => h.textContent?.trim() === heading))
				});
			}
			requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	}, heading);
}

const samplesOf = (pw: Page) => pw.evaluate(() => (window as unknown as { samples: Sample[] }).samples);

/** Each value the samples took for `key`, in order, with repeats and nulls left out. */
function positions(samples: Sample[], key: 'tabs' | 'board' | 'heading'): number[] {
	const seen: number[] = [];
	for (const s of samples) {
		const v = s[key];
		if (v !== null && (seen.length === 0 || Math.abs(seen[seen.length - 1] - v) > 0.5)) seen.push(v);
	}
	return seen;
}

for (const { tab, heading, board } of [
	{ tab: '', heading: 'Just added', board: true },
	{ tab: '?tab=charts', heading: 'By genre', board: false }
]) {
	for (const width of [1280, 390]) {
		test(`nothing moves while ${heading}'s tab loads and refreshes at ${width}px`, async ({ page: pw }) => {
			await mockStored(pw, 'tabuser', makeCollection(679));
			await slowReplies(pw, 'tabuser');
			await watchLayout(pw, heading);
			await pw.setViewportSize({ width, height: 900 });
			await pw.goto(`/u/tabuser${tab}`);

			// Through the skeleton, the load, the quiet moment and the refresh, to the end.
			await expect.poll(async () => (await samplesOf(pw)).some((s) => s.status.startsWith('Showing a copy from')), { timeout: 15_000 }).toBe(true);
			await expect(pw.locator('main .loading-banner')).toHaveCount(0);
			await pw.waitForLoadState('networkidle');
			await pw.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			const samples = await samplesOf(pw);

			// The load really went through every state the line has.
			const statuses = samples.map((s) => s.status);
			expect(statuses).toContain('Loading collection…');
			expect(statuses.some((t) => /^Loading collection: \d+ of 679 records…$/.test(t))).toBe(true);
			const loaded = statuses.findIndex((t) => t.startsWith('Loading collection:'));
			const refresh = statuses.findIndex((t) => t.startsWith('Showing a copy from'));
			expect(statuses.slice(loaded, refresh)).toContain('');

			// And nothing under the line moved.
			expect(positions(samples, 'heading')).toHaveLength(1);
			if (board) expect(positions(samples, 'board')).toHaveLength(1);
			expect(positions(samples, 'tabs')).toHaveLength(1);
		});
	}
}

test('Ctrl, Cmd and Alt with a shortcut key are left to the browser', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('#overview')).toBeVisible();
	for (const key of ['Alt+j', 'Control+k', 'Alt+/', 'Meta+s', 'Control+?']) await pw.keyboard.press(key);
	await pw.waitForTimeout(300);
	await expect(pw).toHaveURL(/\/u\/tabuser$/);
	await expect(pw.locator('#overview')).toBeVisible();
	await expect(pw.getByRole('dialog')).toHaveCount(0);
	// The same keys alone still work.
	await pw.keyboard.press('j');
	await expect(pw).toHaveURL(/\?tab=records$/);
});

test('under the side list j, k, / and s do nothing; Escape closes the help, then the list', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await pw.getByRole('button', { name: /^Shelf 1 of 1/ }).click();
	const list = pw.getByRole('dialog', { name: /^\d{4} to \d{4}$/ });
	await expect(list).toBeVisible();
	for (const key of ['j', 'k', '/', 's']) await pw.keyboard.press(key);
	await pw.waitForTimeout(300);
	await expect(pw).toHaveURL(/\/u\/tabuser$/);
	await expect(list).toBeVisible();

	// The help opens over the list; the first Escape closes only the help.
	await pw.keyboard.press('?');
	const help = pw.getByRole('dialog', { name: 'Keyboard shortcuts' });
	await expect(help).toBeVisible();
	await pw.keyboard.press('j');
	await expect(pw).toHaveURL(/\/u\/tabuser$/);
	await pw.keyboard.press('Escape');
	await expect(help).toHaveCount(0);
	await expect(list).toBeVisible();
	expect(await list.evaluate((el) => el.contains(document.activeElement))).toBe(true);
	await pw.keyboard.press('Escape');
	await expect(list).toHaveCount(0);
});

test('the keyboard help holds focus, and gives it back to what opened it', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('#overview')).toBeVisible();
	const help = pw.getByRole('dialog', { name: 'Keyboard shortcuts' });

	// Opened with ?: Tab and Shift+Tab stay inside; Escape returns focus to the main area.
	await pw.keyboard.press('?');
	await expect(help).toBeVisible();
	for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
		await pw.keyboard.press(key);
		expect(await help.evaluate((el) => el.contains(document.activeElement))).toBe(true);
	}
	await pw.keyboard.press('Escape');
	await expect(help).toHaveCount(0);
	await expect(pw.locator('main#main-content')).toBeFocused();
	// The shortcuts carry on from there.
	await pw.keyboard.press('j');
	await expect(pw).toHaveURL(/\?tab=records$/);

	// Opened from the footer: focus goes back to the footer's button.
	const opener = pw.getByRole('button', { name: 'Keyboard shortcuts' });
	await opener.focus();
	await pw.keyboard.press('Enter');
	await expect(help).toBeVisible();
	await pw.keyboard.press('Tab');
	expect(await help.evaluate((el) => el.contains(document.activeElement))).toBe(true);
	await pw.keyboard.press('Escape');
	await expect(help).toHaveCount(0);
	await expect(opener).toBeFocused();
});

test('a tab opened from the keyboard keeps focus on its link', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('#overview')).toBeVisible();
	await pw.getByRole('link', { name: 'Overview', exact: true }).focus();
	await pw.keyboard.press('Tab');
	const records = pw.getByRole('link', { name: 'Records', exact: true });
	await expect(records).toBeFocused();
	await pw.keyboard.press('Enter');
	await expect(pw).toHaveURL(/\?tab=records$/);
	await expect(pw.locator('#records')).toBeVisible();
	await expect(records).toBeFocused();
	// And on to the next one.
	await pw.keyboard.press('Tab');
	await pw.keyboard.press('Enter');
	await expect(pw).toHaveURL(/\?tab=charts$/);
	await expect(pw.getByRole('link', { name: 'Charts', exact: true })).toBeFocused();
});

test('"Show the whole shelf" while the shelves are still empty keeps focus on the shelf', async ({ page: pw }) => {
	await mockStored(pw, 'bigshelf', []);
	// The first reply says 5000 records and brings none; the rest never come.
	await pw.route('**/api/collection/bigshelf**', async (route) => {
		const req = route.request();
		if (req.method() === 'POST' && req.postDataJSON().action === 'start') {
			return route.fulfill({
				json: { status: 'ok', snapshot: 'S1', page: 1, totalPages: 50, totalItems: 5000, items: [], profile: { id: 1, username: 'bigshelf', avatar_url: '', location: '' } }
			});
		}
		await new Promise(() => {});
	});
	await pw.goto('/u/bigshelf');
	const shelves = pw.getByRole('button', { name: /^Shelf \d+ of 22: no records yet\.$/ });
	await expect(shelves).toHaveCount(6);
	const more = pw.getByRole('button', { name: 'Show the whole shelf' });
	await more.focus();
	await pw.keyboard.press('Enter');
	await expect(shelves).toHaveCount(22);
	const shelf = pw.locator('.shelf-wide');
	await expect(shelf).toBeFocused();
	await expect(shelf).toBeInViewport();
});

test('the last "Show more" hands focus to the first record it brought in', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records&page=5');
	const cards = pw.locator('#records .item-card');
	await expect(cards).toHaveCount(120);
	const more = pw.getByRole('button', { name: 'Show more' });

	// Not the last: the button stays, and so does focus.
	await more.focus();
	await pw.keyboard.press('Enter');
	await expect(cards).toHaveCount(144);
	await expect(more).toBeFocused();

	// The last: the button goes, and focus moves to record 145.
	await pw.keyboard.press('Enter');
	await expect(cards).toHaveCount(150);
	await expect(more).toHaveCount(0);
	await expect(cards.nth(144)).toBeFocused();
});
