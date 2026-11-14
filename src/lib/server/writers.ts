import { env } from '$env/dynamic/private';

// Who may write to the shared store.
//
// The server cannot check a Discogs token (it never calls Discogs), so the token
// cookie alone proves nothing. Instead the site owner lists the fingerprints of
// the tokens that may write: STORE_WRITERS holds one or more SHA-256 fingerprints,
// separated by commas or spaces. A fingerprint is one-way: the token cannot be
// recovered from it, and sending the fingerprint as a token does not pass. No
// token is kept on the server.
//
// Everyone else still gets their own view straight from Discogs; it is just not
// stored. With nothing configured, nobody is a writer and nothing is stored.

const FINGERPRINT = /^[0-9a-f]{64}$/;

export const NO_WRITERS_MESSAGE =
	'[record-shelf] STORE_WRITERS is not set — no visitor may write to the shared store, so nothing will be stored. ' +
	'Set it to the token fingerprint shown at /api/status.';

let warned = false;

export function resetWritersWarningForTests(): void {
	warned = false;
}

/** SHA-256 of a token, as lowercase hex. */
export async function fingerprint(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The fingerprints allowed to write, from STORE_WRITERS. */
export function writerFingerprints(): string[] {
	return (env.STORE_WRITERS ?? '')
		.toLowerCase()
		.split(/[\s,]+/)
		.filter((value) => FINGERPRINT.test(value));
}

/** Whether a request carrying this token cookie may write to the shared store. */
export async function isWriter(token: string | undefined): Promise<boolean> {
	if (!token) return false;
	const allowed = writerFingerprints();
	if (allowed.length === 0) {
		if (!warned) {
			warned = true;
			console.error(NO_WRITERS_MESSAGE);
		}
		return false;
	}
	return allowed.includes(await fingerprint(token));
}
