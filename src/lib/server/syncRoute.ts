import type { RequestHandler } from '@sveltejs/kit';
import { getStore } from './store';
import { completeSync, discogsPort, getPage, startSync, type SyncDeps } from './sync';
import type { SyncError, SyncErrorCode, SyncKind } from '$lib/sync/types';

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

const tokenRequired: SyncError = {
	status: 'error',
	code: 'TOKEN_REQUIRED',
	message: 'A Discogs token is required'
};
const badRequest: SyncError = { status: 'error', code: 'BAD_REQUEST', message: 'Bad request' };

export function makeSyncHandlers(kind: SyncKind): { GET: RequestHandler; POST: RequestHandler } {
	const depsFor = (platform: App.Platform | undefined): SyncDeps => ({
		store: getStore(platform),
		discogs: discogsPort,
		now: Date.now
	});

	const GET: RequestHandler = async ({ params, platform, cookies, url }) => {
		const token = cookies.get('discogs_token');
		if (!token) return respond(tokenRequired);
		const pageParam = url.searchParams.get('page');
		const snapshot = url.searchParams.get('snapshot');
		const page = pageParam !== null && /^\d+$/.test(pageParam) ? Number(pageParam) : NaN;
		if (!Number.isInteger(page) || !snapshot) return respond(badRequest);
		return respond(await getPage(kind, params.username ?? '', token, snapshot, page, depsFor(platform)));
	};

	const POST: RequestHandler = async ({ params, platform, cookies, request }) => {
		const token = cookies.get('discogs_token');
		if (!token) return respond(tokenRequired);
		let body: { action?: unknown; force?: unknown; snapshot?: unknown };
		try {
			body = await request.json();
		} catch {
			return respond(badRequest);
		}
		if (typeof body !== 'object' || body === null) return respond(badRequest);
		const username = params.username ?? '';
		if (body.action === 'start') {
			return respond(await startSync(kind, username, token, body.force === true, depsFor(platform)));
		}
		if (body.action === 'complete' && typeof body.snapshot === 'string') {
			return respond(await completeSync(kind, username, body.snapshot, depsFor(platform)));
		}
		return respond(badRequest);
	};

	return { GET, POST };
}
