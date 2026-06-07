// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reveal } from './reveal';

let ioCallback: (entries: Array<{ isIntersecting: boolean }>) => void;
let observeSpy: ReturnType<typeof vi.fn>;
let unobserveSpy: ReturnType<typeof vi.fn>;
let disconnectSpy: ReturnType<typeof vi.fn>;

function stubMatchMedia(reduced: boolean) {
	window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as any;
}

describe('reveal action', () => {
	beforeEach(() => {
		observeSpy = vi.fn();
		unobserveSpy = vi.fn();
		disconnectSpy = vi.fn();
		(globalThis as any).IntersectionObserver = class {
			observe = observeSpy;
			unobserve = unobserveSpy;
			disconnect = disconnectSpy;
			constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
				ioCallback = cb;
			}
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('leaves the element untouched when reduced motion is preferred', () => {
		stubMatchMedia(true);
		const node = document.createElement('div');

		const ret = reveal(node);

		expect(node.style.opacity).toBe('');
		expect(observeSpy).not.toHaveBeenCalled();
		expect(() => ret?.destroy?.()).not.toThrow();
	});

	it('hides the element and observes it, then reveals on intersection', () => {
		stubMatchMedia(false);
		const node = document.createElement('div');

		reveal(node);

		expect(node.style.opacity).toBe('0');
		expect(node.style.transform).toBe('translateY(16px)');
		expect(observeSpy).toHaveBeenCalledWith(node);

		ioCallback([{ isIntersecting: true }]);

		expect(node.style.opacity).toBe('1');
		expect(node.style.transform).toBe('translateY(0)');
		expect(unobserveSpy).toHaveBeenCalledWith(node);
	});

	it('stays hidden while the element is not intersecting', () => {
		stubMatchMedia(false);
		const node = document.createElement('div');

		reveal(node);
		ioCallback([{ isIntersecting: false }]);

		expect(node.style.opacity).toBe('0');
		expect(unobserveSpy).not.toHaveBeenCalled();
	});

	it('disconnects the observer on destroy', () => {
		stubMatchMedia(false);
		const node = document.createElement('div');

		const ret = reveal(node);
		ret?.destroy?.();

		expect(disconnectSpy).toHaveBeenCalled();
	});
});
