import { describe, it, expect, afterEach, vi } from 'vitest';
import { prefersReducedMotion, scrollBehavior } from './motion';

afterEach(() => {
	vi.unstubAllGlobals();
});

function stubMatchMedia(matches: boolean) {
	vi.stubGlobal('window', {
		matchMedia: (q: string) => ({ matches: q.includes('reduce') ? matches : false })
	});
}

describe('prefersReducedMotion', () => {
	it('returns true when the user prefers reduced motion', () => {
		stubMatchMedia(true);
		expect(prefersReducedMotion()).toBe(true);
		expect(scrollBehavior()).toBe('auto');
	});

	it('returns false otherwise', () => {
		stubMatchMedia(false);
		expect(prefersReducedMotion()).toBe(false);
		expect(scrollBehavior()).toBe('smooth');
	});

	it('errs to false when window is unavailable', () => {
		expect(prefersReducedMotion()).toBe(false);
	});
});
