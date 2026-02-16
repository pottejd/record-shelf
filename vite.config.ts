import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.ts', 'src/routes/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
			thresholds: {
				lines: 40,
				functions: 40,
				branches: 40,
				statements: 40
			}
		}
	}
});
