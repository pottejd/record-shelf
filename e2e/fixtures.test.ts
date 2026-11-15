import { test, expect } from '@playwright/test';
import { makeCollection, mockStored, mockStoredWantlist } from './fixtures/collection';

test('every mock on one page reports the true number of Discogs calls, and each call is aborted', async ({ page: pw }) => {
	const a = await mockStored(pw, 'one', makeCollection(5));
	const b = await mockStored(pw, 'two', makeCollection(5, 2));
	await mockStoredWantlist(pw, 'one', 5);
	await pw.goto('/settings');
	const failed = await pw.evaluate(async () => {
		let n = 0;
		for (const path of ['users/one', 'users/two']) {
			try { await fetch(`https://api.discogs.com/${path}`); } catch { n++; }
		}
		return n;
	});
	expect(failed).toBe(2);
	expect(a.discogsCalls()).toBe(2);
	expect(b.discogsCalls()).toBe(2);
});
