// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keyboardNav, type KeyboardNavParams } from './keyboardNav';
import type { TabId } from '$lib/profile/tabs';

let active: { destroy?: () => void } | undefined;

function mount(params: Partial<KeyboardNavParams> = {}) {
	const full: KeyboardNavParams = {
		tab: () => 'overview',
		onTab: vi.fn(),
		onSearch: vi.fn(),
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

	it('opens the next tab on "j" and the previous on "k"', () => {
		let tab: TabId = 'charts';
		const params = mount({ tab: () => tab });
		press('j');
		expect(params.onTab).toHaveBeenLastCalledWith('activity');
		tab = 'activity';
		press('k');
		expect(params.onTab).toHaveBeenLastCalledWith('charts');
	});

	it('stays on the first and last tab', () => {
		let tab: TabId = 'overview';
		const params = mount({ tab: () => tab });
		press('k');
		expect(params.onTab).toHaveBeenLastCalledWith('overview');
		tab = 'extras';
		press('j');
		expect(params.onTab).toHaveBeenLastCalledWith('extras');
	});

	it('asks for the search on "/" and "s", and prevents default', () => {
		const params = mount();
		const slash = press('/');
		const s = press('s');
		expect(params.onSearch).toHaveBeenCalledTimes(2);
		expect(slash.defaultPrevented).toBe(true);
		expect(s.defaultPrevented).toBe(true);
	});

	it('ignores every shortcut while typing in an input', () => {
		const params = mount();
		const input = document.createElement('input');
		document.body.appendChild(input);
		for (const key of ['?', '/', 's', 'j', 'k']) press(key, input);
		expect(params.onShowHelp).not.toHaveBeenCalled();
		expect(params.onSearch).not.toHaveBeenCalled();
		expect(params.onTab).not.toHaveBeenCalled();
	});

	it('ignores shortcuts while typing in a textarea or choosing in a select', () => {
		const params = mount();
		const area = document.createElement('textarea');
		const select = document.createElement('select');
		document.body.append(area, select);
		press('j', area);
		press('s', select);
		expect(params.onTab).not.toHaveBeenCalled();
		expect(params.onSearch).not.toHaveBeenCalled();
	});

	it('removes the listener on destroy', () => {
		const params = mount({ isDrawerOpen: () => true });
		active?.destroy?.();
		active = undefined;
		press('Escape');
		press('j');
		expect(params.onCloseDrawer).not.toHaveBeenCalled();
		expect(params.onTab).not.toHaveBeenCalled();
	});
});
