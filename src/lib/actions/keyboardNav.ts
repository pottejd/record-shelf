import type { Action } from 'svelte/action';
import { scrollBehavior } from '$lib/utils/motion';

export interface KeyboardNavParams {
	/** Section element ids, in document order, for j/k navigation. */
	sectionIds: string[];
	/** Whether the collection drawer is currently open (Escape closes it). */
	isDrawerOpen: () => boolean;
	/** Close the collection drawer. */
	onCloseDrawer: () => void;
}

/**
 * Page-level keyboard shortcuts for the profile route:
 * - j / k        → scroll to the next / previous section
 * - / or s       → focus the collection search box
 * - Escape       → close the drawer (when open)
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
			target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

		if (e.key === 'Escape' && current.isDrawerOpen()) {
			current.onCloseDrawer();
			return;
		}

		if (isInput) return;

		if (e.key === '/' || e.key === 's') {
			e.preventDefault();
			const searchInput = document.querySelector<HTMLInputElement>(
				'#collection input[type="search"], #collection input[type="text"]'
			);
			if (searchInput) {
				searchInput.focus();
				searchInput.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
			}
			return;
		}

		if (e.key === 'j' || e.key === 'k') {
			const sectionIds = current.sectionIds;
			const found = sectionIds.findIndex((id) => {
				const el = document.getElementById(id);
				if (!el) return false;
				const rect = el.getBoundingClientRect();
				return rect.top <= 100 && rect.bottom > 100;
			});
			const idx = found === -1 ? 0 : found;
			const next =
				e.key === 'j' ? Math.min(idx + 1, sectionIds.length - 1) : Math.max(idx - 1, 0);
			const el = document.getElementById(sectionIds[next]);
			if (el) el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
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
