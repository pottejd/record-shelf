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
	await pw.getByLabel('Genre', { exact: true }).selectOption('Jazz');
	await expect(pw).toHaveURL(/\?tab=records&genre=Jazz$/);

	await pw.getByRole('link', { name: 'Charts' }).click();
	await expect(pw).toHaveURL(/\/u\/tabuser\?tab=charts$/);
	await expect(pw.locator('#charts')).toBeVisible();

	await pw.goBack();
	await expect(pw.locator('#records')).toBeVisible();
	await expect(pw).toHaveURL(/\?tab=records&genre=Jazz$/);
	await expect(pw.getByLabel('Genre', { exact: true })).toHaveValue('Jazz');
});

test('clicking the open tab changes nothing', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records');
	await expect(pw.locator('#records')).toBeVisible();
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
/** One of the fixture's 90-character titles. */
const LONG_TITLE = 'The Complete Unabridged Recordings of the Midnight Orchestra Performing Live at the Old Ha';
const UPGRADE_TITLE = 'Music for Airports, Waiting Rooms, Late Ferries and Other Places Where Nobody Stays for Long';

/** Adds a record owned twice and a long-titled album owned only on CD and cassette. */
function withDuplicateAndUpgrade(items: ReturnType<typeof makeCollection>) {
	const [first, second, third] = items;
	const copy = { ...first, id: 9_000_001, instance_id: 9_000_001 };
	const onCd = (item: typeof first, id: number, name: string) => ({
		...item, id, instance_id: id,
		basic_information: {
			...item.basic_information, id, title: UPGRADE_TITLE,
			artists: [{ id: 77, name: 'The Long Titles', resource_url: '' }],
			formats: [{ name, qty: '1', descriptions: ['Album'] }]
		}
	});
	return [...items, copy, onCd(second, 9_000_002, 'CD'), onCd(third, 9_000_003, 'Cassette')];
}

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
	await expect(pw.getByLabel('Genre', { exact: true })).toHaveValue('Rock');
});

test('Records: filters are always visible and Show more steps by 24', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records');
	await expect(pw.getByRole('heading', { name: 'All records' })).toBeVisible();
	await expect(pw.getByPlaceholder('Search by title, artist, label or catalog number')).toBeVisible();
	for (const name of ['Genre', 'Format', 'Decade']) await expect(pw.getByRole('combobox', { name })).toBeVisible();
	await expect(pw.getByRole('button', { name: 'Filters' })).toHaveCount(0);
	await expect(pw.getByText('24 of 150 shown')).toBeVisible();
	await pw.getByRole('button', { name: 'Show more' }).click();
	await expect(pw.getByText('48 of 150 shown')).toBeVisible();
});

test('Records: the selects start on "All …", the sort says its direction, and the count follows a filter', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records');
	const firstOption = (name: string) => pw.getByRole('combobox', { name }).locator('option').first();
	await expect(firstOption('Genre')).toHaveText('All genres');
	await expect(firstOption('Format')).toHaveText('All formats');
	await expect(firstOption('Decade')).toHaveText('All decades');

	const added = pw.getByRole('button', { name: /^Date added/ });
	await expect(added).toHaveAttribute('aria-pressed', 'true');
	await expect(added).toHaveAccessibleName('Date added, newest first');
	await added.click();
	await expect(added).toHaveAccessibleName('Date added, oldest first');
	const artist = pw.getByRole('button', { name: /^Artist/ });
	await expect(artist).toHaveAttribute('aria-pressed', 'false');
	await artist.click();
	await expect(artist).toHaveAccessibleName('Artist, A to Z');
	await expect(artist).toHaveAttribute('aria-pressed', 'true');

	// The CD records are few: all of them fit on one page, so there is nothing more to show.
	await pw.getByRole('combobox', { name: 'Format' }).selectOption('CD');
	const cds = await pw.locator(cards).count();
	expect(cds).toBeGreaterThan(0);
	expect(cds).toBeLessThan(24);
	await expect(pw.getByText(`${cds} of ${cds} shown`)).toBeVisible();
	await expect(pw.getByRole('button', { name: 'Show more' })).toHaveCount(0);
	await pw.getByRole('button', { name: 'Clear all' }).click();
	await expect(pw.getByText('24 of 150 shown')).toBeVisible();

	await pw.getByPlaceholder('Search by title, artist, label or catalog number').fill('no such record anywhere');
	await expect(pw.getByText('No records match.')).toBeVisible();
	await expect(pw.locator(cards)).toHaveCount(0);
	await expect(pw).toHaveURL(/\?tab=records&search=no\+such\+record\+anywhere&sort=artist&order=asc$/);
	await expect(pw.getByText(/ shown$/)).toHaveCount(0);
});

