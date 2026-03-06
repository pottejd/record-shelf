import adapter from '@sveltejs/adapter-node';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			out: 'build'
		}),
		version: {
			name: pkg.version
		}
	}
};

export default config;
