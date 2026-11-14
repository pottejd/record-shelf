// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { tokenFromCookie } from './token';

const clear = (name: string) => (document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`);

describe('tokenFromCookie', () => {
	afterEach(() => ['discogs_token', 'other', 'not_discogs_token'].forEach(clear));

	it('is null when there is no token cookie', () => {
		document.cookie = 'other=1;path=/';
		document.cookie = 'not_discogs_token=nope;path=/';
		expect(tokenFromCookie()).toBeNull();
	});
	it('reads the cookie the settings store writes, decoded, among other cookies', () => {
		document.cookie = 'other=1;path=/';
		document.cookie = `discogs_token=${encodeURIComponent('abc DEF/123')};path=/`;
		expect(tokenFromCookie()).toBe('abc DEF/123');
	});
	it('is null for an empty cookie, and returns a value that will not decode as it is', () => {
		document.cookie = 'discogs_token=;path=/';
		expect(tokenFromCookie()).toBeNull();
		document.cookie = 'discogs_token=%E0%A4%A;path=/';
		expect(tokenFromCookie()).toBe('%E0%A4%A');
	});
});
