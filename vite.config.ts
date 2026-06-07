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
				lines: 55,
				functions: 55,
				branches: 55,
				statements: 55
			}
		}
	}
});
