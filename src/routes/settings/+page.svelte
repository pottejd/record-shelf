<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { settings } from '$lib/stores/settings';
	import { checkToken } from '$lib/api/discogs';
	import { version } from '$app/environment';
	import { safeRedirectTarget } from '$lib/utils/redirect';

	let token = $state($settings.discogsToken);
	let showToken = $state(false);
	let saved = $state(false);
	let testing = $state(false);
	let testResult: { success: boolean; message: string } | null = $state(null);

	// Check for redirect parameter (e.g., when redirected from profile page)
	let redirectTo = $derived($page.url.searchParams.get('redirect'));
	let showRedirectNotice = $derived(!!redirectTo && !$settings.discogsToken);

	function handleSave() {
		settings.setToken(token.trim());
		saved = true;
		testResult = null;

		// If there's a redirect URL, go there after a short delay
		if (redirectTo) {
			const target = safeRedirectTarget(redirectTo);
			setTimeout(() => {
				goto(target);
			}, 500);
		} else {
			setTimeout(() => (saved = false), 2000);
		}
	}

	function handleClear() {
		token = '';
		settings.clearToken();
		testResult = null;
	}

	async function testToken() {
		if (!token.trim()) {
			testResult = { success: false, message: 'Please enter a token first' };
			return;
		}

		testing = true;
		testResult = null;

		// Asked of Discogs straight from this browser: the site's server never calls Discogs.
		testResult = await checkToken(token.trim());
		testing = false;
	}
</script>

<svelte:head>
	<title>Settings - Record Shelf</title>
</svelte:head>

<main id="main-content" class="settings">
	<header class="settings-header">
		<h1>Settings</h1>
	</header>

	{#if showRedirectNotice}
		<div class="redirect-notice error-note">
			<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<p>You need to set up a Discogs API token to view collections. Follow the steps below to get started.</p>
		</div>
	{/if}

	<section class="section">
		<h2>Discogs API Token</h2>
		<p class="description muted">
			Record Shelf needs a Discogs Personal Access Token to fetch collection data.
			Your token is stored in your browser and sent to this app as a cookie so it can fetch your collection server-side. It is never shared with third parties.
		</p>

		<div class="token-input-group">
			<div class="input-wrapper">
				{#if showToken}
					<input
						type="text"
						bind:value={token}
						placeholder="Paste your token here"
						class="field token-input"
					/>
				{:else}
					<input
						type="password"
						bind:value={token}
						placeholder="Paste your token here"
						class="field token-input"
					/>
				{/if}
				<button
					type="button"
					class="toggle-visibility"
					onclick={() => (showToken = !showToken)}
					aria-label={showToken ? 'Hide token' : 'Show token'}
				>
					{#if showToken}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
							<line x1="1" y1="1" x2="23" y2="23" />
						</svg>
					{:else}
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					{/if}
				</button>
			</div>

			<div class="button-group">
				<button class="btn btn-primary" onclick={handleSave} disabled={!token.trim()}>
					{#if saved}
						Saved!
					{:else}
						Save Token
					{/if}
				</button>
				<button class="btn btn-secondary" onclick={testToken} disabled={testing || !token.trim()}>
					{#if testing}
						Testing...
					{:else}
						Test Token
					{/if}
				</button>
				{#if $settings.discogsToken}
					<button class="btn btn-secondary" onclick={handleClear}>Clear</button>
				{/if}
			</div>
		</div>

		{#if testResult}
			<div class="test-result" class:success={testResult.success} class:error-note={!testResult.success}>
				{#if testResult.success}
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
				{:else}
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<line x1="15" y1="9" x2="9" y2="15" />
						<line x1="9" y1="9" x2="15" y2="15" />
					</svg>
				{/if}
				{testResult.message}
			</div>
		{/if}
	</section>

	<section class="section instructions">
		<h2>How to Get a Token</h2>
		<ol>
			<li>
				<strong>Go to Discogs</strong>
				<p>Visit <a href="https://www.discogs.com/settings/developers" target="_blank" rel="noopener noreferrer">discogs.com/settings/developers</a></p>
			</li>
			<li>
				<strong>Sign in</strong>
				<p>Log in to your Discogs account (or create one if you don't have one)</p>
			</li>
			<li>
				<strong>Generate a token</strong>
				<p>Click "Generate new token" button</p>
			</li>
			<li>
				<strong>Copy the token</strong>
				<p>Copy the generated token and paste it above</p>
			</li>
		</ol>

		<div class="note">
			<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="16" x2="12" y2="12" />
				<line x1="12" y1="8" x2="12.01" y2="8" />
			</svg>
			<p>
				<strong>Privacy note:</strong> Your token is stored in your browser and sent as a
				cookie to this app's server only to fetch your collection from Discogs on your behalf.
				It is never persisted server-side or shared with third parties.
			</p>
		</div>
	</section>

	<section class="section about">
		<h2>About Record Shelf</h2>
		<p>
			Record Shelf visualizes any public Discogs collection with beautiful charts and statistics.
			Enter any public Discogs username to explore their collection.
		</p>
		<p class="version small">Version {version}</p>
		<p class="copyright small">
			&copy; {new Date().getFullYear()} Record Shelf. All rights reserved.<br />
			Not affiliated with Discogs. Discogs is a trademark of Zink Media, Inc.
		</p>
	</section>
</main>

<style>
	.settings {
		max-width: 720px;
		padding-top: 56px;
	}

	.settings-header {
		margin-bottom: 48px;
	}

	h1 {
		margin: 0;
	}

	.redirect-notice {
		display: flex;
		gap: 12px;
		margin-bottom: 48px;
	}

	.redirect-notice svg {
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		color: var(--ink);
	}

	.redirect-notice p {
		margin: 0;
	}

	.description {
		margin: 0 0 24px;
	}

	.token-input-group {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.input-wrapper {
		position: relative;
		display: flex;
	}

	.token-input {
		flex: 1;
		min-width: 0;
		padding-right: 52px;
		font-family: ui-monospace, Consolas, monospace;
		font-size: 17px;
	}

	.token-input::placeholder {
		font-family: var(--font-sans);
	}

	.toggle-visibility {
		position: absolute;
		right: 0;
		bottom: 4px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--touch);
		height: var(--touch);
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}

	.toggle-visibility:hover {
		color: var(--ink);
	}

	.toggle-visibility svg {
		width: 20px;
		height: 20px;
		display: block;
	}

	.button-group {
		display: flex;
		gap: 12px 16px;
		flex-wrap: wrap;
	}

	.test-result {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 24px;
		font-weight: 500;
	}

	.test-result.success {
		padding: 4px 0 4px 16px;
		border-left: 4px solid var(--ink);
	}

	.test-result svg {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.instructions ol {
		margin: 0;
		padding: 0 0 0 1.25rem;
	}

	.instructions li {
		margin-bottom: 16px;
	}

	.instructions li:last-child {
		margin-bottom: 0;
	}

	.instructions li strong {
		display: block;
		margin-bottom: 2px;
	}

	.instructions li p {
		margin: 0;
		color: var(--muted);
	}

	.note {
		display: flex;
		gap: 12px;
		margin-top: 32px;
		padding-top: 16px;
		border-top: 1px solid var(--hairline);
	}

	.note svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--ink);
	}

	.note p {
		margin: 0;
		color: var(--muted);
	}

	.note strong {
		color: var(--ink);
	}

	.about p {
		margin: 0 0 12px;
		color: var(--muted);
	}

	.about .copyright {
		margin: 0;
		line-height: 1.6;
	}

	@media (max-width: 699px) {
		.settings {
			padding-top: 32px;
		}

		.button-group {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>
