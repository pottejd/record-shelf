import adapter from '@sveltejs/adapter-node';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			out: 'build'
		}),
		csp: {
			mode: 'hash',
			directives: {
				'script-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self']
			}
		},
		version: {
			name: pkg.version
		}
	}
};

export default config;
