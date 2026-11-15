import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

describe('theme store', () => {
	let mockStorage: Record<string, string>;
	let mockDocEl: { setAttribute: ReturnType<typeof vi.fn>; removeAttribute: ReturnType<typeof vi.fn> };

	let metas: Record<string, { content: string; setAttribute: (k: string, v: string) => void }>;

	beforeEach(async () => {
		vi.resetModules();
		const meta = () => {
			const m = { content: '', setAttribute: (_k: string, v: string) => void (m.content = v) };
			return m;
		};
		metas = { 'theme-color-light': meta(), 'theme-color-dark': meta() };
		mockStorage = {};
		mockDocEl = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
		vi.stubGlobal('localStorage', {
			getItem: vi.fn((key: string) => mockStorage[key] ?? null),
			setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
			removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
			clear: vi.fn()
		});
		vi.stubGlobal('document', {
			documentElement: mockDocEl,
			getElementById: (id: string) => metas[id] ?? null,
			cookie: ''
		});
	});

	async function importStore() {
		const mod = await import('./theme');
		return { theme: mod.theme, applyTheme: mod.applyTheme, type: mod };
	}

	it('sets both theme-color metas to the chosen theme, and one per scheme for system', async () => {
		const { applyTheme } = await importStore();
		applyTheme('dark');
		expect([metas['theme-color-light'].content, metas['theme-color-dark'].content]).toEqual(['#131815', '#131815']);
		applyTheme('light');
		expect([metas['theme-color-light'].content, metas['theme-color-dark'].content]).toEqual(['#ECEEE8', '#ECEEE8']);
		applyTheme('system');
		expect([metas['theme-color-light'].content, metas['theme-color-dark'].content]).toEqual(['#ECEEE8', '#131815']);
	});

	it('loads system as default theme', async () => {
		const { theme } = await importStore();
		expect(get(theme)).toBe('system');
	});

	it('loads stored light theme', async () => {
		mockStorage['record-shelf-theme'] = 'light';
		const { theme } = await importStore();
		expect(get(theme)).toBe('light');
	});

	it('loads stored dark theme', async () => {
		mockStorage['record-shelf-theme'] = 'dark';
		const { theme } = await importStore();
		expect(get(theme)).toBe('dark');
	});

	it('falls back to system for invalid stored value', async () => {
		mockStorage['record-shelf-theme'] = 'neon';
		const { theme } = await importStore();
		expect(get(theme)).toBe('system');
	});

	it('set persists to localStorage and applies theme', async () => {
		const { theme } = await importStore();
		theme.set('dark');

		expect(mockStorage['record-shelf-theme']).toBe('dark');
		expect(get(theme)).toBe('dark');
		expect(mockDocEl.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
	});

	it('applyTheme removes data-theme for system', async () => {
		const { applyTheme } = await importStore();
		applyTheme('system');

		expect(mockDocEl.removeAttribute).toHaveBeenCalledWith('data-theme');
	});

	it('applyTheme sets data-theme for light', async () => {
		const { applyTheme } = await importStore();
		applyTheme('light');

		expect(mockDocEl.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
	});
});
