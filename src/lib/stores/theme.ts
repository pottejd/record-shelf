import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { LIGHT, DARK } from '$lib/theme/tokens';

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
	// The two theme-color metas live in app.html, light first. A browser takes the
	// first one whose media matches, so a chosen theme sets both to its colour and
	// "system" gives each scheme its own.
	const colour = theme === 'dark' ? DARK.ground : theme === 'light' ? LIGHT.ground : null;
	const light = document.getElementById('theme-color-light');
	const dark = document.getElementById('theme-color-dark');
	light?.setAttribute('content', colour ?? LIGHT.ground);
	dark?.setAttribute('content', colour ?? DARK.ground);
	if (theme === 'system') {
		root.removeAttribute('data-theme');
	} else {
		root.setAttribute('data-theme', theme);
	}
}

export const theme = createThemeStore();
