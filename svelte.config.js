import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterNode from '@sveltejs/adapter-node';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// One config for both deploy paths — select the adapter via env so the Docker
// container build (ADAPTER=node) and the default Cloudflare Pages build share
// the same kit settings and can't drift.
const adapter =
	process.env.ADAPTER === 'node'
		? adapterNode({ out: 'build' })
		: adapterCloudflare({
				routes: {
					include: ['/*'],
					exclude: ['<all>']
				}
			});

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter,
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
