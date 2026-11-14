/** The only profile fields stored or returned: never owner-only data such as email. */
export interface PublicProfile { username: string; avatar_url: string; location: string }

export type SyncKind = 'collection' | 'wantlist';

export const FRESH_MS = 6 * 60 * 60 * 1000;
export const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
export const SNAPSHOT_BUCKET_MS = 10 * 60 * 1000;
export const SNAPSHOT_OPEN_MS = 60 * 60 * 1000;
export const SNAPSHOT_TTL_SECONDS = 30 * 24 * 60 * 60;
export const PRICE_TTL_MS = 6 * 60 * 60 * 1000;
export const PAGE_SIZE = 100;
/** The gap between any two requests Discogs counts from one browser (a call with a token is two: its preflight counts). */
export const PACE_MS = 1100;
/** The first wait when Discogs is busy. A browser cannot read Retry-After. */
export const DEFAULT_RETRY_AFTER_MS = 30_000;
export const MAX_WAIT_MS = 60_000;
/** Bounds on a page a browser hands over. */
export const MAX_TOTAL_PAGES = 5000;
export const MAX_HANDOVER_CHARS = 1_000_000;

export type SyncErrorCode =
	| 'TOKEN_REQUIRED' | 'BAD_TOKEN' | 'NOT_FOUND' | 'PRIVATE'
	| 'SNAPSHOT_EXPIRED' | 'BAD_REQUEST' | 'UPSTREAM';

export const SYNC_MESSAGES: Record<SyncErrorCode, string> = {
	TOKEN_REQUIRED: 'A Discogs token is required',
	BAD_TOKEN: 'Invalid or expired Discogs token',
	NOT_FOUND: 'Discogs user not found',
	PRIVATE: 'This list is private',
	SNAPSHOT_EXPIRED: 'This sync has expired; start a new one',
	BAD_REQUEST: 'Bad request',
	UPSTREAM: 'Discogs request failed'
};

export interface SnapshotRef {
	id: string; totalItems: number; totalPages: number;
	startedAt: number; completedAt: number | null;
}
export interface SnapshotMeta {
	profile: PublicProfile;
	current: SnapshotRef | null;
	pending: SnapshotRef | null;
	recent: Array<{ artist: string; title: string }>;
}
export interface PageRecord<T = unknown> {
	items: T[]; page: number; totalPages: number; totalItems: number;
	/** Present on page 1 only. */
	profile?: PublicProfile; startedAt?: number;
}

/** A stored page, as the server returns it. */
export interface SyncOk<T> {
	status: 'ok'; snapshot: string; page: number; totalPages: number; totalItems: number;
	items: T[]; profile?: PublicProfile;
}
export interface SyncError { status: 'error'; code: SyncErrorCode; message: string }
/** `missing`: the snapshot is open and this page is not stored; the browser fetches it from Discogs. */
export type SyncPageResult<T> = SyncOk<T> | { status: 'missing' } | SyncError;
/**
 * `ok`: page 1 of a snapshot already being filled, to join.
 * `open`: nothing stored for this snapshot; the browser loads it from Discogs.
 * `store` says whether this visitor may write to the shared store: if not, the
 * browser hands nothing over.
 */
export type SyncStartResult<T> =
	| SyncOk<T> | { status: 'fresh'; snapshot: string }
	| { status: 'open'; snapshot: string; store: boolean }
	| { status: 'cooldown'; retryAfterMs: number } | SyncError;
export type SyncCompleteResult =
	| { status: 'complete'; snapshot: string; completedAt: number }
	| { status: 'incomplete'; missing: number[] } | SyncError;

/** A page fetched from Discogs by a browser, handed to the server to store. */
export interface PageHandover {
	snapshot: string; page: number; totalPages: number; totalItems: number;
	items: unknown[];
	/** Page 1 only. */
	profile?: unknown;
}
/**
 * `unstored`: nothing was written (this visitor may not write to the shared
 * store, the list was never opened here, or the store failed).
 */
export type SyncStoreResult = { status: 'stored' } | { status: 'unstored' } | SyncError;
/** `refused`: this visitor may not write to the shared store, so nothing was removed. */
export type SyncDropResult = { status: 'dropped' } | { status: 'refused' };

export interface StoredInitial<T> {
	profile: PublicProfile; snapshot: string; complete: boolean;
	completedAt: number | null; totalItems: number; totalPages: number; firstPage: T[];
}

/** Reduces a Discogs profile to the public fields. */
export function publicProfile(p: { username: string; avatar_url?: string | null; location?: string | null }): PublicProfile {
	return { username: p.username, avatar_url: p.avatar_url ?? '', location: p.location ?? '' };
}
