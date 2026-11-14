import type { Store } from './store';
import { cleanArtistName } from '$lib/utils/discogs';
import {
	FRESH_MS,
	MAX_TOTAL_PAGES,
	PAGE_SIZE,
	REFRESH_COOLDOWN_MS,
	SNAPSHOT_BUCKET_MS,
	SNAPSHOT_OPEN_MS,
	SNAPSHOT_TTL_SECONDS,
	SYNC_MESSAGES,
	publicProfile,
	type PageRecord,
	type PublicProfile,
	type SnapshotMeta,
	type SnapshotRef,
	type StoredInitial,
	type SyncCompleteResult,
	type SyncDropResult,
	type SyncError,
	type SyncErrorCode,
	type SyncKind,
	type SyncOk,
	type SyncPageResult,
	type SyncStartResult,
	type SyncStoreResult
} from '$lib/sync/types';

// The server never calls Discogs. The visitor's browser does, and hands each
// page over; this module only reads and writes the store.
//
// It cannot check a token either, so writing is limited to the visitors the
// site owner has listed (see writers.ts). Anyone with a token cookie may read.

export interface SyncDeps {
	store: Store;
	now: () => number;
	/** This request may write to the shared store: hand pages over, drop a copy. */
	writer: boolean;
}

const SNAPSHOT_ID = /^\d{1,12}$/;

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

function error(code: SyncErrorCode): SyncError {
	return { status: 'error', code, message: SYNC_MESSAGES[code] };
}

function fromStore<T>(snapshot: string, record: PageRecord<T>): SyncOk<T> {
	return {
		status: 'ok',
		snapshot,
		page: record.page,
		totalPages: record.totalPages,
		totalItems: record.totalItems,
		items: record.items,
		...(record.profile ? { profile: record.profile } : {})
	};
}

// A page fetched with the owner's token carries owner-only fields (profile email,
// item notes, folder ids). Everything handed over is reduced to an allowlist
// before it is stored, so the same public shape is served to every visitor.
const PUBLIC_ITEM_KEYS: Record<SyncKind, readonly string[]> = {
	collection: ['id', 'instance_id', 'rating', 'date_added', 'basic_information'],
	wantlist: ['id', 'rating', 'date_added', 'basic_information']
};

function publicItems(kind: SyncKind, items: unknown[]): unknown[] {
	return items.map((item) => {
		const source = item as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of PUBLIC_ITEM_KEYS[kind]) if (key in source) out[key] = source[key];
		return out;
	});
}

/** The profile a browser handed over with page 1, if it is one for this user. */
function handedProfile(value: unknown, username: string): PublicProfile | null {
	if (typeof value !== 'object' || value === null) return null;
	const p = value as { username?: unknown; avatar_url?: unknown; location?: unknown };
	if (typeof p.username !== 'string' || p.username.toLowerCase() !== username.toLowerCase()) return null;
	return publicProfile({
		username: p.username,
		avatar_url: typeof p.avatar_url === 'string' ? p.avatar_url : '',
		location: typeof p.location === 'string' ? p.location : ''
	});
}

async function deleteSnapshot(store: Store, kind: SyncKind, username: string, snapshot: string): Promise<void> {
	const keys = await store.listKeys(pagePrefix(kind, username, snapshot));
	await Promise.all(keys.map((key) => store.delete(key)));
}

/** Deletes the pages of every snapshot meta names, then meta itself. */
async function removeStoredCopy(store: Store, kind: SyncKind, username: string, meta: SnapshotMeta): Promise<void> {
	const ids = [meta.current?.id, meta.pending?.id].filter((id): id is string => !!id);
	for (const id of new Set(ids)) await deleteSnapshot(store, kind, username, id);
	await store.delete(metaKey(kind, username));
	console.warn('[record-shelf] sync: removed stored copy', kind, username.toLowerCase());
}

/** Answers from meta alone: is there a fresh copy, a sync to join, or one to open? */
export async function startSync(
	kind: SyncKind,
	username: string,
	force: boolean,
	deps: SyncDeps
): Promise<SyncStartResult<unknown>> {
	const { store } = deps;
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
	if (!storedFirst) return { status: 'open', snapshot, store: deps.writer };
	const joined = fromStore(snapshot, storedFirst);
	const joinedProfile = storedFirst.profile ?? meta?.profile;
	return joinedProfile ? { ...joined, profile: joinedProfile } : joined;
}

