import { json, error, type RequestHandler } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { kvGetJSON, kvPutJSON } from '$lib/server/cache';

interface Snapshot {
	date: string; // YYYY-MM-DD
	value: number;
	currency: string;
}

const MAX_SNAPSHOTS = 52;
const TTL_SECONDS = 60 * 60 * 24 * 400; // ~400 days
const MAX_VALUE = 1_000_000_000; // clamp so a forged snapshot can't dominate the chart

function historyKey(username: string): string {
	return `value-history:${username.toLowerCase()}`;
}

// Match the auth model of /api/collection and /api/value: a Discogs token
// (cookie or server env) is required. The app has no user accounts, so this
// gates out anonymous reads/writes rather than enforcing per-user ownership.
function requireToken(cookies: Cookies): void {
	const token = cookies.get('discogs_token') || env.DISCOGS_TOKEN;
	if (!token) throw error(401, 'Discogs token required');
}

// Read the stored series, tolerating a non-array (manual KV edit / schema drift)
// by treating it as empty rather than throwing or echoing garbage.
async function readHistory(
	platform: App.Platform | undefined,
	username: string
): Promise<Snapshot[]> {
	const stored = await kvGetJSON<unknown>(platform, historyKey(username));
	return Array.isArray(stored) ? (stored as Snapshot[]) : [];
}

export const GET: RequestHandler = async ({ params, platform, cookies }) => {
	requireToken(cookies);
	const history = await readHistory(platform, params.username!);
	return json({ history });
};

export const POST: RequestHandler = async ({ params, request, platform, cookies }) => {
	requireToken(cookies);

	let body: { value?: unknown; currency?: unknown } | null;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const value = Number((body as { value?: unknown })?.value);
	if (!body || typeof body !== 'object' || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
		throw error(400, 'A numeric "value" between 0 and 1e9 is required');
	}

	// Coerce currency to an ISO-4217-shaped code; ignore anything else.
	const rawCurrency = (body as { currency?: unknown }).currency;
	const currency =
		typeof rawCurrency === 'string' && /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'USD';

	const date = new Date().toISOString().slice(0, 10);
	const history = await readHistory(platform, params.username!);

	// One snapshot per day — replace today's if it already exists.
	const todayIdx = history.findIndex((s) => s.date === date);
	const snapshot: Snapshot = { date, value: Math.round(value), currency };
	if (todayIdx >= 0) history[todayIdx] = snapshot;
	else history.push(snapshot);

	const trimmed = history.slice(-MAX_SNAPSHOTS);
	await kvPutJSON(platform, historyKey(params.username!), trimmed, TTL_SECONDS);

	return json({ history: trimmed });
};
