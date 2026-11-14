import type { Store } from './store';
import type { DiscogsUserProfile } from '$lib/types/discogs';
import {
	DiscogsAPIError,
	fetchListPage,
	fetchProfile,
	type DiscogsResult,
	type ListPage
} from '$lib/api/discogs';
import { cleanArtistName } from '$lib/utils/discogs';
import { USER_AGENT } from '$lib/constants';
import {
	DEFAULT_RETRY_AFTER_MS,
	FRESH_MS,
	PACE_CRITICAL_MS,
	PACE_LOW_MS,
	PACE_MS,
	PAGE_SIZE,
	REFRESH_COOLDOWN_MS,
	SNAPSHOT_BUCKET_MS,
	SNAPSHOT_OPEN_MS,
	SNAPSHOT_TTL_SECONDS,
	type PageRecord,
	type PublicProfile,
	type SnapshotMeta,
	type SnapshotRef,
	type StoredInitial,
	type SyncCompleteResult,
	type SyncError,
	type SyncErrorCode,
	type SyncKind,
	type SyncOk,
	type SyncPageResult,
	type SyncStartResult,
	type SyncWait
} from '$lib/sync/types';

export interface DiscogsPort {
	profile(username: string, token: string): Promise<DiscogsResult<DiscogsUserProfile>>;
	listPage(
		kind: SyncKind,
		username: string,
		page: number,
		perPage: number,
		token: string | undefined
	): Promise<DiscogsResult<ListPage>>;
}

export interface SyncDeps {
	store: Store;
	discogs: DiscogsPort;
	now: () => number;
}

export const discogsPort: DiscogsPort = {
	profile: (username, token) => fetchProfile(username, { userAgent: USER_AGENT, token }),
	listPage: (kind, username, page, perPage, token) =>
		fetchListPage(kind, username, page, perPage, { userAgent: USER_AGENT, token })
};

const SNAPSHOT_ID = /^\d{1,12}$/;

const MESSAGES: Record<SyncErrorCode, string> = {
	TOKEN_REQUIRED: 'A Discogs token is required',
	BAD_TOKEN: 'Invalid or expired Discogs token',
	NOT_FOUND: 'Discogs user not found',
	PRIVATE: 'This list is private',
	SNAPSHOT_EXPIRED: 'This sync has expired; start a new one',
	BAD_REQUEST: 'Bad request',
	UPSTREAM: 'Discogs request failed'
};

export function metaKey(kind: SyncKind, username: string): string {
	return `v2:${kind}:${username.toLowerCase()}:meta`;
}

function pagePrefix(kind: SyncKind, username: string, snapshot: string): string {
	return `v2:${kind}:${username.toLowerCase()}:s:${snapshot}:p:`;
}

export function pageKey(kind: SyncKind, username: string, snapshot: string, page: number): string {
	return `${pagePrefix(kind, username, snapshot)}${page}`;
}

export function snapshotIdAt(ms: number): string {
	return String(Math.floor(ms / SNAPSHOT_BUCKET_MS));
}

export function isSnapshotOpen(snapshot: string, now: number): boolean {
	if (!SNAPSHOT_ID.test(snapshot)) return false;
	const start = Number(snapshot) * SNAPSHOT_BUCKET_MS;
	return start <= now && now < start + SNAPSHOT_BUCKET_MS + SNAPSHOT_OPEN_MS;
}

export function paceFor(remaining: number | null): number {
	if (remaining === null || remaining > 10) return PACE_MS;
	if (remaining <= 3) return PACE_CRITICAL_MS;
	return PACE_LOW_MS;
}

function error(code: SyncErrorCode): SyncError {
	return { status: 'error', code, message: MESSAGES[code] };
}

function codeOf(e: unknown): string | undefined {
	return e instanceof DiscogsAPIError ? e.code : undefined;
}

