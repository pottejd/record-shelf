import { test, expect, type Locator, type Page } from '@playwright/test';
import { makeCollection, mockStored, withToken } from './fixtures/collection';

test.beforeEach(async ({ page: pw }) => {
	await withToken(pw);
});

interface Box { x: number; y: number; width: number; height: number }

/**
 * Waits for the page to settle before anything is measured. The fixture's copy is
 * over a day old, so the first load is followed by a background refresh, and the
 * status line under the tab row comes and goes while they run, moving everything
 * below it by its height.
 */
async function settled(pw: Page): Promise<void> {
	await pw.waitForLoadState('networkidle');
}

/**
 * The boxes of elements under `scope`, all read in one go so they come from the
 * same layout: `{ text }` is the innermost element whose whole text is that,
 * `{ css }` the first match of that selector.
 */
async function boxesOf(scope: Locator, targets: Array<{ text: string } | { css: string }>): Promise<Box[]> {
	return scope.evaluate((root, targets) => targets.map((t) => {
		const el = 'css' in t
			? root.querySelector(t.css)
			: [...root.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent?.trim() === t.text);
		if (!el) throw new Error(`nothing for ${JSON.stringify(t)}`);
		const r = el.getBoundingClientRect();
		return { x: r.x, y: r.y, width: r.width, height: r.height };
	}), targets);
}

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
	await expect(pw.getByRole('heading', { name: 'Vinyl upgrade picks' })).toBeVisible();
	await settled(pw);
	const [dupes, picks] = await boxesOf(pw.locator('#records'), [{ text: 'Duplicates and variants' }, { text: 'Vinyl upgrade picks' }]);
	expect(picks.y).toBeCloseTo(dupes.y, 0);
	expect(picks.x).toBeGreaterThan(dupes.x + dupes.width);
	await pw.locator('.upg-list').getByRole('button', { name: new RegExp(`^${UPGRADE_TITLE}`) }).click();
	await expect(pw.getByRole('dialog')).toBeVisible();
});

test('Records on a phone: upgrade picks keep their titles readable', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', withDuplicateAndUpgrade(makeCollection(150)));
	await pw.setViewportSize({ width: 390, height: 844 });
	await pw.goto('/u/tabuser?tab=records');
	await expect(pw.getByRole('heading', { name: 'Vinyl upgrade picks' })).toBeVisible();
	await settled(pw);
	const [dupes, picks] = await boxesOf(pw.locator('#records'), [{ text: 'Duplicates and variants' }, { text: 'Vinyl upgrade picks' }]);
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

const CHARTS_LEFT = ['By genre', 'Top styles', 'Ratings', 'Artist loyalty'];
const CHARTS_RIGHT = ['By format', 'Top labels', 'Release years', 'Collection DNA'];

test('Charts: two columns as drawn, no donut, the release ends under the year grid', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=charts');
	const charts = pw.locator('#charts');
	await expect(charts).toBeVisible();
	await expect(charts.locator('h2')).toHaveText([...CHARTS_LEFT, ...CHARTS_RIGHT]);
	await expect(charts.locator('svg circle')).toHaveCount(0);

	await settled(pw);
	const ENDS = ['Oldest release', 'Newest release'];
	const boxes = await boxesOf(charts, [
		...[...CHARTS_LEFT, ...CHARTS_RIGHT, ...ENDS].map((text) => ({ text })),
		{ css: '.year-heatmap' }
	]);
	const left = boxes.slice(0, 4);
	const right = boxes.slice(4, 8);
	const ends = boxes.slice(8, 10);
	const grid = boxes[10];
	for (const column of [left, right]) {
		for (let i = 1; i < column.length; i++) {
			expect(column[i].x).toBeCloseTo(column[0].x, 0);
			expect(column[i].y).toBeGreaterThan(column[i - 1].y);
		}
	}
	expect(right[0].x).toBeGreaterThan(left[0].x + left[0].width);
	expect(right[0].y).toBeCloseTo(left[0].y, 0);

	// "Oldest release" and "Newest release" sit under the year grid, above Collection DNA.
	const dna = right[3];
	for (const at of ends) {
		expect(at.y).toBeGreaterThan(grid.y + grid.height);
		expect(at.y).toBeLessThan(dna.y);
		expect(at.x).toBeGreaterThanOrEqual(right[0].x - 0.5);
	}

	// The first genre opens the side list with its records.
	const genres = charts.locator('section', { has: pw.getByRole('heading', { name: 'By genre' }) });
	const first = genres.getByRole('button').first();
	const genre = (await first.locator('.label').textContent())!.trim();
	await first.click();
	const dialog = pw.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(genre);
});

