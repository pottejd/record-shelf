import { describe, it, expect, vi } from 'vitest';
const made = vi.hoisted(() => ({ kinds: [] as string[] }));
vi.mock('$lib/server/syncRoute', () => ({
	makeSyncHandlers: (kind: string) => { made.kinds.push(kind); return { GET: 'g', POST: 'p' }; }
}));
import * as route from './+server';

describe('collection sync route', () => {
	it('is the collection sync handlers and nothing else (no DELETE)', () => {
		expect(made.kinds).toEqual(['collection']);
		expect(Object.keys(route).sort()).toEqual(['GET', 'POST']);
	});
});