/** Maps a failed Discogs call to a result. Never retries: a 429 becomes `wait`. */
function failure(e: unknown): SyncWait | SyncError {
	if (e instanceof DiscogsAPIError && e.code === 'RATE_LIMITED') {
		return { status: 'wait', retryAfterMs: e.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS };
	}
	const code = codeOf(e);
	if (code === 'BAD_TOKEN' || code === 'NOT_FOUND' || code === 'PRIVATE') return error(code);
	// Discogs errors are already logged where they are raised; anything else is unexpected.
	if (!(e instanceof DiscogsAPIError)) console.error('[record-shelf] sync: unexpected error', e);
	return error('UPSTREAM');
}

function lowest(values: Array<number | null>): number | null {
	const known = values.filter((v): v is number => v !== null);
	return known.length ? Math.min(...known) : null;
}

function fromStore<T>(snapshot: string, record: PageRecord<T>): SyncOk<T> {
	return {
		status: 'ok',
		snapshot,
		page: record.page,
		totalPages: record.totalPages,
		totalItems: record.totalItems,
		items: record.items,
		source: 'store',
		stored: true,
		nextDelayMs: 0,
		...(record.profile ? { profile: record.profile } : {})
	};
}

// Authenticated responses carry owner-only fields (profile email, item notes,
// folder ids). Everything is reduced to an allowlist as soon as it arrives, so
// the same public shape is stored and returned to every visitor.
function publicProfile(p: DiscogsUserProfile): PublicProfile {
	return { username: p.username, avatar_url: p.avatar_url ?? '', location: p.location ?? '' };
}

const PUBLIC_ITEM_KEYS: Record<SyncKind, readonly string[]> = {
	collection: ['id', 'instance_id', 'rating', 'date_added', 'basic_information'],
	wantlist: ['id', 'rating', 'date_added', 'basic_information']
};

function publicItems(kind: SyncKind, items: unknown[]): unknown[] {
	return items.map((item) => {
		const source = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of PUBLIC_ITEM_KEYS[kind]) if (key in source) out[key] = source[key];
		return out;
	});
}

async function deleteSnapshot(store: Store, kind: SyncKind, username: string, snapshot: string): Promise<void> {
	const keys = await store.listKeys(pagePrefix(kind, username, snapshot));
	await Promise.all(keys.map((key) => store.delete(key)));
}

export async function startSync(
	kind: SyncKind,
	username: string,
	token: string,
	force: boolean,
	deps: SyncDeps
): Promise<SyncStartResult<unknown>> {
	const { store, discogs } = deps;
	const now = deps.now();
	const meta = await store.getJSON<SnapshotMeta>(metaKey(kind, username));

	// Used exactly as recorded: a presence check here would rest on listKeys, which
	// can come back short on a backend error and make a good copy look dead.
	const current = meta?.current ?? null;
	if (current) {
		const age = current.completedAt === null ? Infinity : now - current.completedAt;
		if (!force && age < FRESH_MS) return { status: 'fresh', snapshot: current.id };
		if (force && age < REFRESH_COOLDOWN_MS) {
			return { status: 'cooldown', retryAfterMs: REFRESH_COOLDOWN_MS - age };
		}
	}

	const pending = meta?.pending;
	const snapshot =
		pending && isSnapshotOpen(pending.id, now) && pending.id !== current?.id
			? pending.id
			: snapshotIdAt(now);
	if (snapshot === current?.id) return { status: 'fresh', snapshot };

	const storedFirst = await store.getJSON<PageRecord>(pageKey(kind, username, snapshot, 1));
	if (storedFirst) {
		const joined = fromStore(snapshot, storedFirst);
		const joinedProfile = storedFirst.profile ?? meta?.profile;
		return joinedProfile ? { ...joined, profile: joinedProfile } : joined;
	}

	let isPublic: boolean;
	let probeRemaining: number | null = null;
	try {
		probeRemaining = (await discogs.listPage(kind, username, 1, 1, undefined)).remaining;
		isPublic = true;
	} catch (e) {
		const code = codeOf(e);
		if (code !== 'PRIVATE' && code !== 'BAD_TOKEN') return failure(e);
		isPublic = false;
	}

	let first: DiscogsResult<ListPage>;
	let profileResult: DiscogsResult<DiscogsUserProfile>;
	try {
		first = await discogs.listPage(kind, username, 1, PAGE_SIZE, token);
		profileResult = await discogs.profile(username, token);
	} catch (e) {
		return failure(e);
	}

	const items = publicItems(kind, first.data.items);
	const profile = publicProfile(profileResult.data);
	const totalPages = Math.max(1, first.data.pagination.pages);
	const totalItems = first.data.pagination.items;

	let stored = false;
	if (isPublic) {
		const record: PageRecord = { items, page: 1, totalPages, totalItems, profile, startedAt: now };
		const nextMeta: SnapshotMeta = {
			profile,
			current,
			pending: { id: snapshot, totalItems, totalPages, startedAt: now, completedAt: null },
			recent: meta?.recent ?? []
		};
		const pageOk = await store.putJSON(pageKey(kind, username, snapshot, 1), record, SNAPSHOT_TTL_SECONDS);
		const metaOk = await store.putJSON(metaKey(kind, username), nextMeta, SNAPSHOT_TTL_SECONDS);
		stored = pageOk && metaOk;
	} else {
		const old = [meta?.current?.id, meta?.pending?.id].filter((id): id is string => !!id);
		for (const id of new Set(old)) await deleteSnapshot(store, kind, username, id);
		await store.delete(metaKey(kind, username));
	}

	return {
		status: 'ok',
		snapshot,
		page: 1,
		totalPages,
		totalItems,
		items,
		source: 'discogs',
		stored,
		nextDelayMs: paceFor(lowest([probeRemaining, first.remaining, profileResult.remaining])),
		profile
	};
}