test('Charts on a phone: one column in reading order, no sideways scroll', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.setViewportSize({ width: 390, height: 844 });
	await pw.goto('/u/tabuser?tab=charts');
	const charts = pw.locator('#charts');
	await expect(charts.locator('h2')).toHaveText([...CHARTS_LEFT, ...CHARTS_RIGHT]);
	await settled(pw);
	const boxes = await boxesOf(charts, [...CHARTS_LEFT, ...CHARTS_RIGHT].map((text) => ({ text })));
	for (let i = 1; i < boxes.length; i++) {
		expect(boxes[i].x).toBeCloseTo(boxes[0].x, 0);
		expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
	}
	expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Charts: a year shows its count on hover and on keyboard focus; an empty year is not a button', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=charts');
	const grid = pw.locator('#charts .year-heatmap');
	const years = grid.getByRole('button', { name: /^\d{4}: \d+ releases?$/ });
	expect(await years.count()).toBeGreaterThan(10);

	// Keyboard: Tab from the year before lands on the next year, which shows its label.
	await years.nth(0).focus();
	await pw.keyboard.press('Tab');
	const focused = years.nth(1);
	await expect(focused).toBeFocused();
	const name = (await focused.getAttribute('aria-label'))!;
	await expect(focused.locator('.year-tip')).toBeVisible();
	await expect(focused.locator('.year-tip')).toHaveText(name);

	// Mouse: hovering another year shows that year's label.
	const hovered = years.nth(5);
	await expect(hovered.locator('.year-tip')).toBeHidden();
	await hovered.hover();
	await expect(hovered.locator('.year-tip')).toBeVisible();
	await expect(hovered.locator('.year-tip')).toHaveText((await hovered.getAttribute('aria-label'))!);

	// The fixture leaves some years empty: those cells are plain, not buttons.
	const empty = grid.locator('[data-empty]');
	expect(await empty.count()).toBeGreaterThan(0);
	expect(await empty.evaluateAll((els) => els.filter((e) => e.tagName === 'BUTTON').length)).toBe(0);

	await years.first().click();
	await expect(pw.getByRole('dialog')).toBeVisible();
});

const ACTIVITY_LEFT = ['Collection growth', 'New vs vintage', 'Genre evolution'];
const ACTIVITY_RIGHT = ['Collecting activity', 'Day patterns', 'Milestones'];
/** The reading order, and the order on a phone. */
const ACTIVITY = ['Collecting calendar', ...ACTIVITY_LEFT, ...ACTIVITY_RIGHT, 'Collection timeline'];

