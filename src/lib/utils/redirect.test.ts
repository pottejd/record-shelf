import { describe, it, expect } from 'vitest';
import { safeRedirectTarget } from './redirect';

describe('safeRedirectTarget', () => {
	it('allows a same-origin absolute path', () => {
		expect(safeRedirectTarget('/u/pottejd')).toBe('/u/pottejd');
	});

	it('preserves query strings on a same-origin path', () => {
		expect(safeRedirectTarget('/compare/a/b?x=1')).toBe('/compare/a/b?x=1');
	});

	it('falls back for null/undefined/empty', () => {
		expect(safeRedirectTarget(null)).toBe('/');
		expect(safeRedirectTarget(undefined)).toBe('/');
		expect(safeRedirectTarget('')).toBe('/');
	});

	it('rejects protocol-relative URLs (//evil.com)', () => {
		expect(safeRedirectTarget('//evil.com')).toBe('/');
	});

	it('rejects backslash-tricked protocol-relative URLs (/\\evil.com)', () => {
		expect(safeRedirectTarget('/\\evil.com')).toBe('/');
	});

	it('rejects absolute URLs with a scheme', () => {
		expect(safeRedirectTarget('https://evil.com')).toBe('/');
		expect(safeRedirectTarget('javascript:alert(1)')).toBe('/');
	});

	it('rejects paths that do not start with a single slash', () => {
		expect(safeRedirectTarget('u/pottejd')).toBe('/');
	});

	it('uses a custom fallback when provided', () => {
		expect(safeRedirectTarget('//evil.com', '/settings')).toBe('/settings');
	});
});