export async function getPage(
	kind: SyncKind,
	username: string,
	token: string,
	snapshot: string,
	page: number,
	deps: SyncDeps
): Promise<SyncPageResult<unknown>> {
	if (!Number.isInteger(page) || page < 1 || !SNAPSHOT_ID.test(snapshot)) return error('BAD_REQUEST');
	const { store, discogs } = deps;
	const now = deps.now();
	const open = isSnapshotOpen(snapshot, now);
	const meta = await store.getJSON<SnapshotMeta>(metaKey(kind, username));

	// Snapshot ids are guessable, so a stored page alone is not enough: it must
	// belong to an open snapshot or to the list's current one.
	const storedPage = await store.getJSON<PageRecord>(pageKey(kind, username, snapshot, page));
	if (storedPage) {
		if (open || meta?.current?.id === snapshot) return fromStore(snapshot, storedPage);
		return error('SNAPSHOT_EXPIRED');
	}
	if (!open) return error('SNAPSHOT_EXPIRED');

	// Meta names a snapshot only after the list was confirmed public, so it is the
	// marker for storing. A missing or stale meta is safe: the page goes unstored.
	const ref =
		meta?.pending?.id === snapshot ? meta.pending : meta?.current?.id === snapshot ? meta.current : null;

	let record: PageRecord;
	let remaining: number | null = null;
	try {
		const r = await discogs.listPage(kind, username, page, PAGE_SIZE, token);
		remaining = r.remaining;
		record = {
			items: publicItems(kind, r.data.items),
			page,
			totalPages: Math.max(1, r.data.pagination.pages),
			totalItems: r.data.pagination.items,
			// Page 1 is where start and completion read the profile and start time from.
			...(page === 1 && ref && meta ? { profile: meta.profile, startedAt: ref.startedAt } : {})
		};
	} catch (e) {
		if (!(page > 1 && codeOf(e) === 'NOT_FOUND')) return failure(e);
		// Only a page inside the snapshot's known range becomes an empty page, so
		// arbitrary page numbers cannot fill the store with empty records.
		if (!ref || page > ref.totalPages) return error('BAD_REQUEST');
		record = { items: [], page, totalPages: ref.totalPages, totalItems: ref.totalItems };
	}

	const stored = ref
		? await store.putJSON(pageKey(kind, username, snapshot, page), record, SNAPSHOT_TTL_SECONDS)
		: false;

	return {
		status: 'ok',
		snapshot,
		page,
		totalPages: record.totalPages,
		totalItems: record.totalItems,
		items: record.items,
		source: 'discogs',
		stored,
		nextDelayMs: paceFor(remaining)
	};
}

