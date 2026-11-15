import type { Action } from 'svelte/action';
import { stepTab, type TabId } from '$lib/profile/tabs';

export interface KeyboardNavParams {
	/** The open tab. */
	tab: () => TabId;
	/** Open a tab (j / k). */
	onTab: (tab: TabId) => void;
	/** Open Records and focus its search (/ or s). */
	onSearch: () => void;
	/** Whether the collection drawer is currently open (Escape closes it). */
	isDrawerOpen: () => boolean;
	/** Close the collection drawer. */
	onCloseDrawer: () => void;
	/** Show the keyboard-shortcuts help overlay. */
	onShowHelp?: () => void;
}

/**
 * Page-level keyboard shortcuts for the profile route:
 * - j / k        → next / previous tab
 * - / or s       → open Records and focus its search
 * - ?            → show the shortcuts
 * - Escape       → close the drawer (when open)
 * Nothing but Escape fires while typing in a field.
 *
 * Implemented as an action so the listener lifecycle is tied to the element's
 * mount (and so it never runs during SSR). Reads live state via the getter
 * callbacks, so no `update` plumbing is required for reactivity.
 */
export const keyboardNav: Action<HTMLElement, KeyboardNavParams> = (node, params) => {
	let current = params;

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const isInput =
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.tagName === 'SELECT' ||
			target.isContentEditable;

		if (e.key === 'Escape' && current.isDrawerOpen()) {
			current.onCloseDrawer();
			return;
		}

		if (isInput) return;

		if (e.key === '?') {
			e.preventDefault();
			current.onShowHelp?.();
			return;
		}

		if (e.key === '/' || e.key === 's') {
			e.preventDefault();
			current.onSearch();
			return;
		}

		if (e.key === 'j' || e.key === 'k') {
			current.onTab(stepTab(current.tab(), e.key === 'j' ? 1 : -1));
		}
	}

	document.addEventListener('keydown', handleKeydown);

	return {
		update(next: KeyboardNavParams) {
			current = next;
		},
		destroy() {
			document.removeEventListener('keydown', handleKeydown);
		}
	};
};