test('Records on a phone: two columns, long titles do not push the page sideways', async ({ page: pw }) => {
	// makeCollection has 90-character titles and titles in Japanese and Russian.
	// Page 7 shows all 150, so every one of them is on the page.
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.setViewportSize({ width: 390, height: 844 });
	await pw.goto('/u/tabuser?tab=records&page=7');
	await expect(pw.locator(cards)).toHaveCount(150);
	await expect(pw.getByText(LONG_TITLE)).toBeVisible();
	await expect(pw.getByText('150 of 150 shown')).toBeVisible();
	const columns = await pw.locator('#records .items-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
	expect(columns).toBe(2);
	expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Records on a desktop: six columns, duplicates beside upgrade picks', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', withDuplicateAndUpgrade(makeCollection(150)));
	await pw.goto('/u/tabuser?tab=records');
	const columns = await pw.locator('#records .items-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
	expect(columns).toBe(6);
	const dupes = (await pw.getByRole('heading', { name: 'Duplicates and variants' }).boundingBox())!;
	const picks = (await pw.getByRole('heading', { name: 'Vinyl upgrade picks' }).boundingBox())!;
	expect(picks.y).toBeCloseTo(dupes.y, 0);
	expect(picks.x).toBeGreaterThan(dupes.x + dupes.width);
	await pw.locator('.upg-list').getByRole('button', { name: new RegExp(`^${UPGRADE_TITLE}`) }).click();
	await expect(pw.getByRole('dialog')).toBeVisible();
});

test('Records on a phone: upgrade picks keep their titles readable', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', withDuplicateAndUpgrade(makeCollection(150)));
	await pw.setViewportSize({ width: 390, height: 844 });
	await pw.goto('/u/tabuser?tab=records');
	const dupes = (await pw.getByRole('heading', { name: 'Duplicates and variants' }).boundingBox())!;
	const picks = (await pw.getByRole('heading', { name: 'Vinyl upgrade picks' }).boundingBox())!;
	expect(picks.y).toBeGreaterThan(dupes.y);
	const title = pw.locator('.upg-list .upg-title', { hasText: UPGRADE_TITLE });
	await title.scrollIntoViewIfNeeded();
	// The title has most of the row to itself: the formats sit underneath it, not beside it.
	expect((await title.boundingBox())!.width).toBeGreaterThan(200);
	expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
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

test('the shelf has one spine per record and opens the side list', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(679));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('.shelf-wide [data-spine]')).toHaveCount(679);
	await expect(pw.getByText('679 records, one spine each.')).toBeVisible();
	await pw.getByRole('button', { name: /^Shelf 1 of 3/ }).click();
	await expect(pw.getByRole('dialog')).toBeVisible();
});

test('the shelf is on Overview only', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=records');
	await expect(pw.locator('#records')).toBeVisible();
	await expect(pw.locator('.shelf-wide')).toHaveCount(0);
});

test('on a phone the shelf has six rows and no sideways scroll', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(679));
	await pw.setViewportSize({ width: 390, height: 844 });
	await pw.goto('/u/tabuser');
	await expect(pw.locator('.shelf-narrow [data-spine]')).toHaveCount(679);
	await expect(pw.getByRole('button', { name: /^Shelf \d+ of 6:/ })).toHaveCount(6);
	await expect(pw.getByRole('button', { name: /^Shelf \d+ of 3:/ })).toHaveCount(0);
	expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('hovering a spine names the record inside the page', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(679));
	await pw.goto('/u/tabuser');
	await expect(pw.locator('.shelf-wide [data-spine]')).toHaveCount(679);
	await pw.locator('.shelf-wide .board').first().locator('[data-spine]').last().hover();
	const label = pw.locator('.spine-label');
	await expect(label).toBeVisible();
	await expect(label).toHaveText(/\S/);
	const box = (await label.boundingBox())!;
	expect(box.x + box.width).toBeLessThanOrEqual(1280);
	await pw.mouse.move(5, 5);
	await expect(label).toBeHidden();
});

/** Every record gets the same title, so whichever spine sits at an end carries it. */
function titled(n: number, title: string) {
	return makeCollection(n).map((i) => ({ ...i, basic_information: { ...i.basic_information, title } }));
}

const AWKWARD = [
	{ name: 'a 90-character title', title: 'The Complete Unabridged Recordings of the Midnight Orchestra Performing Live in Old Halls!' },
	{ name: 'a title in a script the font lacks', title: '夜明けの音楽 〜 静かな朝の歌と遠い海の記憶、そして終わらない旅の物語 〜 完全版' }
];

