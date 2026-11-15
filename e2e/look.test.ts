import { test, type Page } from '@playwright/test';
import { makeCollection, mockStored, mockStoredWantlist, withToken } from './fixtures/collection';

// Opt-in: `LOOK=1 npx playwright test e2e/look.test.ts` writes full-page screenshots to test-results/look/.
test.skip(!process.env.LOOK, 'opt-in');

const pages = [
	'/', '/settings', '/compare', '/u/lookuser',
	'/u/lookuser?tab=records', '/u/lookuser?tab=charts', '/u/lookuser?tab=activity', '/u/lookuser?tab=extras',
	'/u/lookuser/wantlist', '/compare/lookuser/lookfriend'
];
const sizes = [{ width: 1280, height: 900 }, { width: 390, height: 844 }];
const schemes = ['light', 'dark'] as const;

const slug = (path: string) => path.replace(/^\//, '').replace(/[/?=&]+/g, '-') || 'home';

/** Wakes the lazy parts: waits for fonts, walks down the page and back, then lets the network settle. */
async function settle(pw: Page) {
	await pw.evaluate(() => document.fonts.ready);
	await pw.evaluate(async () => {
		const step = Math.max(200, Math.floor(window.innerHeight / 2));
		for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
			window.scrollTo(0, y);
			await new Promise((r) => setTimeout(r, 120));
		}
		window.scrollTo(0, document.documentElement.scrollHeight);
		await new Promise((r) => setTimeout(r, 200));
		window.scrollTo(0, 0);
	});
	await pw.waitForLoadState('networkidle');
	await pw.waitForTimeout(300);
}

for (const path of pages) {
	for (const size of sizes) {
		for (const scheme of schemes) {
			test(`look ${path} ${size.width} ${scheme}`, async ({ page: pw }) => {
				await withToken(pw);
				await mockStored(pw, 'lookuser', makeCollection(679));
				await mockStored(pw, 'lookfriend', makeCollection(420, 2));
				await mockStoredWantlist(pw, 'lookuser', 85);
				await pw.setViewportSize(size);
				await pw.emulateMedia({ colorScheme: scheme });
				await pw.goto(path);
				await settle(pw);
				await pw.screenshot({ fullPage: true, path: `test-results/look/${slug(path)}-${size.width}-${scheme}.png` });
			});
		}
	}
}