interface RecentSource {
	basic_information?: { title?: string; artists?: Array<{ name?: string }> };
}

function recentFrom(kind: SyncKind, items: unknown[]): SnapshotMeta['recent'] {
	if (kind !== 'collection') return [];
	return items.slice(0, 3).map((item) => {
		const info = (item as RecentSource).basic_information;
		return {
			artist: cleanArtistName(info?.artists?.[0]?.name ?? '') || 'Unknown',
			title: info?.title ?? ''
		};
	});
}

export async function completeSync(
	kind: SyncKind,
	username: string,
	snapshot: string,
	deps: SyncDeps
): Promise<SyncCompleteResult> {
	if (!SNAPSHOT_ID.test(snapshot)) return error('BAD_REQUEST');
	const { store } = deps;
	const now = deps.now();
	const meta = await store.getJSON<SnapshotMeta>(metaKey(kind, username));
	if (meta?.current?.id === snapshot && meta.current.completedAt !== null) {
		return { status: 'complete', snapshot, completedAt: meta.current.completedAt };
	}
	// A tab resuming late must not roll current back to an older pass stamped as fresh.
	if (!isSnapshotOpen(snapshot, now)) return error('SNAPSHOT_EXPIRED');

	const first = await store.getJSON<PageRecord>(pageKey(kind, username, snapshot, 1));
	if (!first) return { status: 'incomplete', missing: [1] };

	// listKeys may be partial; a page reported missing is re-requested and then served from the store.
	const prefix = pagePrefix(kind, username, snapshot);
	const present = new Set((await store.listKeys(prefix)).map((key) => Number(key.slice(prefix.length))));
	const missing: number[] = [];
	for (let p = 2; p <= first.totalPages; p++) if (!present.has(p)) missing.push(p);
	if (missing.length) return { status: 'incomplete', missing };

	const profile = first.profile ?? meta?.profile;
	if (!profile) return error('UPSTREAM');
	const current: SnapshotRef = {
		id: snapshot,
		totalItems: first.totalItems,
		totalPages: first.totalPages,
		startedAt: first.startedAt ?? now,
		completedAt: now
	};
	const nextMeta: SnapshotMeta = { profile, current, pending: null, recent: recentFrom(kind, first.items) };
	if (!(await store.putJSON(metaKey(kind, username), nextMeta, SNAPSHOT_TTL_SECONDS))) return error('UPSTREAM');
	return { status: 'complete', snapshot, completedAt: now };
}

export async function readStored(
	kind: SyncKind,
	username: string,
	store: Store,
	now: number
): Promise<StoredInitial<unknown> | null> {
	const meta = await store.getJSON<SnapshotMeta>(metaKey(kind, username));
	if (!meta) return null;
	// Current first, then an open pending one. A missing page 1 costs no parse, so
	// at most one page of records is parsed even when current's page 1 is gone.
	const candidates: Array<{ ref: SnapshotRef; complete: boolean }> = [];
	if (meta.current) candidates.push({ ref: meta.current, complete: true });
	if (meta.pending && isSnapshotOpen(meta.pending.id, now)) candidates.push({ ref: meta.pending, complete: false });
	for (const { ref, complete } of candidates) {
		const first = await store.getJSON<PageRecord>(pageKey(kind, username, ref.id, 1));
		if (!first) continue;
		return {
			profile: meta.profile,
			snapshot: ref.id,
			complete,
			completedAt: complete ? ref.completedAt : null,
			totalItems: ref.totalItems,
			totalPages: ref.totalPages,
			firstPage: first.items
		};
	}
	return null;
}