for (const { name, title } of AWKWARD) {
	for (const width of [1280, 390]) {
		test(`the hover label holds ${name} on one line inside the page at ${width}px`, async ({ page: pw }) => {
			await mockStored(pw, 'tabuser', titled(300, title));
			await pw.setViewportSize({ width, height: 900 });
			await pw.goto('/u/tabuser');
			const kind = width < 700 ? 'narrow' : 'wide';
			const spines = pw.locator(`.shelf-${kind} [data-spine]`);
			await expect(spines).toHaveCount(300);
			const shelf = (await pw.locator('.shelf').boundingBox())!;
			const label = pw.locator('.spine-label');
			for (const spine of [spines.first(), spines.last()]) {
				await spine.hover();
				await expect(label).toBeVisible();
				await expect(label).toHaveText(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `));
				const box = (await label.boundingBox())!;
				expect(box.x).toBeGreaterThanOrEqual(shelf.x - 0.5);
				expect(box.x + box.width).toBeLessThanOrEqual(shelf.x + shelf.width + 0.5);
				expect(box.height).toBeLessThan(36); // one line of 15px text and its padding
				const fit = await label.evaluate((el) => ({
					ws: getComputedStyle(el).whiteSpace,
					to: getComputedStyle(el).textOverflow,
					cut: el.scrollWidth > el.clientWidth
				}));
				expect(fit.ws).toBe('nowrap');
				expect(fit.to).toBe('ellipsis');
				if (width === 390) expect(fit.cut).toBe(true);
			}
			expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
		});
	}
}

test('a huge collection shows the cap, then the whole shelf at the width in use', async ({ page: pw }) => {
	await mockStored(pw, 'bigshelf', makeCollection(5000));
	await pw.goto('/u/bigshelf');
	const shelves = pw.getByRole('button', { name: /^Shelf \d+ of 22:/ });
	await expect(shelves).toHaveCount(6);
	await expect(pw.getByRole('button', { name: /^Shelf \d+ of 44:/ })).toHaveCount(0);
	const more = pw.getByRole('button', { name: 'Show the whole shelf' });
	await expect(more).toHaveCount(1);
	await more.click();
	await expect(shelves).toHaveCount(22);
	await expect(pw.locator('.shelf-wide [data-spine]')).toHaveCount(5000);
	await expect(pw.getByRole('button', { name: /^Shelf 7 of 22:/ })).toBeFocused();
	await expect(more).toHaveCount(0);
});

test('a huge collection on a phone shows eight shelves and one button', async ({ page: pw }) => {
	await mockStored(pw, 'bigshelf', makeCollection(5000));
	await pw.setViewportSize({ width: 390, height: 844 });
	await pw.goto('/u/bigshelf');
	const shelves = pw.getByRole('button', { name: /^Shelf \d+ of 44:/ });
	await expect(shelves).toHaveCount(8);
	await expect(pw.getByRole('button', { name: 'Show the whole shelf' })).toHaveCount(1);
	await pw.getByRole('button', { name: 'Show the whole shelf' }).click();
	await expect(shelves).toHaveCount(44);
	expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('an empty collection is one board and a line', async ({ page: pw }) => {
	await mockStored(pw, 'emptyshelf', []);
	await pw.goto('/u/emptyshelf');
	await expect(pw.locator('.shelf-wide')).toContainText('Nothing on the shelf yet.');
	await expect(pw.locator('.shelf-wide .board')).toHaveCount(1);
	await expect(pw.getByText('one spine each')).toHaveCount(0);
	await expect(pw.getByRole('button', { name: /^Shelf / })).toHaveCount(0);
});

test('one record says "1 record"', async ({ page: pw }) => {
	await mockStored(pw, 'oneshelf', makeCollection(1));
	await pw.goto('/u/oneshelf');
	await expect(pw.getByText('1 record, one spine each.')).toBeVisible();
	await expect(pw.getByRole('button', { name: /^Shelf 1 of 1: 1 record, / })).toBeVisible();
});

test('a small collection is a partly filled shelf, left-aligned', async ({ page: pw }) => {
	await mockStored(pw, 'smallshelf', makeCollection(10));
	await pw.goto('/u/smallshelf');
	const spines = pw.locator('.shelf-wide [data-spine]');
	await expect(spines).toHaveCount(10);
	await expect(pw.locator('.shelf-wide .board')).toHaveCount(1);
	const board = (await pw.locator('.shelf-wide .board').boundingBox())!;
	const first = (await spines.first().boundingBox())!;
	const last = (await spines.last().boundingBox())!;
	expect(first.x).toBeCloseTo(board.x, 0);
	expect(last.x + last.width).toBeLessThan(board.x + board.width / 2);
	// No spine is wider than about 12px per unit (the widest single record is 1.4 units).
	for (const box of await spines.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))) {
		expect(box).toBeLessThanOrEqual(4 * 1.4 * 12 + 0.5);
	}
});