test('Activity: the calendar across the top, two columns as drawn, the timeline across the foot', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.goto('/u/tabuser?tab=activity');
	const activity = pw.locator('#activity');
	await expect(activity.locator('h2')).toHaveText(ACTIVITY);

	await settled(pw);
	const boxes = await boxesOf(activity, ACTIVITY.map((text) => ({ text })));
	const calendar = boxes[0];
	const left = boxes.slice(1, 4);
	const right = boxes.slice(4, 7);
	const timeline = boxes[7];
	for (const column of [left, right]) {
		for (let i = 1; i < column.length; i++) {
			expect(column[i].x).toBeCloseTo(column[0].x, 0);
			expect(column[i].y).toBeGreaterThan(column[i - 1].y);
		}
	}
	expect(right[0].x).toBeGreaterThan(left[0].x + left[0].width);
	expect(right[0].y).toBeCloseTo(left[0].y, 0);
	expect(calendar.y).toBeLessThan(left[0].y);
	expect(calendar.x).toBeCloseTo(left[0].x, 0);
	expect(timeline.y).toBeGreaterThan(Math.max(left[2].y, right[2].y));
	expect(timeline.x).toBeCloseTo(left[0].x, 0);

	// 150 records: the next milestone is Collector, at 250.
	const milestones = activity.locator('section', { has: pw.getByRole('heading', { name: 'Milestones' }) });
	await expect(milestones.getByText('Next: Collector, at 250 records')).toBeVisible();
	await expect(milestones.getByText('150 of 250')).toBeVisible();
	await expect(milestones.getByText('100 to go')).toBeVisible();
	await expect(milestones.getByText('Century')).toBeVisible();

	// The growth line's end dot is the one round shape; the last month's count is
	// written beside it, and every month is in a list for screen readers.
	await expect(activity.locator('svg circle')).toHaveCount(0);
	await expect(activity.locator('.end-dot')).toHaveCount(1);
	const growth = pw.getByRole('list', { name: 'Collection growth by month' });
	const last = (await growth.locator('li').last().textContent())!;
	await expect(activity.locator('.end-value')).toBeVisible();
	await expect(activity.locator('.end-value')).toHaveText(last.match(/: (\d+) records?$/)![1]);

	// No two lists on the tab share a name.
	const names = await activity.locator('ul[aria-label], ol[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
	expect(names.length).toBeGreaterThan(1);
	expect(new Set(names).size).toBe(names.length);

	// Bars and columns carry their numbers in text.
	const days = activity.locator('section', { has: pw.getByRole('heading', { name: 'Day patterns' }) });
	for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) await expect(days.getByText(day, { exact: true })).toBeVisible();
	await expect(days.locator('.value')).toHaveCount(7);
	const vintage = activity.locator('section', { has: pw.getByRole('heading', { name: 'New vs vintage' }) });
	await expect(vintage.getByText('Average age when bought')).toBeVisible();
	await expect(vintage.getByText(/^\d+ \(\d+%\)$/)).toHaveCount(4);
	const collecting = activity.locator('section', { has: pw.getByRole('heading', { name: 'Collecting activity' }) });
	for (const fact of ['Average per month', 'Peak month', 'Month streak']) await expect(collecting.getByText(fact, { exact: true })).toBeVisible();
});

test('Activity on a phone: one column in reading order; only the calendar and the timeline scroll sideways', async ({ page: pw }) => {
	await mockStored(pw, 'tabuser', makeCollection(150));
	await pw.setViewportSize({ width: 390, height: 844 });
	await pw.goto('/u/tabuser?tab=activity');
	const activity = pw.locator('#activity');
	await expect(activity.locator('h2')).toHaveText(ACTIVITY);
	await settled(pw);
	const boxes = await boxesOf(activity, ACTIVITY.map((text) => ({ text })));
	for (let i = 1; i < boxes.length; i++) {
		expect(boxes[i].x).toBeCloseTo(boxes[0].x, 0);
		expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
	}
	expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

	// The calendar scrolls inside its own box, and opens on the latest weeks.
	const calendar = pw.getByRole('grid', { name: 'Records added each day in the past year' });
	const fit = await calendar.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, left: el.scrollLeft }));
	expect(fit.scroll).toBeGreaterThan(fit.client);
	expect(fit.left).toBeGreaterThan(0);

	// The timeline scrolls inside its own named box, and the keyboard scrolls it.
	const timeline = pw.getByRole('region', { name: 'Records added month by month' });
	expect(await timeline.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
	await timeline.focus();
	await pw.keyboard.press('ArrowRight');
	await expect.poll(() => timeline.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});


/**
 * A collection whose last days are known: Saturday 14 November 2026 has two
 * records, the Friday before it one, and the Friday a week before that one.
 */
function calendarCollection() {
	const items = makeCollection(150);
	const dates = ['2026-11-14', '2026-11-14', '2026-11-13', '2026-11-06'];
	dates.forEach((d, i) => { items[i] = { ...items[i], date_added: `${d}T12:00:00.000Z` }; });
	const on = (d: string) => items.filter((i) => i.date_added.startsWith(d)).length;
	/** The label of a day, as the calendar writes it. */
	const label = (day: string, d: string) => `${day}: ${on(d) === 0 ? 'no records' : `${on(d)} record${on(d) === 1 ? '' : 's'}`}`;
	return { items, label };
}

/**
 * The focused day's label against the calendar's scroll box and the page: where
 * it sits, whether the box holds it (and so could cut it), and the day's box.
 */
