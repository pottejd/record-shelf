// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keyboardNav, type KeyboardNavParams } from './keyboardNav';

let active: { destroy?: () => void } | undefined;

function mount(params: Partial<KeyboardNavParams> = {}) {
	const full: KeyboardNavParams = {
		sectionIds: [],
		isDrawerOpen: () => false,
		onCloseDrawer: vi.fn(),
		onShowHelp: vi.fn(),
		...params
	};
	const node = document.createElement('div');
	active = keyboardNav(node, full) as { destroy?: () => void };
	return full;
}

function press(key: string, from: EventTarget = document.body) {
	const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	from.dispatchEvent(e);
	return e;
}

describe('keyboardNav action', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
		Element.prototype.scrollIntoView = vi.fn();
	});

	afterEach(() => {
		active?.destroy?.();
		active = undefined;
		vi.restoreAllMocks();
	});

	it('closes the drawer on Escape when it is open', () => {
		const params = mount({ isDrawerOpen: () => true });
		press('Escape');
		expect(params.onCloseDrawer).toHaveBeenCalledTimes(1);
	});

	it('ignores Escape when the drawer is closed', () => {
		const params = mount({ isDrawerOpen: () => false });
		press('Escape');
		expect(params.onCloseDrawer).not.toHaveBeenCalled();
	});

	it('shows help on "?" and prevents default', () => {
		const params = mount();
		const e = press('?');
		expect(params.onShowHelp).toHaveBeenCalledTimes(1);
		expect(e.defaultPrevented).toBe(true);
	});

	it('ignores shortcuts while typing in an input', () => {
		const params = mount();
		const input = document.createElement('input');
		document.body.appendChild(input);
		press('?', input);
		expect(params.onShowHelp).not.toHaveBeenCalled();
	});

	it('focuses the collection search box on "/"', () => {
		document.body.innerHTML = '<div id="collection"><input type="search" /></div>';
		mount();
		const search = document.querySelector('input')!;

		const e = press('/');

		expect(document.activeElement).toBe(search);
		expect(e.defaultPrevented).toBe(true);
		expect(search.scrollIntoView).toHaveBeenCalled();
	});

	it('scrolls to the next section on "j"', () => {
		document.body.innerHTML = '<div id="s1"></div><div id="s2"></div>';
		mount({ sectionIds: ['s1', 's2'] });

		press('j');

		// No section is "current" (jsdom rects are 0), so idx=0 → next=s2
		expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
	});

	it('removes the listener on destroy', () => {
		const params = mount({ isDrawerOpen: () => true });
		active?.destroy?.();
		active = undefined;
		press('Escape');
		expect(params.onCloseDrawer).not.toHaveBeenCalled();
	});
});
