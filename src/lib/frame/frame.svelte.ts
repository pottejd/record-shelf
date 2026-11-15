import { getContext, setContext } from 'svelte';

export interface Frame {
	refresh: { busy: boolean; run: (() => void) | null };
	help: (() => void) | null;
}

const KEY = Symbol('frame');

/** Called once by the root layout. Context, not a module variable: module state is shared between visitors on the server. */
export function initFrame(): Frame {
	const frame: Frame = $state({ refresh: { busy: false, run: null }, help: null });
	setContext(KEY, frame);
	return frame;
}

export function useFrame(): Frame {
	return getContext<Frame>(KEY);
}
