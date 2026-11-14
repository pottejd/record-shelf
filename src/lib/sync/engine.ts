import {
	FRESH_MS,
	MAX_WAIT_MS,
	type PublicProfile,
	type StoredInitial,
	type SyncCompleteResult,
	type SyncError,
	type SyncErrorCode,
	type SyncKind,
	type SyncOk,
	type SyncStartResult,
	type SyncWait
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

export interface EngineDeps {
	fetchFn: typeof fetch;
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

const NETWORK_RETRY_BASE_MS = 2000;
const NETWORK_MESSAGE = 'Could not reach the server';

type ErrorCode = SyncErrorCode | 'NETWORK';
type Begin<T> = Extract<SyncStartResult<T>, { status: 'ok' | 'fresh' }>;
type Cooldown = Extract<SyncStartResult<unknown>, { status: 'cooldown' }>;
type Completion = Exclude<SyncCompleteResult, SyncError>;

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

/** Enough of a first page to open a pass: an ok response, or the stored initial page. */
interface FirstPage<T> {
	snapshot: string;
	totalPages: number;
	totalItems: number;
	items: T[];
	stored: boolean;
	nextDelayMs: number;
	profile?: PublicProfile;
}

interface Pass<T> {
	snapshot: string;
	totalPages: number;
	totalItems: number;
	/** Indexed by page number. */
	pages: T[][];
	/** Re-sync over a copy on screen: items are swapped in only at the end. */
	background: boolean;
	/** The snapshot is already complete in the store: fetch concurrently, never call complete. */
	complete: boolean;
	allStored: boolean;
	nextDelayMs: number;
	sinceFlush: number;
}

const range = (from: number, to: number): number[] =>
	Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

export function createEngine<T>(options: EngineOptions<T>): Engine<T> {
	const { kind, username, initial, keyOf, onChange } = options;
	const autoRefresh = options.autoRefresh ?? true;
	const fetchFn: typeof fetch = options.deps?.fetchFn ?? ((input, init) => fetch(input, init));
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

	/**
	 * One request, read as JSON whatever its HTTP status. `wait` sleeps and retries
	 * for as long as the server asks; a network failure, an unrecognised body or
	 * UPSTREAM retries with backoff, then fails; any other error fails at once.
	 */
	async function call<R>(url: string, body: object | undefined, accepted: readonly string[], guard?: Guard): Promise<R> {
		const init: RequestInit | undefined = body && {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		};
		let waits = 0;
		let failures = 0;
		for (;;) {
			checkLive(guard);
			let reply: { status: string } | null = null;
			try {
				const json: unknown = await (await fetchFn(url, init)).json();
				const status = typeof json === 'object' && json !== null ? (json as { status?: unknown }).status : undefined;
				if (typeof status === 'string' && (status === 'wait' || status === 'error' || accepted.includes(status))) {
					reply = json as { status: string };
				}
			} catch {
				// Network failure or unparseable body: retried below.
			}
			checkLive(guard);

			if (reply?.status === 'wait') {
				const delay = Math.min((reply as SyncWait).retryAfterMs * 2 ** waits++, MAX_WAIT_MS);
				update({ phase: 'waiting', resumeAt: now() + delay });
				await sleep(delay);
				checkLive(guard);
				update({ phase: activePhase, resumeAt: null });
				continue;
			}
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

	const start = () => call<Begin<T>>(base, { action: 'start', force: false }, ['ok', 'fresh']);
	const forceStart = () =>
		call<Begin<T> | Cooldown>(base, { action: 'start', force: true }, ['ok', 'fresh', 'cooldown']);
	const getPage = (snapshot: string, page: number, guard?: Guard) =>
		call<SyncOk<T>>(`${base}?page=${page}&snapshot=${encodeURIComponent(snapshot)}`, undefined, ['ok'], guard);

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

	function openPass(first: FirstPage<T>, background: boolean, complete: boolean): Pass<T> {
		const pass: Pass<T> = {
			snapshot: first.snapshot,
			totalPages: first.totalPages,
			totalItems: first.totalItems,
			pages: [],
			background,
			complete,
			allStored: first.stored,
			nextDelayMs: first.nextDelayMs,
			sinceFlush: 1
		};
		pass.pages[1] = first.items;
		activePhase = background ? 'refreshing' : 'loading';
		update({
			profile: first.profile ?? state.profile,
			totalItems: pass.totalItems,
			loaded: first.items.length,
			phase: activePhase,
			background,
			resumeAt: null,
			error: null,
			// Page 1 goes on screen at once; only the pages after it are batched.
			...(background ? {} : { items: itemsOf(pass) })
		});
		return pass;
	}

	/** Fetches one page into the pass and returns its nextDelayMs. */
	async function fetchPage(pass: Pass<T>, page: number, guard?: Guard): Promise<number> {
		const reply = await getPage(pass.snapshot, page, guard);
		pass.pages[page] = reply.items;
		pass.allStored &&= reply.stored;
		pass.nextDelayMs = reply.nextDelayMs;
		const flush = ++pass.sinceFlush >= FLUSH_EVERY_PAGES;
		if (flush) pass.sinceFlush = 0;
		update({ loaded: loadedOf(pass), ...(flush && !pass.background ? { items: itemsOf(pass) } : {}) });
		return reply.nextDelayMs;
	}

	/** One page at a time, sleeping the last response's nextDelayMs before each. */
	async function fetchPaced(pass: Pass<T>, pages: number[]): Promise<void> {
		for (const page of pages) {
			if (pass.nextDelayMs > 0) await sleep(pass.nextDelayMs);
			await fetchPage(pass, page);
		}
	}

	/**
	 * Pages 2.. of a complete stored copy, STORED_CONCURRENCY at a time, no sleeping.
	 * The first reply asking for a delay (a page missed the store and came from
	 * Discogs) stops new concurrent requests; the rest of the pass is paced.
	 */
	async function fetchStored(pass: Pass<T>): Promise<void> {
		const guard: Guard = { cancelled: false };
		let next = 2;
		// The latest delay above zero any reply asked for.
		let delay = pass.nextDelayMs;
		const worker = async () => {
			try {
				while (delay <= 0 && next <= pass.totalPages) {
					const ms = await fetchPage(pass, next++, guard);
					if (ms > 0) delay = ms;
				}
			} catch (e) {
				guard.cancelled = true;
				throw e;
			}
		};
		await Promise.all(Array.from({ length: Math.min(STORED_CONCURRENCY, pass.totalPages - 1) }, worker));
		// A store hit finishing after the switch must not erase the delay Discogs asked for.
		if (delay > 0) pass.nextDelayMs = delay;
		await fetchPaced(pass, range(next, pass.totalPages));
	}

	async function runPass(pass: Pass<T>): Promise<void> {
		if (pass.complete) await fetchStored(pass);
		else await fetchPaced(pass, range(2, pass.totalPages));

		let completedAt: number | null = null;
		if (!pass.complete && pass.allStored) {
			for (let attempt = 1; ; attempt++) {
				const reply = await call<Completion>(base, { action: 'complete', snapshot: pass.snapshot }, ['complete', 'incomplete']);
				if (reply.status === 'complete') {
					completedAt = reply.completedAt;
					break;
				}
				if (attempt === MAX_COMPLETE_ATTEMPTS) break;
				await fetchPaced(pass, reply.missing);
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
		if (reply.status === 'fresh') {
			await runPass(openPass(await getPage(reply.snapshot, 1), background, true));
		} else {
			await runPass(openPass(reply, background, false));
		}
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
		const first = { ...initial, items: initial.firstPage, stored: true, nextDelayMs: 0 };
		await runPass(openPass(first, false, initial.complete));
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
			if (reply.status === 'ok') await withRestarts(() => syncFrom(reply, true), true);
		});
	}

	async function refresh(): Promise<void> {
		if (busy) return;
		await guarded(async () => {
			activePhase = state.phase;
			const reply = await forceStart();
			if (reply.status === 'cooldown') update({ cooldownUntil: now() + reply.retryAfterMs });
			else if (reply.status === 'ok') await withRestarts(() => syncFrom(reply, true), true);
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
