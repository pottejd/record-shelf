import { makeSyncHandlers } from '$lib/server/syncRoute';

export const { GET, POST } = makeSyncHandlers('wantlist');
