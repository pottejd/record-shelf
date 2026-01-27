import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'record-shelf-settings';
const TOKEN_COOKIE = 'discogs_token';

export interface Settings {
	discogsToken: string;
}

const defaultSettings: Settings = {
	discogsToken: ''
};

function setCookie(name: string, value: string, days: number = 365) {
	if (!browser) return;
	const expires = new Date();
	expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
	// Set cookie with SameSite=Strict for security
	document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

function deleteCookie(name: string) {
	if (!browser) return;
	document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`;
}

function loadSettings(): Settings {
	if (!browser) return defaultSettings;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return { ...defaultSettings, ...JSON.parse(stored) };
		}
	} catch (e) {
		console.error('Failed to load settings:', e);
	}
	return defaultSettings;
}

function createSettingsStore() {
	const { subscribe, set, update } = writable<Settings>(loadSettings());

	return {
		subscribe,
		set: (value: Settings) => {
			if (browser) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
				if (value.discogsToken) {
					setCookie(TOKEN_COOKIE, value.discogsToken);
				} else {
					deleteCookie(TOKEN_COOKIE);
				}
			}
			set(value);
		},
		update: (updater: (settings: Settings) => Settings) => {
			update((current) => {
				const updated = updater(current);
				if (browser) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
					if (updated.discogsToken) {
						setCookie(TOKEN_COOKIE, updated.discogsToken);
					} else {
						deleteCookie(TOKEN_COOKIE);
					}
				}
				return updated;
			});
		},
		setToken: (token: string) => {
			update((current) => {
				const updated = { ...current, discogsToken: token };
				if (browser) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
					setCookie(TOKEN_COOKIE, token);
				}
				return updated;
			});
		},
		clearToken: () => {
			update((current) => {
				const updated = { ...current, discogsToken: '' };
				if (browser) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
					deleteCookie(TOKEN_COOKIE);
				}
				return updated;
			});
		}
	};
}

export const settings = createSettingsStore();

// Check if token exists
export function hasToken(): boolean {
	if (!browser) return false;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			return !!parsed.discogsToken;
		} catch {
			return false;
		}
	}
	return false;
}
