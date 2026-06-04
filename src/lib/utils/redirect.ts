/**
 * Returns `raw` only if it is a safe same-origin absolute path (single leading
 * slash, not protocol-relative). Otherwise returns `fallback`. Guards against
 * open-redirect tricks like "//evil.com", "/\\evil.com", and "https://evil.com".
 */
export function safeRedirectTarget(
	raw: string | null | undefined,
	fallback = '/'
): string {
	if (!raw || raw[0] !== '/') return fallback;
	// reject protocol-relative ("//host") and backslash variants ("/\\host")
	if (raw[1] === '/' || raw[1] === '\\') return fallback;
	return raw;
}
