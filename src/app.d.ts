// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				COLLECTION_CACHE?: KVNamespace;
			};
			/**
			 * Cloudflare execution context. `waitUntil` keeps the isolate alive for
			 * background work (e.g. caching a full collection after the response is sent).
			 */
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
