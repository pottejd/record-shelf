import { describe, it, expect } from 'vitest';
import { match } from './username';

describe('username param matcher', () => {
	it('accepts a typical Discogs username', () => {
		expect(match('pottejd')).toBe(true);
	});

	it('accepts letters, digits, underscore, dot and hyphen', () => {
		expect(match('Valid_user-name.1')).toBe(true);
	});

	it('accepts a 50-character username (upper boundary)', () => {
		expect(match('a'.repeat(50))).toBe(true);
	});

	it('rejects an empty string', () => {
		expect(match('')).toBe(false);
	});

	it('rejects a username longer than 50 characters', () => {
		expect(match('a'.repeat(51))).toBe(false);
	});

	it('rejects path separators', () => {
		expect(match('bad/slash')).toBe(false);
		expect(match('back\\slash')).toBe(false);
	});

	it('rejects whitespace', () => {
		expect(match('has space')).toBe(false);
	});

	it('rejects URL-reserved characters that could corrupt the Discogs request', () => {
		expect(match('query?inject')).toBe(false);
		expect(match('frag#ment')).toBe(false);
		expect(match('semi;colon')).toBe(false);
		expect(match('per%cent')).toBe(false);
	});
});
