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

/**
 * Waits for the background refresh to end: when it lands the shelf is drawn again,
 * which can drop a focus mid-test.
 */
async function settled(pw: Page): Promise<void> {
	await pw.waitForLoadState('networkidle');
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
	for (const width of [1280, 390, 320]) {
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

/**
 * The status line's text is whole: nothing cut off, nothing past the page's edge,
 * and the line still fits the room the page keeps for it.
 */
async function expectWholeLine(pw: Page, text: RegExp): Promise<void> {
	const line = pw.locator('main .loading-text');
	await expect(line).toHaveText(text);
	const fit = await line.evaluate((el) => {
		const room = el.closest('.status')!;
		return {
			scroll: el.scrollWidth,
			client: el.clientWidth,
			right: el.getBoundingClientRect().right,
			page: document.documentElement.clientWidth,
			cut: getComputedStyle(el).textOverflow === 'ellipsis' || getComputedStyle(el).whiteSpace === 'nowrap',
			room: room.getBoundingClientRect().height,
			kept: parseFloat(getComputedStyle(room).minHeight)
		};
	});
	expect(fit.scroll).toBeLessThanOrEqual(fit.client);
	expect(fit.right).toBeLessThanOrEqual(fit.page);
	expect(fit.cut).toBe(false);
	expect(fit.room).toBe(fit.kept);
}

/** A list of 150 whose first Discogs call gets no readable answer: the line waits. */
async function waitingOnDiscogs(pw: Page) {
	const item = (n: number) => ({
		id: n, instance_id: n, folder_id: 1, rating: 0, date_added: '2026-01-01T00:00:00-00:00',
		basic_information: { id: n, title: `Album ${n}`, year: 1990, thumb: '', resource_url: '', artists: [{ id: 1, name: 'Artist', resource_url: '' }], labels: [{ id: 1, name: 'Label', catno: '1', resource_url: '' }], formats: [{ name: 'Vinyl', qty: '1' }], genres: ['Rock'], styles: [] }
	});
	await pw.clock.install();
	await pw.route('https://api.discogs.com/**', (route) => route.abort());
	await pw.route('**/api/collection/someuser**', async (route) => {
		const req = route.request();
		if (req.method() !== 'POST') return route.fulfill({ json: { status: 'missing' } });
		const body = req.postDataJSON();
		if (body.action === 'start') {
			return route.fulfill({
				json: {
					status: 'ok', snapshot: 'S1', page: 1, totalPages: 2, totalItems: 150,
					items: Array.from({ length: 100 }, (_, i) => item(i + 1)),
					profile: { id: 1, username: 'someuser', avatar_url: '', location: '' }
				}
			});
		}
		return route.fulfill({ json: { status: 'stored' } });
	});
}

/** Holds back every stored page after page 3 of the pass that `hold` picks, so its line stays on screen. */
async function holdPages(pw: Page, hold: (starts: number) => boolean) {
	let starts = 0;
	await pw.route('**/api/collection/tabuser**', async (route) => {
		const req = route.request();
		if (req.method() === 'POST' && req.postDataJSON().action === 'start') starts++;
		if (req.method() === 'GET' && Number(new URL(req.url()).searchParams.get('page')) > 3 && hold(starts)) {
			await new Promise(() => {});
		}
		return route.fallback();
	});
}

for (const width of [390, 320]) {
	test.describe(`at ${width}px the status line is whole and fits its room`, () => {
		test.beforeEach(async ({ page: pw }) => {
			await pw.setViewportSize({ width, height: 900 });
		});

		test('waiting on Discogs, with its countdown', async ({ page: pw }) => {
			await waitingOnDiscogs(pw);
			await pw.goto('/u/someuser');
			await expectWholeLine(pw, /^Discogs is busy or unreachable — retrying in \d+s\.$/);
		});

		test('loading with a count', async ({ page: pw }) => {
			await mockStored(pw, 'tabuser', makeCollection(679));
			await holdPages(pw, (starts) => starts === 1);
			await pw.goto('/u/tabuser');
			await expectWholeLine(pw, /^Loading collection: \d+ of 679 records…$/);
		});

		test('refreshing a copy a day old', async ({ page: pw }) => {
			await mockStored(pw, 'tabuser', makeCollection(679));
			await holdPages(pw, (starts) => starts > 1);
			await pw.goto('/u/tabuser');
			await expectWholeLine(pw, /^Showing a copy from \d+ (minutes?|hours?|days?) ago — updating \(\d+ of 679\)…$/);
		});
	});
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

test('closing the side list gives focus back to what opened it: Escape, the close button, the veil', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('#overview')).toBeVisible();
	await settled(pw);
	const shelf = pw.getByRole('button', { name: /^Shelf 1 of 1/ });
	const list = pw.getByRole('dialog', { name: /^\d{4} to \d{4}$/ });

	const ways: Array<[string, () => Promise<void>]> = [
		['Escape', () => pw.keyboard.press('Escape')],
		['the close button', () => list.getByRole('button', { name: 'Close' }).press('Enter')],
		['the veil', () => pw.mouse.click(20, 400)]
	];
	for (const [how, close] of ways) {
		await shelf.focus();
		await pw.keyboard.press('Enter');
		await expect(list, how).toBeVisible();
		await expect(list.getByRole('button', { name: 'Close' }), how).toBeFocused();
		await close();
		await expect(list, how).toHaveCount(0);
		await expect(shelf, how).toBeFocused();
	}

	// Opened with the mouse, the same.
	await shelf.click();
	await expect(list).toBeVisible();
	await pw.keyboard.press('Escape');
	await expect(list).toHaveCount(0);
	await expect(shelf).toBeFocused();
});

test('the side list holds focus, and its last "Show more" hands focus to the first record it brought in', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('#overview')).toBeVisible();
	await settled(pw);
	await pw.getByRole('button', { name: /^Shelf 1 of 1/ }).click();
	const list = pw.getByRole('dialog', { name: /^\d{4} to \d{4}$/ });
	await expect(list).toBeVisible();
	const inside = () => list.evaluate((el) => el.contains(document.activeElement));

	// Tab and Shift+Tab go round inside: from the close button back to the end, and on to the start.
	await pw.keyboard.press('Shift+Tab');
	await expect(list.getByRole('button', { name: /^Show more/ })).toBeFocused();
	await pw.keyboard.press('Tab');
	await expect(list.getByRole('button', { name: 'Close' })).toBeFocused();

	// Focus that strays out of the list is pulled back by the next Tab or Shift+Tab.
	for (const key of ['Tab', 'Shift+Tab']) {
		await pw.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		expect(await inside()).toBe(false);
		await pw.keyboard.press(key);
		expect(await inside()).toBe(true);
	}

	// The keyboard help over the list holds focus itself.
	await pw.keyboard.press('?');
	const help = pw.getByRole('dialog', { name: 'Keyboard shortcuts' });
	await expect(help).toBeVisible();
	for (const key of ['Tab', 'Tab', 'Shift+Tab']) {
		await pw.keyboard.press(key);
		expect(await help.evaluate((el) => el.contains(document.activeElement))).toBe(true);
	}
	await pw.keyboard.press('Escape');
	await expect(help).toHaveCount(0);

	// 150 records, 50 at a time: the first "Show more" keeps focus, the last goes and hands it on.
	const records = list.locator('li');
	await expect(records).toHaveCount(50);
	const more = list.getByRole('button', { name: /^Show more/ });
	await more.focus();
	await pw.keyboard.press('Enter');
	await expect(records).toHaveCount(100);
	await expect(more).toBeFocused();
	await pw.keyboard.press('Enter');
	await expect(records).toHaveCount(150);
	await expect(more).toHaveCount(0);
	await expect(records.nth(100)).toBeFocused();
	// And the keyboard carries on inside the list.
	await pw.keyboard.press('Tab');
	expect(await inside()).toBe(true);
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
