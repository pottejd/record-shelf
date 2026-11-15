import { describe, it, expect } from 'vitest';
import { barLinks, hasRefresh } from './links';

describe('top bar links', () => {
	it('profile', () =>
		expect(barLinks('/u/[username=username]', { username: 'bob' })).toEqual([
			{ label: 'Wantlist', href: '/u/bob/wantlist' },
			{ label: 'Discogs', href: 'https://www.discogs.com/user/bob', external: true },
			{ label: 'Settings', href: '/settings' }
		]));
	it('wantlist', () =>
		expect(barLinks('/u/[username=username]/wantlist', { username: 'bob' })).toEqual([
			{ label: 'Collection', href: '/u/bob' },
			{ label: 'Settings', href: '/settings' }
		]));
	it('everywhere else', () => {
		const other = [
			{ label: 'Compare', href: '/compare' },
			{ label: 'Settings', href: '/settings' }
		];
		for (const id of ['/', '/settings', '/compare', '/compare/[user1=username]/[user2=username]', null])
			expect(barLinks(id, {})).toEqual(other);
	});
	it('refresh only on the profile', () => {
		expect(hasRefresh('/u/[username=username]')).toBe(true);
		expect(hasRefresh('/u/[username=username]/wantlist')).toBe(false);
	});
	it('a username is encoded in hrefs', () =>
		expect(barLinks('/u/[username=username]', { username: 'a b' })[0].href).toBe('/u/a%20b/wantlist'));
});
