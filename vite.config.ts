import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		include: ['src/**/*.test.ts'],
		setupFiles: ['./vitest-setup.ts'],
		coverage: {
			provider: 'v8',
			include: [
				'src/lib/**/*.ts',
				'src/routes/**/*.ts',
				'src/**/*.svelte',
				'src/service-worker.ts'
			],
			exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
			// Thresholds are an honest floor measured with .svelte components
			// included (true coverage ~33%). The old 55% only held because the
			// include glob excluded components, hiding the UI test gap. Ratchet
			// these up as component tests are added.
			thresholds: {
				lines: 30,
				functions: 30,
				branches: 30,
				statements: 30
			}
		}
	}
});
