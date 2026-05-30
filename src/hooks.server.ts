import type { Handle } from '@sveltejs/kit';

/**
 * Security response headers applied to every server-rendered response. These
 * work on both the Cloudflare and adapter-node deploy paths. HSTS is set at the
 * edge (static/_headers / Caddy) instead, since it should only apply over https.
 * CSP is configured separately via `kit.csp` in svelte.config.js.
 */
const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Frame-Options': 'DENY',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}
	return response;
};
