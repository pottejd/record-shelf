import type { RequestHandler } from '@sveltejs/kit';
import { getStore } from './store';
import { completeSync, dropStored, getPage, startSync, storePage, type SyncDeps } from './sync';
import { isWriter } from './writers';
import { MAX_HANDOVER_CHARS, SYNC_MESSAGES, type SyncError, type SyncErrorCode, type SyncKind } from '$lib/sync/types';

const ERROR_STATUS: Record<SyncErrorCode, number> = {
	TOKEN_REQUIRED: 401,
	BAD_TOKEN: 401,
	PRIVATE: 403,
	NOT_FOUND: 404,
	SNAPSHOT_EXPIRED: 409,
	BAD_REQUEST: 400,
	UPSTREAM: 502
};

export function httpStatusFor(result: { status: string; code?: SyncErrorCode }): number {
	return result.status === 'error' && result.code ? (ERROR_STATUS[result.code] ?? 502) : 200;
}

function respond(result: { status: string; code?: SyncErrorCode }): Response {
	return new Response(JSON.stringify(result), {
		status: httpStatusFor(result),
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
	});
}

const errorOf = (code: SyncErrorCode): SyncError => ({ status: 'error', code, message: SYNC_MESSAGES[code] });
const tokenRequired = errorOf('TOKEN_REQUIRED');
const badRequest = errorOf('BAD_REQUEST');

/**
 * The sync endpoints for one kind of list. They only read and write the store:
 * the visitor's browser makes every Discogs call. A token cookie is needed to read;
 * to write, its fingerprint must be one the site owner has listed (writers.ts).
 */
export function makeSyncHandlers(kind: SyncKind): { GET: RequestHandler; POST: RequestHandler } {
	const depsFor = (platform: App.Platform | undefined, writer: boolean): SyncDeps => ({
		store: getStore(platform),
		now: Date.now,
		writer
	});

	const GET: RequestHandler = async ({ params, platform, cookies, url }) => {
		// Reading needs a token cookie and nothing more.
		if (!cookies.get('discogs_token')) return respond(tokenRequired);
		const pageParam = url.searchParams.get('page');
		const snapshot = url.searchParams.get('snapshot');
		const page = pageParam !== null && /^\d+$/.test(pageParam) ? Number(pageParam) : NaN;
		if (!Number.isInteger(page) || !snapshot) return respond(badRequest);
		return respond(await getPage(kind, params.username ?? '', snapshot, page, depsFor(platform, false)));
	};

	const POST: RequestHandler = async ({ params, platform, cookies, request }) => {
		const token = cookies.get('discogs_token');
		if (!token) return respond(tokenRequired);
		// A handed-over page is the only large body; anything bigger is refused unread.
		if (Number(request.headers.get('content-length') ?? 0) > MAX_HANDOVER_CHARS) return respond(badRequest);
		let body: { action?: unknown; force?: unknown; snapshot?: unknown };
		try {
			const text = await request.text();
			if (text.length > MAX_HANDOVER_CHARS) return respond(badRequest);
			body = JSON.parse(text);
		} catch {
			return respond(badRequest);
		}
		if (typeof body !== 'object' || body === null) return respond(badRequest);
		const username = params.username ?? '';
		// Only the token's fingerprint is looked at; the token goes no further.
		const deps = depsFor(platform, await isWriter(token));
		if (body.action === 'start') return respond(await startSync(kind, username, body.force === true, deps));
		if (body.action === 'page') return respond(await storePage(kind, username, body, deps));
		if (body.action === 'complete' && typeof body.snapshot === 'string') {
			return respond(await completeSync(kind, username, body.snapshot, deps));
		}
		if (body.action === 'drop') return respond(await dropStored(kind, username, deps));
		return respond(badRequest);
	};

	return { GET, POST };
}
