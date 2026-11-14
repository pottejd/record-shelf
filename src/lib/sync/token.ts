/**
 * The visitor's Discogs token, read from the same cookie the server uses as its
 * gate. Null when there is none, and always null on the server.
 */
export function tokenFromCookie(): string | null {
	if (typeof document === 'undefined') return null;
	const match = /(?:^|;\s*)discogs_token=([^;]*)/.exec(document.cookie);
	if (!match) return null;
	try {
		return decodeURIComponent(match[1]) || null;
	} catch {
		return match[1] || null;
	}
}
