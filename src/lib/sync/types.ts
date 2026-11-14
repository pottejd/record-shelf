/** The only profile fields stored or returned: never owner-only data such as email. */
export interface PublicProfile { username: string; avatar_url: string; location: string }

export type SyncKind = 'collection' | 'wantlist';

export const FRESH_MS = 6 * 60 * 60 * 1000;
export const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
export const SNAPSHOT_BUCKET_MS = 10 * 60 * 1000;
export const SNAPSHOT_OPEN_MS = 60 * 60 * 1000;
export const SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const PRICE_TTL_SECONDS = 6 * 60 * 60;
export const PAGE_SIZE = 100;
export const PACE_MS = 1100;
export const PACE_LOW_MS = 5000;
export const PACE_CRITICAL_MS = 15000;
export const DEFAULT_RETRY_AFTER_MS = 30_000;
export const MAX_WAIT_MS = 60_000;

export type SyncErrorCode =
	| 'TOKEN_REQUIRED' | 'BAD_TOKEN' | 'NOT_FOUND' | 'PRIVATE'
	| 'SNAPSHOT_EXPIRED' | 'BAD_REQUEST' | 'UPSTREAM';

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

export interface SyncOk<T> {
	status: 'ok'; snapshot: string; page: number; totalPages: number; totalItems: number;
	items: T[]; source: 'store' | 'discogs'; stored: boolean; nextDelayMs: number;
	profile?: PublicProfile;
}
export interface SyncWait { status: 'wait'; retryAfterMs: number }
export interface SyncError { status: 'error'; code: SyncErrorCode; message: string }
export type SyncPageResult<T> = SyncOk<T> | SyncWait | SyncError;
export type SyncStartResult<T> =
	| SyncOk<T> | { status: 'fresh'; snapshot: string }
	| { status: 'cooldown'; retryAfterMs: number } | SyncWait | SyncError;
export type SyncCompleteResult =
	| { status: 'complete'; snapshot: string; completedAt: number }
	| { status: 'incomplete'; missing: number[] } | SyncError;

export interface StoredInitial<T> {
	profile: PublicProfile; snapshot: string; complete: boolean;
	completedAt: number | null; totalItems: number; totalPages: number; firstPage: T[];
}
