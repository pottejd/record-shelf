import { createEngine, type Engine, type EngineOptions, type EngineState } from './engine';

export function createLoader<T>(options: Omit<EngineOptions<T>, 'onChange'>): Engine<T> {
	let state = $state.raw<EngineState<T>>(undefined as never);
	const engine = createEngine<T>({ ...options, onChange: (s) => (state = s) });
	state = engine.state;
	return {
		get state() { return state; },
		run: () => engine.run(),
		refreshIfStale: () => engine.refreshIfStale(),
		refresh: () => engine.refresh(),
		stop: () => engine.stop()
	};
}
