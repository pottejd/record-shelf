import { describe, it, expect, vi } from 'vitest';
const made = vi.hoisted(() => ({ kinds: [] as string[] }));
vi.mock('$lib/server/syncRoute', () => ({
	makeSyncHandlers: (kind: string) => { made.kinds.push(kind); return { GET: 'g', POST: 'p' }; }
}));
import * as route from './+server';

describe('wantlist sync route', () => {
	it('is the wantlist sync handlers and nothing else', () => {
		expect(made.kinds).toEqual(['wantlist']);
		expect(Object.keys(route).sort()).toEqual(['GET', 'POST']);
	});
});
