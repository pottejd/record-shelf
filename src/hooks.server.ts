import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';

// Fail-soft env validation for the adapter-node deploy path (Cloudflare reads
// env per-request and doesn't use ORIGIN, so this only runs on the long-lived
// node server, flagged by ADAPTER=node in the Docker runtime). Warn rather than
// crash so a misconfiguration is visible without taking the server down.
if (!building && env.ADAPTER === 'node') {
	const origin = env.ORIGIN;
	if (!origin || !/^https:\/\//.test(origin)) {
		console.warn(
			`[record-shelf] ORIGIN is not a valid https URL ("${origin ?? ''}") — set it via "docker run -e ORIGIN=https://your.domain" or SvelteKit's CSRF/origin checks may reject requests behind a proxy.`
		);
	}
	if (!env.DISCOGS_TOKEN) {
		console.warn(
			'[record-shelf] DISCOGS_TOKEN is not set — each user must supply their own Discogs token.'
		);
	}
}

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
