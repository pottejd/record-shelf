import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'record-shelf-theme';

function loadTheme(): Theme {
	if (!browser) return 'system';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
	return 'system';
}

function createThemeStore() {
	const { subscribe, set } = writable<Theme>(loadTheme());

	return {
		subscribe,
		set: (value: Theme) => {
			if (browser) {
				localStorage.setItem(STORAGE_KEY, value);
				applyTheme(value);
			}
			set(value);
		}
	};
}

export function applyTheme(theme: Theme) {
	if (!browser) return;
	const root = document.documentElement;
	if (theme === 'system') {
		root.removeAttribute('data-theme');
	} else {
		root.setAttribute('data-theme', theme);
	}
}

export const theme = createThemeStore();
