import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import { fingerprint, isWriter, resetWritersWarningForTests, writerFingerprints } from './writers';

// SHA-256("abc"), the standard test vector.
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

beforeEach(() => {
	for (const k of Object.keys(mockEnv)) delete mockEnv[k];
	resetWritersWarningForTests();
	vi.restoreAllMocks();
});

describe('fingerprint', () => {
	it('is the SHA-256 of the token as lowercase hex', async () => {
		expect(await fingerprint('abc')).toBe(ABC);
		expect(await fingerprint('abd')).not.toBe(ABC);
	});
});

describe('writerFingerprints reads STORE_WRITERS', () => {
	it('is empty when the setting is missing or blank', () => {
		expect(writerFingerprints()).toEqual([]);
		mockEnv.STORE_WRITERS = '  ';
		expect(writerFingerprints()).toEqual([]);
	});
	it('takes several fingerprints separated by commas or spaces, in any letter case, and ignores anything else', async () => {
		const other = await fingerprint('other');
		mockEnv.STORE_WRITERS = ` ${ABC.toUpperCase()}, ${other}\nnot-a-fingerprint ${ABC.slice(0, 63)} `;
		expect(writerFingerprints()).toEqual([ABC, other]);
	});
});

describe('isWriter', () => {
	it('is true only for a token whose fingerprint is listed', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mockEnv.STORE_WRITERS = ABC;
		expect(await isWriter('abc')).toBe(true);
		expect(await isWriter('abd')).toBe(false);
		expect(await isWriter('')).toBe(false);
		expect(await isWriter(undefined)).toBe(false);
		// The fingerprint itself is not a password: sending it as the token does not pass.
		expect(await isWriter(ABC)).toBe(false);
		expect(console.error).not.toHaveBeenCalled();
	});
	it('with no fingerprint configured nobody is a writer, and that is logged once', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await isWriter('abc')).toBe(false);
		expect(await isWriter('abc')).toBe(false);
		expect(log).toHaveBeenCalledTimes(1);
		expect(log.mock.calls[0][0]).toContain('STORE_WRITERS');
		// A request with no token at all is not worth a log line.
		resetWritersWarningForTests();
		log.mockClear();
		expect(await isWriter(undefined)).toBe(false);
		expect(log).not.toHaveBeenCalled();
	});
	it('never logs the token', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		await isWriter('SECRET-TOKEN');
		expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET-TOKEN');
	});
});
