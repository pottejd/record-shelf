import { json, error, type RequestHandler } from '@sveltejs/kit';
import { kvGetJSON, kvPutJSON } from '$lib/server/cache';

interface Snapshot {
	date: string; // YYYY-MM-DD
	value: number;
	currency: string;
}

const MAX_SNAPSHOTS = 52;
const TTL_SECONDS = 60 * 60 * 24 * 400; // ~400 days

function historyKey(username: string): string {
	return `value-history:${username.toLowerCase()}`;
}

export const GET: RequestHandler = async ({ params, platform }) => {
	const history = (await kvGetJSON<Snapshot[]>(platform, historyKey(params.username!))) ?? [];
	return json({ history });
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
	let body: { value?: unknown; currency?: unknown } | null;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const value = Number((body as { value?: unknown })?.value);
	if (!body || typeof body !== 'object' || !Number.isFinite(value) || value < 0) {
		throw error(400, 'A non-negative numeric "value" is required');
	}
	const currency =
		typeof (body as { currency?: unknown }).currency === 'string'
			? (body as { currency: string }).currency
			: 'USD';

	const date = new Date().toISOString().slice(0, 10);
	const history = (await kvGetJSON<Snapshot[]>(platform, historyKey(params.username!))) ?? [];

	// One snapshot per day — replace today's if it already exists.
	const todayIdx = history.findIndex((s) => s.date === date);
	const snapshot: Snapshot = { date, value: Math.round(value), currency };
	if (todayIdx >= 0) history[todayIdx] = snapshot;
	else history.push(snapshot);

	const trimmed = history.slice(-MAX_SNAPSHOTS);
	await kvPutJSON(platform, historyKey(params.username!), trimmed, TTL_SECONDS);

	return json({ history: trimmed });
};
