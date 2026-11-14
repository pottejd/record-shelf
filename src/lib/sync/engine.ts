import { DiscogsAPIError, fetchListPage, fetchProfile, isBusy, type ListPage } from '$lib/api/discogs';
import { tokenFromCookie } from './token';
import {
	DEFAULT_RETRY_AFTER_MS,
	FRESH_MS,
	MAX_WAIT_MS,
	PAGE_SIZE,
	SYNC_MESSAGES,
	publicProfile,
	type PageHandover,
	type PublicProfile,
	type StoredInitial,
	type SyncCompleteResult,
	type SyncDropResult,
	type SyncError,
	type SyncErrorCode,
	type SyncKind,
	type SyncPageResult,
	type SyncStartResult,
	type SyncStoreResult
} from './types';

export type LoaderPhase = 'idle' | 'loading' | 'waiting' | 'refreshing' | 'done' | 'error';

export interface EngineState<T> {
	profile: PublicProfile | null;
	/** What is on screen. */
	items: T[];
	totalItems: number;
	/** Records fetched so far in the active pass. */
	loaded: number;
	phase: LoaderPhase;
	/** The active pass is a re-sync over a copy already on screen. */
	background: boolean;
	/** Epoch ms a wait ends. */
	resumeAt: number | null;
	/** completedAt of the copy on screen. */
	asOf: number | null;
	error: { code: SyncErrorCode | 'NETWORK'; message: string } | null;
	cooldownUntil: number | null;
}

/** The Discogs calls a sync makes. They are made here, in the browser, never by the server. */
export interface DiscogsClient {
	/** With no token, Discogs answers only if the list is public. */
	listPage(kind: SyncKind, username: string, page: number, perPage: number, token: string | undefined): Promise<ListPage>;
	profile(username: string, token: string): Promise<{ username: string; avatar_url?: string | null; location?: string | null }>;
}

export interface EngineDeps {
	/** Reaches this site's own sync endpoints. */
	fetchFn: typeof fetch;
	discogs: DiscogsClient;
	/** The visitor's Discogs token, or null when there is none. */
	token: () => string | null;
	sleep: (ms: number) => Promise<void>;
	now: () => number;
}

export interface EngineOptions<T> {
	kind: SyncKind;
	username: string;
	initial: StoredInitial<T> | null;
	keyOf: (item: T) => number;
	/** Default true. */
	autoRefresh?: boolean;
	deps?: Partial<EngineDeps>;
	onChange: (state: EngineState<T>) => void;
}

export interface Engine<T> {
	readonly state: EngineState<T>;
	/** Loads everything for the first view. Resolves when phase is done or error (then, if autoRefresh, continues into refreshIfStale). */
	run(): Promise<void>;
	refreshIfStale(): Promise<void>;
	/** The Refresh button: start with force. */
	refresh(): Promise<void>;
	stop(): void;
}

export const STORED_CONCURRENCY = 4;
export const FLUSH_EVERY_PAGES = 3;
export const MAX_RESTARTS = 2;
export const MAX_COMPLETE_ATTEMPTS = 3;
export const MAX_NETWORK_RETRIES = 3;
/** The pause before asking `complete` again, so the store's key listing can catch up. */
export const COMPLETE_RETRY_MS = 2000;
/** The store takes one write a second per key; meta is written by page 1 and again by `complete`. */
export const META_WRITE_GAP_MS = 1100;

const NETWORK_RETRY_BASE_MS = 2000;
const NETWORK_MESSAGE = 'Could not reach the server';

type ErrorCode = SyncErrorCode | 'NETWORK';
type Begin<T> = Extract<SyncStartResult<T>, { status: 'ok' | 'fresh' | 'open' }>;
type Cooldown = Extract<SyncStartResult<unknown>, { status: 'cooldown' }>;
type Completion = Exclude<SyncCompleteResult, SyncError>;
type Stored<T> = Exclude<SyncPageResult<T>, SyncError>;
type Kept = Exclude<SyncStoreResult, SyncError>;

/** Ends the active flow with phase 'error'. */
class Failure extends Error {
	constructor(
		readonly code: ErrorCode,
		message: string
	) {
		super(message);
	}
}

/** Unwinds the active flow silently: the engine was stopped, or a sibling request failed. */
class Stopped extends Error {}

