import { describe, it, expect, vi } from 'vitest';
import { handle } from './hooks.server';

describe('security headers handle', () => {
	async function run() {
		const response = new Response('ok');
		const resolve = vi.fn(async () => response);
		return handle({ event: {} as never, resolve } as never);
	}

	it('sets X-Content-Type-Options: nosniff', async () => {
		const res = await run();
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('sets a Referrer-Policy', async () => {
		const res = await run();
		expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
	});

	it('denies framing', async () => {
		const res = await run();
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('sets a restrictive Permissions-Policy', async () => {
		const res = await run();
		expect(res.headers.get('Permissions-Policy')).toContain('geolocation=()');
	});
});
