import { describe, it, expect } from 'vitest';
import { localDayKey, parseLocalDayKey } from './dates';

describe('localDayKey', () => {
	it('formats a local date as zero-padded YYYY-MM-DD', () => {
		expect(localDayKey(new Date(2024, 0, 5))).toBe('2024-01-05');
		expect(localDayKey(new Date(2024, 11, 31))).toBe('2024-12-31');
	});

	it('uses local calendar fields (not UTC) so late-evening times keep their day', () => {
		// 2024-06-15 23:30 local — toISOString() would roll to the 16th in US offsets.
		const d = new Date(2024, 5, 15, 23, 30);
		expect(localDayKey(d)).toBe('2024-06-15');
	});
});

describe('parseLocalDayKey', () => {
	it('parses a key into a local-midnight date with the same calendar fields', () => {
		const d = parseLocalDayKey('2024-03-09');
		expect(d.getFullYear()).toBe(2024);
		expect(d.getMonth()).toBe(2); // March
		expect(d.getDate()).toBe(9);
	});

	it('round-trips with localDayKey', () => {
		const original = new Date(2023, 8, 1, 14, 0);
		expect(localDayKey(parseLocalDayKey(localDayKey(original)))).toBe('2023-09-01');
	});
});