/** Lets one request in a concurrent batch cancel the others. */
interface Guard {
	cancelled: boolean;
}

/** Enough of a first page to open a pass: a stored page 1, or one just fetched from Discogs. */
interface FirstPage<T> {
	snapshot: string;
	totalPages: number;
	totalItems: number;
	items: T[];
	profile?: PublicProfile;
}

interface PassOptions {
	/** Re-sync over a copy on screen: items are swapped in only at the end. */
	background: boolean;
	/** The snapshot is already complete in the store: read it concurrently, never call complete. */
	complete: boolean;
	/** The store holds pages of this snapshot: ask it for a page before asking Discogs. */
	inStore: boolean;
	/** Hand pages fetched from Discogs to the server. False for a list that is not public. */
	handover: boolean;
}

interface Pass<T> extends PassOptions {
	snapshot: string;
	totalPages: number;
	totalItems: number;
	/** Indexed by page number. */
	pages: T[][];
	/** Every page so far is in the store, so the snapshot can be completed. */
	allStored: boolean;
	/** This pass handed over page 1, which writes meta. */
	wroteMeta: boolean;
	sinceFlush: number;
}

const range = (from: number, to: number): number[] =>
	Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

export function createEngine<T>(options: EngineOptions<T>): Engine<T> {
	const { kind, username, initial, keyOf, onChange } = options;
	const autoRefresh = options.autoRefresh ?? true;
	const fetchFn: typeof fetch = options.deps?.fetchFn ?? ((input, init) => fetch(input, init));
	const discogs: DiscogsClient = options.deps?.discogs ?? { listPage: fetchListPage, profile: fetchProfile };
	const token = options.deps?.token ?? tokenFromCookie;
	const sleep = options.deps?.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	const now = options.deps?.now ?? Date.now;
	const base = `/api/${kind}/${encodeURIComponent(username)}`;

	let state: EngineState<T> = {
		profile: initial?.profile ?? null,
		items: initial?.firstPage ?? [],
		totalItems: initial?.totalItems ?? 0,
		loaded: initial?.firstPage.length ?? 0,
		phase: 'idle',
		background: false,
		resumeAt: null,
		asOf: initial?.completedAt ?? null,
		error: null,
		cooldownUntil: null
	};
	let stopped = false;
	let busy = false;
	/** The phase to return to when a wait ends. */
	let activePhase: LoaderPhase = 'loading';

	function update(patch: Partial<EngineState<T>>): void {
		if (stopped) return;
		state = { ...state, ...patch };
		onChange(state);
	}

	function checkLive(guard?: Guard): void {
		if (stopped || guard?.cancelled) throw new Stopped();
	}

	const failure = (code: SyncErrorCode) => new Failure(code, SYNC_MESSAGES[code]);

	/**
	 * One request to this site's server, read as JSON whatever its HTTP status. A
	 * network failure, an unrecognised body or UPSTREAM retries with backoff, then
	 * fails; any other error fails at once.
	 */
	async function call<R>(url: string, body: object | undefined, accepted: readonly string[], guard?: Guard): Promise<R> {
		const init: RequestInit | undefined = body && {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		};
		let failures = 0;
		for (;;) {
			checkLive(guard);
			let reply: { status: string } | null = null;
			try {
				const json: unknown = await (await fetchFn(url, init)).json();
				const status = typeof json === 'object' && json !== null ? (json as { status?: unknown }).status : undefined;
				if (typeof status === 'string' && (status === 'error' || accepted.includes(status))) {
					reply = json as { status: string };
				}
			} catch {
				// Network failure or unparseable body: retried below.
			}
			checkLive(guard);

			if (reply?.status === 'error') {
				const { code, message } = reply as SyncError;
				if (code !== 'UPSTREAM') throw new Failure(code, message);
			} else if (reply) {
				return reply as R;
			}
			if (failures === MAX_NETWORK_RETRIES) {
				throw reply ? new Failure('UPSTREAM', (reply as SyncError).message) : new Failure('NETWORK', NETWORK_MESSAGE);
			}
			await sleep(NETWORK_RETRY_BASE_MS * 2 ** failures++);
		}
	}

	/**
	 * One Discogs call. While Discogs is busy (a 429, or no answer the browser can
	 * read: the two look the same from here) it waits and tries again for as long
	 * as it takes, 30 s then 60 s. A rejected token, a missing user and a private
	 * list fail at once; anything else retries with backoff, then fails.
	 */
	async function fromDiscogs<R>(request: () => Promise<R>, guard?: Guard): Promise<R> {
		let waits = 0;
		let failures = 0;
		for (;;) {
			checkLive(guard);
			let caught: unknown;
			try {
				const result = await request();
				checkLive(guard);
				return result;
			} catch (e) {
				caught = e;
			}
			if (caught instanceof Stopped) throw caught;
			checkLive(guard);

			if (isBusy(caught)) {
				const delay = Math.min(DEFAULT_RETRY_AFTER_MS * 2 ** waits++, MAX_WAIT_MS);
				update({ phase: 'waiting', resumeAt: now() + delay });
				await sleep(delay);
				checkLive(guard);
				update({ phase: activePhase, resumeAt: null });
				continue;
			}
			// Not a Discogs answer at all: a bug, reported by `guarded`.
			if (!(caught instanceof DiscogsAPIError)) throw caught;
			const code = caught.code;
			if (code === 'BAD_TOKEN' || code === 'NOT_FOUND' || code === 'PRIVATE') throw failure(code);
			if (failures === MAX_NETWORK_RETRIES) throw failure('UPSTREAM');
			await sleep(NETWORK_RETRY_BASE_MS * 2 ** failures++);
		}
	}

	function requireToken(): string {
		const value = token();
		if (!value) throw failure('TOKEN_REQUIRED');
		return value;
	}

	const start = () => call<Begin<T>>(base, { action: 'start', force: false }, ['ok', 'fresh', 'open']);
	const forceStart = () =>
		call<Begin<T> | Cooldown>(base, { action: 'start', force: true }, ['ok', 'fresh', 'open', 'cooldown']);
	const getStored = (snapshot: string, page: number, guard?: Guard) =>
		call<Stored<T>>(`${base}?page=${page}&snapshot=${encodeURIComponent(snapshot)}`, undefined, ['ok', 'missing'], guard);

	/**
	 * Hands a page to the server. If it is not kept, the pass stops handing pages
	 * over and will not be completed: the visitor's view carries on regardless.
	 */
	async function handOver(pass: Pass<T>, page: PageHandover, guard?: Guard): Promise<void> {
		let kept = false;
		try {
			kept = (await call<Kept>(base, { action: 'page', ...page }, ['stored', 'unstored'], guard)).status === 'stored';
		} catch (e) {
			if (!(e instanceof Failure && e.code === 'BAD_REQUEST')) throw e;
		}
		if (!kept) {
			pass.handover = false;
			pass.allStored = false;
		}
	}

	/** The contiguous run of pages from page 1, in page order, de-duplicated. */
	function itemsOf(pass: Pass<T>): T[] {
		const seen = new Set<number>();
		const out: T[] = [];
		for (let page = 1; pass.pages[page]; page++) {
			for (const item of pass.pages[page]) {
				const key = keyOf(item);
				if (!seen.has(key)) {
					seen.add(key);
					out.push(item);
				}
			}
		}
		return out;
	}

	const loadedOf = (pass: Pass<T>) => pass.pages.reduce((sum, list) => sum + list.length, 0);

	function openPass(first: FirstPage<T>, options: PassOptions): Pass<T> {
		const pass: Pass<T> = {
			...options,
			snapshot: first.snapshot,
			totalPages: first.totalPages,
			totalItems: first.totalItems,
			pages: [],
			allStored: options.handover,
			wroteMeta: false,
			sinceFlush: 1
		};
		pass.pages[1] = first.items;
		activePhase = pass.background ? 'refreshing' : 'loading';
		update({
			profile: first.profile ?? state.profile,
			totalItems: pass.totalItems,
			loaded: first.items.length,
			phase: activePhase,
			background: pass.background,
			resumeAt: null,
			error: null,
			// Page 1 goes on screen at once; only the pages after it are batched.
			...(pass.background ? {} : { items: itemsOf(pass) })
		});
		return pass;
	}

	/**
	 * Opens a pass from Discogs: page 1 and the profile, fetched with the token.
	 * `store` is false when this visitor may not write to the shared store: then
	 * the list is simply shown. Otherwise it first asks Discogs for the list with
	 * no token, and hands page 1 over only if that is answered: a list that is not
	 * public is shown to its owner and never stored.
	 */
	async function openFromDiscogs(snapshot: string, background: boolean, store: boolean): Promise<Pass<T>> {
		const visitor = requireToken();
		let handover = store;
		if (store) {
			try {
				await fromDiscogs(() => discogs.listPage(kind, username, 1, 1, undefined));
			} catch (e) {
				const code = e instanceof Failure ? e.code : null;
				if (code !== 'PRIVATE' && code !== 'BAD_TOKEN' && code !== 'NOT_FOUND') throw e;
				// Not public, or the user is gone: the stored copy goes now, so no later
				// visit is served it.
				await call<SyncDropResult>(base, { action: 'drop' }, ['dropped', 'refused']);
				if (code === 'NOT_FOUND') throw e;
				handover = false;
			}
		}

		const first = await fromDiscogs(() => discogs.listPage(kind, username, 1, PAGE_SIZE, visitor));
		const profile = publicProfile(await fromDiscogs(() => discogs.profile(username, visitor)));
		const page = {
			snapshot,
			totalPages: Math.max(1, first.pagination.pages),
			totalItems: first.pagination.items,
			items: first.items as T[],
			profile
		};
		const pass = openPass(page, { background, complete: false, inStore: false, handover });
		if (handover) {
			await handOver(pass, { ...page, page: 1 });
			pass.wroteMeta = pass.handover;
		}
		return pass;
	}

	/** One page from Discogs, handed over if this pass is storing. */
	async function pageFromDiscogs(pass: Pass<T>, page: number, guard?: Guard): Promise<T[]> {
		const visitor = requireToken();
		let found = { items: [] as unknown[], totalPages: pass.totalPages, totalItems: pass.totalItems };
		try {
			const list = await fromDiscogs(() => discogs.listPage(kind, username, page, PAGE_SIZE, visitor), guard);
			found = { items: list.items, totalPages: Math.max(1, list.pagination.pages), totalItems: list.pagination.items };
		} catch (e) {
			// The list shrank during the pass: a page Discogs no longer has is an empty page.
			if (!(e instanceof Failure && e.code === 'NOT_FOUND' && page > 1)) throw e;
		}
		if (pass.handover) await handOver(pass, { snapshot: pass.snapshot, page, ...found }, guard);
		return found.items as T[];
	}

	/** Fetches one page into the pass: from the store if it may be there, otherwise from Discogs. */
	async function fetchPage(pass: Pass<T>, page: number, guard?: Guard): Promise<void> {
		let items: T[] | null = null;
		if (pass.inStore) {
			const reply = await getStored(pass.snapshot, page, guard);
			if (reply.status === 'ok') items = reply.items;
		}
		pass.pages[page] = items ?? (await pageFromDiscogs(pass, page, guard));
		const flush = ++pass.sinceFlush >= FLUSH_EVERY_PAGES;
		if (flush) pass.sinceFlush = 0;
		update({ loaded: loadedOf(pass), ...(flush && !pass.background ? { items: itemsOf(pass) } : {}) });
	}

	/** One page at a time. Discogs calls are paced by the client's own queue. */
	async function fetchInOrder(pass: Pass<T>, pages: number[]): Promise<void> {
		for (const page of pages) await fetchPage(pass, page);
	}

	/** Pages 2.. of a complete stored copy, STORED_CONCURRENCY at a time. */
	async function fetchConcurrent(pass: Pass<T>): Promise<void> {
		const guard: Guard = { cancelled: false };
		let next = 2;
		const worker = async () => {
			try {
				while (next <= pass.totalPages) await fetchPage(pass, next++, guard);
			} catch (e) {
				guard.cancelled = true;
				throw e;
			}
		};
		await Promise.all(Array.from({ length: Math.min(STORED_CONCURRENCY, pass.totalPages - 1) }, worker));
	}

	async function runPass(pass: Pass<T>): Promise<void> {
		if (pass.complete) await fetchConcurrent(pass);
		else await fetchInOrder(pass, range(2, pass.totalPages));

		let completedAt: number | null = null;
		if (!pass.complete && pass.allStored) {
			// Longer passes are already paced past the store's one write a second.
			if (pass.wroteMeta && pass.totalPages === 1) await sleep(META_WRITE_GAP_MS);
			// A page reported missing may only be missing from a short key listing,
			// so from here on the store is asked before Discogs.
			pass.inStore = true;
			for (let attempt = 1; ; attempt++) {
				const reply = await call<Completion>(base, { action: 'complete', snapshot: pass.snapshot }, ['complete', 'incomplete']);
				if (reply.status === 'complete') {
					completedAt = reply.completedAt;
					break;
				}
				if (attempt === MAX_COMPLETE_ATTEMPTS) break;
				await fetchInOrder(pass, reply.missing);
				await sleep(COMPLETE_RETRY_MS);
			}
		}
		update({
			items: itemsOf(pass),
			totalItems: pass.totalItems,
			loaded: loadedOf(pass),
			phase: 'done',
			background: false,
			resumeAt: null,
			...(completedAt !== null ? { asOf: completedAt } : {})
		});
	}

	async function syncFrom(reply: Begin<T>, background: boolean): Promise<void> {
		if (reply.status === 'open') {
			return runPass(await openFromDiscogs(reply.snapshot, background, reply.store));
		}
		if (reply.status === 'ok') {
			return runPass(openPass(reply, { background, complete: false, inStore: true, handover: true }));
		}
		const first = await getStored(reply.snapshot, 1);
		if (first.status === 'ok') {
			return runPass(openPass(first, { background, complete: true, inStore: true, handover: true }));
		}
		// The store has lost page 1 of its current copy. Show the list straight from
		// Discogs and store nothing; the next sync rebuilds the copy.
		await runPass(await openFromDiscogs(reply.snapshot, background, false));
	}

	/** Runs a pass; when its snapshot expires, starts again, at most MAX_RESTARTS times. */
	async function withRestarts(first: () => Promise<void>, background: boolean): Promise<void> {
		let attempt = first;
		for (let restarts = 0; ; restarts++) {
			try {
				return await attempt();
			} catch (e) {
				if (!(e instanceof Failure && e.code === 'SNAPSHOT_EXPIRED') || restarts === MAX_RESTARTS) throw e;
				attempt = async () => syncFrom(await start(), background);
			}
		}
	}

	async function guarded(flow: () => Promise<void>): Promise<void> {
		busy = true;
		try {
			await flow();
		} catch (caught) {
			if (caught instanceof Stopped) return;
			// A malformed reply or a bug: end the flow rather than leave a loader spinning.
			if (!(caught instanceof Failure)) console.error('[record-shelf] sync engine: unexpected error', caught);
			const e = caught instanceof Failure ? caught : new Failure('NETWORK', NETWORK_MESSAGE);
			update({
				phase: 'error',
				error: { code: e.code, message: e.message },
				background: false,
				resumeAt: null,
				...(e.code === 'NOT_FOUND' || e.code === 'PRIVATE' ? { items: [] } : {})
			});
		} finally {
			busy = false;
		}
	}

	async function firstLoad(): Promise<void> {
		if (!initial) return syncFrom(await start(), false);
		const first = { ...initial, items: initial.firstPage };
		await runPass(openPass(first, { background: false, complete: initial.complete, inStore: true, handover: true }));
	}

	async function run(): Promise<void> {
		if (busy) return;
		await guarded(async () => {
			activePhase = 'loading';
			update({ phase: 'loading', error: null, resumeAt: null });
			await withRestarts(firstLoad, false);
		});
		if (autoRefresh && state.phase === 'done') await refreshIfStale();
	}

	async function refreshIfStale(): Promise<void> {
		if (busy || state.asOf === null || now() - state.asOf < FRESH_MS) return;
		await guarded(async () => {
			activePhase = state.phase;
			const reply = await start();
			if (reply.status !== 'fresh') await withRestarts(() => syncFrom(reply, true), true);
		});
	}

	async function refresh(): Promise<void> {
		if (busy) return;
		await guarded(async () => {
			activePhase = state.phase;
			const reply = await forceStart();
			if (reply.status === 'cooldown') update({ cooldownUntil: now() + reply.retryAfterMs });
			else if (reply.status !== 'fresh') await withRestarts(() => syncFrom(reply, true), true);
		});
	}

	return {
		get state() {
			return state;
		},
		run,
		refreshIfStale,
		refresh,
		stop() {
			stopped = true;
		}
	};
}
