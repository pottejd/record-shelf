export interface Store {
	readonly backend: 'kv' | 'memory';
	getJSON<T>(key: string): Promise<T | null>;
	/** Resolves false (after console.error) when the write fails. */
	putJSON(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
	listKeys(prefix: string): Promise<string[]>;
	delete(key: string): Promise<void>;
}

interface KVLike {
	get(key: string, type: 'json'): Promise<unknown>;
	put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
	delete(key: string): Promise<void>;
	list(options: { prefix: string; cursor?: string }): Promise<{
		keys: { name: string }[];
		list_complete: boolean;
		cursor?: string;
	}>;
}

export const MEMORY_MAX_ENTRIES = 5000;

const MISSING_BINDING_MESSAGE =
	'[record-shelf] COLLECTION_CACHE KV binding is missing — using a per-isolate memory store. Add the binding in wrangler.toml.';

// Map iteration order is insertion order, so the first key is the oldest insertion.
const memory = new Map<string, { json: string; expiresAt: number }>();
let missingBindingLogged = false;

export function resetMemoryStoreForTests(): void {
	memory.clear();
	missingBindingLogged = false;
}

function createMemoryStore(): Store {
	return {
		backend: 'memory',
		async getJSON<T>(key: string): Promise<T | null> {
			const entry = memory.get(key);
			if (!entry) return null;
			if (entry.expiresAt <= Date.now()) {
				memory.delete(key);
				return null;
			}
			return JSON.parse(entry.json) as T;
		},
		async putJSON(key, value, ttlSeconds) {
			try {
				const json = JSON.stringify(value);
				memory.delete(key);
				if (memory.size >= MEMORY_MAX_ENTRIES) {
					const oldest = memory.keys().next();
					if (!oldest.done) memory.delete(oldest.value);
				}
				memory.set(key, { json, expiresAt: Date.now() + ttlSeconds * 1000 });
				return true;
			} catch (e) {
				console.error('Memory store write error:', e);
				return false;
			}
		},
		async listKeys(prefix) {
			const now = Date.now();
			const keys: string[] = [];
			for (const [key, entry] of memory) {
				if (entry.expiresAt <= now) memory.delete(key);
				else if (key.startsWith(prefix)) keys.push(key);
			}
			return keys;
		},
		async delete(key) {
			memory.delete(key);
		}
	};
}

function createKVStore(kv: KVLike): Store {
	return {
		backend: 'kv',
		async getJSON<T>(key: string): Promise<T | null> {
			try {
				return ((await kv.get(key, 'json')) as T | null) ?? null;
			} catch (e) {
				console.error('KV read error:', e);
				return null;
			}
		},
		async putJSON(key, value, ttlSeconds) {
			try {
				await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
				return true;
			} catch (e) {
				console.error('KV write error:', e);
				return false;
			}
		},
		async listKeys(prefix) {
			const keys: string[] = [];
			try {
				let cursor: string | undefined;
				for (;;) {
					const page = await kv.list(cursor ? { prefix, cursor } : { prefix });
					for (const k of page.keys) keys.push(k.name);
					if (page.list_complete || !page.cursor) break;
					cursor = page.cursor;
				}
			} catch (e) {
				console.error('KV list error:', e);
			}
			return keys;
		},
		async delete(key) {
			try {
				await kv.delete(key);
			} catch (e) {
				console.error('KV delete error:', e);
			}
		}
	};
}

const memoryStore = createMemoryStore();

export function getStore(platform: App.Platform | undefined): Store {
	const env = platform?.env as Record<string, unknown> | undefined;
	const kv = env?.COLLECTION_CACHE as KVLike | undefined;
	if (kv) return createKVStore(kv);
	if (env !== undefined && !missingBindingLogged) {
		missingBindingLogged = true;
		console.error(MISSING_BINDING_MESSAGE);
	}
	return memoryStore;
}