export async function getPage(
	kind: SyncKind,
	username: string,
	snapshot: string,
	page: number,
	deps: SyncDeps
): Promise<SyncPageResult<unknown>> {
	if (!Number.isInteger(page) || page < 1 || !SNAPSHOT_ID.test(snapshot)) return error('BAD_REQUEST');
	const { store } = deps;
	const open = isSnapshotOpen(snapshot, deps.now());

	const storedPage = await store.getJSON<PageRecord>(pageKey(kind, username, snapshot, page));
	if (!storedPage) return open ? { status: 'missing' } : error('SNAPSHOT_EXPIRED');
	if (open) return fromStore(snapshot, storedPage);
	// Snapshot ids are guessable, so a stored page alone is not enough: it must
	// belong to an open snapshot or to the list's current one.
	const meta = await store.getJSON<SnapshotMeta>(metaKey(kind, username));
	return meta?.current?.id === snapshot ? fromStore(snapshot, storedPage) : error('SNAPSHOT_EXPIRED');
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/**
 * Stores one page a browser fetched from Discogs. Page 1 opens the snapshot: it
 * writes meta, and meta naming a snapshot is what lets its later pages in.
 */
export async function storePage(
	kind: SyncKind,
	username: string,
	body: unknown,
	deps: SyncDeps
): Promise<SyncStoreResult> {
	// Checked before anything else: a visitor who may not write gets the same
	// answer whatever they send, and their own view carries on unstored.
	if (!deps.writer) return { status: 'unstored' };
	if (typeof body !== 'object' || body === null) return error('BAD_REQUEST');
	const { snapshot, page, totalPages, totalItems, items, profile } = body as Record<string, unknown>;
	if (
		typeof snapshot !== 'string' || !SNAPSHOT_ID.test(snapshot) ||
		!isCount(page) || page < 1 ||
		!isCount(totalPages) || totalPages < 1 || totalPages > MAX_TOTAL_PAGES || page > totalPages ||
		!isCount(totalItems) ||
		!Array.isArray(items) || items.length > PAGE_SIZE ||
		items.some((item) => typeof item !== 'object' || item === null)
	) {
		return error('BAD_REQUEST');
	}
	const { store } = deps;
	const now = deps.now();
	if (!isSnapshotOpen(snapshot, now)) return error('SNAPSHOT_EXPIRED');
	const meta = await store.getJSON<SnapshotMeta>(metaKey(kind, username));
	const key = pageKey(kind, username, snapshot, page);
	const record: PageRecord = { items: publicItems(kind, items), page, totalPages, totalItems };

	if (page === 1) {
		const publicOne = handedProfile(profile, username);
		// A completed copy never changes; a refresh arrives under a new snapshot id.
		if (!publicOne || meta?.current?.id === snapshot) return error('BAD_REQUEST');
		const nextMeta: SnapshotMeta = {
			profile: publicOne,
			current: meta?.current ?? null,
			pending: { id: snapshot, totalItems, totalPages, startedAt: now, completedAt: null },
			recent: meta?.recent ?? []
		};
		const pageOk = await store.putJSON(key, { ...record, profile: publicOne, startedAt: now }, SNAPSHOT_TTL_SECONDS);
		const metaOk = await store.putJSON(metaKey(kind, username), nextMeta, SNAPSHOT_TTL_SECONDS);
		return { status: pageOk && metaOk ? 'stored' : 'unstored' };
	}

	const ref =
		meta?.pending?.id === snapshot ? meta.pending : meta?.current?.id === snapshot ? meta.current : null;
	if (!ref) return { status: 'unstored' };
	// Only pages inside the snapshot's recorded range, so arbitrary page numbers
	// cannot fill the store.
	if (page > ref.totalPages) return error('BAD_REQUEST');
	return { status: (await store.putJSON(key, record, SNAPSHOT_TTL_SECONDS)) ? 'stored' : 'unstored' };
}

/**
 * Removes the stored copy. A browser asks for this when Discogs, asked without
 * a token, says the list is not public or the user is gone. Only a visitor who
 * may write is believed.
 */
export async function dropStored(kind: SyncKind, username: string, deps: SyncDeps): Promise<SyncDropResult> {
	if (!deps.writer) return { status: 'refused' };
	const meta = await deps.store.getJSON<SnapshotMeta>(metaKey(kind, username));
	if (meta) await removeStoredCopy(deps.store, kind, username, meta);
	return { status: 'dropped' };
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
	if (meta?.current && Number(meta.current.id) > Number(snapshot)) return error('SNAPSHOT_EXPIRED');
	if (!isSnapshotOpen(snapshot, now)) return error('SNAPSHOT_EXPIRED');

	const first = await store.getJSON<PageRecord>(pageKey(kind, username, snapshot, 1));
	if (!first) return { status: 'incomplete', missing: [1] };

	// listKeys may be partial; a page reported missing is asked for again and then served from the store.
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
	// Another tab's pending snapshot is not this pass's to drop.
	const pending = meta?.pending && meta.pending.id !== snapshot ? meta.pending : null;
	const nextMeta: SnapshotMeta = { profile, current, pending, recent: recentFrom(kind, first.items) };
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
