import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Constrains route params that are passed to the Discogs API as a username.
 * Discogs usernames are letters, digits, underscores, dots and hyphens; this
 * rejects path separators and URL-reserved characters before they can reach
 * (and corrupt) an upstream request. Requests that fail to match 404 in SvelteKit.
 */
// The lookahead requires at least one alphanumeric, rejecting separator-only
// strings like "..", "--", "_" that would otherwise cost a wasted upstream 404.
const USERNAME_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9_.-]{1,50}$/;

export const match: ParamMatcher = (param) => USERNAME_PATTERN.test(param);