async function calendarTip(pw: Page) {
	return pw.locator('#activity').evaluate((root) => {
		const tip = root.querySelector('.day-tip');
		const box = root.querySelector('[role="grid"]')!;
		const day = document.activeElement!;
		const r = (el: Element) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
		return {
			tip: tip ? r(tip) : null,
			text: tip?.textContent ?? null,
			visible: tip ? getComputedStyle(tip).visibility === 'visible' : false,
			insideBox: tip ? box.contains(tip) : false,
			box: r(box),
			day: r(day),
			name: day.getAttribute('aria-label'),
			page: document.documentElement.clientWidth
		};
	});
}

/** The label is shown whole: beside its day, inside the box's visible part and inside the page. */
function expectWholeTip(t: Awaited<ReturnType<typeof calendarTip>>) {
	expect(t.tip).not.toBeNull();
	expect(t.visible).toBe(true);
	expect(t.text).toBe(t.name);
	expect(t.insideBox).toBe(false); // so the scroll box cannot cut it
	const tip = t.tip!;
	expect(tip.right - tip.left).toBeGreaterThan(100);
	expect(tip.left).toBeGreaterThanOrEqual(Math.max(0, t.box.left) - 0.5);
	expect(tip.right).toBeLessThanOrEqual(Math.min(t.page, t.box.right) + 0.5);
	// Over or under its day, and covering its column.
	expect(Math.abs(tip.top - (t.day.bottom + 6)) < 1 || Math.abs(tip.bottom - (t.day.top - 6)) < 1).toBe(true);
	expect(tip.left).toBeLessThanOrEqual(t.day.left + 0.5);
	expect(tip.right).toBeGreaterThanOrEqual(t.day.right - 0.5);
}

