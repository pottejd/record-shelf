import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

describe('settings store', () => {
	let mockStorage: Record<string, string>;

	beforeEach(async () => {
		vi.resetModules();
		mockStorage = {};
		vi.stubGlobal('localStorage', {
			getItem: vi.fn((key: string) => mockStorage[key] ?? null),
			setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
			removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
			clear: vi.fn()
		});
		vi.stubGlobal('document', {
			cookie: '',
			get documentElement() { return { setAttribute: vi.fn(), removeAttribute: vi.fn() }; }
		});
	});

	async function importStore() {
		const mod = await import('./settings');
		return { settings: mod.settings, hasToken: mod.hasToken };
	}

	it('loads default settings when nothing stored', async () => {
		const { settings } = await importStore();
		const value = get(settings);

		expect(value.discogsToken).toBe('');
	});

	it('loads settings from localStorage', async () => {
		mockStorage['record-shelf-settings'] = JSON.stringify({ discogsToken: 'saved-token' });
		const { settings } = await importStore();
		const value = get(settings);

		expect(value.discogsToken).toBe('saved-token');
	});

	it('setToken persists to localStorage and sets cookie', async () => {
		const { settings } = await importStore();
		settings.setToken('new-token');

		const stored = JSON.parse(mockStorage['record-shelf-settings']);
		expect(stored.discogsToken).toBe('new-token');

		const value = get(settings);
		expect(value.discogsToken).toBe('new-token');
	});

	it('clearToken removes token and updates storage', async () => {
		mockStorage['record-shelf-settings'] = JSON.stringify({ discogsToken: 'old-token' });
		const { settings } = await importStore();
		settings.clearToken();

		const stored = JSON.parse(mockStorage['record-shelf-settings']);
		expect(stored.discogsToken).toBe('');

		const value = get(settings);
		expect(value.discogsToken).toBe('');
	});

	it('hasToken returns true when token exists', async () => {
		mockStorage['record-shelf-settings'] = JSON.stringify({ discogsToken: 'my-token' });
		const { hasToken } = await importStore();

		expect(hasToken()).toBe(true);
	});

	it('hasToken returns false when no token', async () => {
		const { hasToken } = await importStore();

		expect(hasToken()).toBe(false);
	});

	it('hasToken returns false for invalid stored JSON', async () => {
		mockStorage['record-shelf-settings'] = 'not-json';
		const { hasToken } = await importStore();

		expect(hasToken()).toBe(false);
	});

	it('set persists and syncs with cookie', async () => {
		const { settings } = await importStore();
		settings.set({ discogsToken: 'direct-set' });

		const stored = JSON.parse(mockStorage['record-shelf-settings']);
		expect(stored.discogsToken).toBe('direct-set');
		expect(get(settings).discogsToken).toBe('direct-set');
	});

	it('marks the token cookie Secure + SameSite=Strict over https', async () => {
		vi.stubGlobal('location', { protocol: 'https:' });
		const { settings } = await importStore();
		settings.setToken('tok');

		expect((document.cookie as string)).toContain(';Secure');
		expect((document.cookie as string)).toContain('SameSite=Strict');
	});

	it('omits Secure on http so localhost dev still works', async () => {
		vi.stubGlobal('location', { protocol: 'http:' });
		const { settings } = await importStore();
		settings.setToken('tok');

		expect((document.cookie as string)).not.toContain('Secure');
	});
});