test.describe('Activity calendar by keyboard', () => {
	test.use({ timezoneId: 'UTC' });

	test('the calendar is one tab stop; arrow keys move the day and show its count', async ({ page: pw }) => {
		await pw.clock.setFixedTime(new Date('2026-11-14T18:00:00Z'));
		const { items, label } = calendarCollection();
		await mockStored(pw, 'tabuser', items);
		await pw.goto('/u/tabuser?tab=activity');
		const grid = pw.getByRole('grid', { name: 'Records added each day in the past year' });
		await expect(grid).toBeVisible();
		await settled(pw);
		await expect(grid.locator('[tabindex="0"]')).toHaveCount(1);
		const tip = pw.locator('#activity .day-tip');
		await expect(tip).toHaveCount(0);

		// One Tab from the tab row lands on the latest day with records, and shows its count.
		await pw.getByRole('link', { name: 'Extras' }).focus();
		await pw.keyboard.press('Tab');
		const sat = grid.getByRole('gridcell', { name: label('Sat, Nov 14, 2026', '2026-11-14') });
		await expect(sat).toBeFocused();
		await expect(tip).toBeVisible();
		await expect(tip).toHaveText(label('Sat, Nov 14, 2026', '2026-11-14'));

		// Up is the day before: the Friday, with its own count.
		await pw.keyboard.press('ArrowUp');
		const fri = grid.getByRole('gridcell', { name: label('Fri, Nov 13, 2026', '2026-11-13') });
		await expect(fri).toBeFocused();
		await expect(tip).toHaveText(label('Fri, Nov 13, 2026', '2026-11-13'));

		// Left is the week before.
		await pw.keyboard.press('ArrowLeft');
		const before = grid.getByRole('gridcell', { name: label('Fri, Nov 6, 2026', '2026-11-06') });
		await expect(before).toBeFocused();
		await expect(tip).toHaveText(label('Fri, Nov 6, 2026', '2026-11-06'));

		// A day with no records shows its label on keyboard focus too.
		await pw.keyboard.press('ArrowUp');
		const thu = grid.getByRole('gridcell', { name: label('Thu, Nov 5, 2026', '2026-11-05') });
		await expect(thu).toBeFocused();
		await expect(tip).toBeVisible();
		await expect(tip).toHaveText(label('Thu, Nov 5, 2026', '2026-11-05'));
		await pw.keyboard.press('ArrowDown');
		await expect(before).toBeFocused();

		// Still one tab stop, now on the day last chosen; Tab leaves the calendar and the label goes.
		await expect(grid.locator('[tabindex="0"]')).toHaveCount(1);
		await expect(before).toHaveAttribute('tabindex', '0');
		await pw.keyboard.press('Tab');
		expect(await grid.evaluate((el) => el.contains(document.activeElement))).toBe(false);
		await expect(tip).toHaveCount(0);
		await pw.keyboard.press('Shift+Tab');
		await expect(before).toBeFocused();
		await pw.keyboard.press('Tab');

		// Under the pointer an empty day stays silent; a day with records shows the same label.
		await grid.getByRole('gridcell', { name: /: no records$/ }).last().hover();
		await expect(tip).toHaveCount(0);
		await sat.hover();
		await expect(tip).toBeVisible();
		await expect(tip).toHaveText(label('Sat, Nov 14, 2026', '2026-11-14'));
		await pw.mouse.move(0, 0);
		await expect(tip).toHaveCount(0);
	});

	test('on a phone a focused day\'s label is whole at both edges of what is on screen', async ({ page: pw }) => {
		await pw.clock.setFixedTime(new Date('2026-11-14T18:00:00Z'));
		const { items } = calendarCollection();
		await mockStored(pw, 'tabuser', items);
		await pw.setViewportSize({ width: 390, height: 844 });
		await pw.goto('/u/tabuser?tab=activity');
		const grid = pw.getByRole('grid', { name: 'Records added each day in the past year' });
		await expect(grid).toBeVisible();
		await settled(pw);

		// The right edge: Tab lands on Saturday 14 November, the last day (bottom row, label above).
		await pw.getByRole('link', { name: 'Extras' }).focus();
		await pw.keyboard.press('Tab');
		const right = await calendarTip(pw);
		expect(right.day.right).toBeGreaterThan(right.box.right - 40);
		expectWholeTip(right);

		// The left edge of what is on screen, in the top row (label below) and the bottom row (label above).
		for (const row of [0, 6]) {
			await grid.evaluate((box, row) => {
				const b = box.getBoundingClientRect();
				const cells = [...box.querySelectorAll('[role="row"]')[row].querySelectorAll<HTMLElement>('[role="gridcell"]')];
				cells.find((c) => c.getBoundingClientRect().left >= b.left)!.focus();
			}, row);
			const left = await calendarTip(pw);
			expect(left.day.left).toBeLessThan(left.box.left + 40);
			expectWholeTip(left);
		}

		// Home goes to the first week: the box scrolls to its start and the label stays whole there.
		await pw.keyboard.press('Home');
		await expect.poll(() => grid.evaluate((el) => el.scrollLeft)).toBe(0);
		expectWholeTip(await calendarTip(pw));
		// End goes back to the last week, at the right edge.
		await pw.keyboard.press('End');
		const end = await calendarTip(pw);
		expect(end.day.right).toBeGreaterThan(end.box.right - 40);
		expectWholeTip(end);
		expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	});
});

for (const width of [1280, 390]) {
	test(`Genre evolution: a focused year shows its counts inside the page at ${width}px`, async ({ page: pw }) => {
		await mockStored(pw, 'tabuser', makeCollection(150));
		await pw.setViewportSize({ width, height: 900 });
		await pw.goto('/u/tabuser?tab=activity');
		const years = pw.locator('#activity .genre-evolution [role="group"]');
		await expect(years).toHaveCount(5);
		await settled(pw);

		// Keyboard focus, from the neighbouring year: the first with Shift+Tab, the last with Tab.
		for (const [at, from, key] of [[0, 1, 'Shift+Tab'], [4, 3, 'Tab']] as const) {
			await years.nth(from).focus();
			await pw.keyboard.press(key);
			const year = years.nth(at);
			await expect(year).toBeFocused();
			const counts = year.locator('.counts');
			await expect(counts).toHaveText(/^\S.*\d$/);
			const shown = await counts.evaluate((el) => {
				const b = el.getBoundingClientRect();
				return { left: b.left, right: b.right, width: b.width, height: b.height, clip: getComputedStyle(el).clipPath, page: document.documentElement.clientWidth };
			});
			expect(shown.clip).toBe('none');
			expect(shown.width).toBeGreaterThan(60);
			expect(shown.height).toBeGreaterThan(20);
			expect(shown.left).toBeGreaterThanOrEqual(0);
			expect(shown.right).toBeLessThanOrEqual(shown.page);
		}
		expect(await pw.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
	});
}
