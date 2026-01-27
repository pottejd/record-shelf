<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { settings } from '$lib/stores/settings';
	import { version } from '$app/environment';

	let token = $settings.discogsToken;
	let showToken = false;
	let saved = false;
	let testing = false;
	let testResult: { success: boolean; message: string } | null = null;

	// Check for redirect parameter (e.g., when redirected from profile page)
	$: redirectTo = $page.url.searchParams.get('redirect');
	$: showRedirectNotice = !!redirectTo && !$settings.discogsToken;

	function handleSave() {
		settings.setToken(token.trim());
		saved = true;
		testResult = null;

		// If there's a redirect URL, go there after a short delay
		if (redirectTo) {
			setTimeout(() => {
				goto(redirectTo);
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

		try {
			const response = await fetch('/api/test-token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Discogs-Token': token.trim()
				}
			});

			const data = await response.json();

			if (response.ok) {
				testResult = { success: true, message: `Connected as: ${data.username}` };
			} else {
				testResult = { success: false, message: data.error || 'Invalid token' };
			}
		} catch (e) {
			testResult = { success: false, message: 'Failed to test token' };
		} finally {
			testing = false;
		}
	}
</script>

<svelte:head>
	<title>Settings - Record Shelf</title>
</svelte:head>

<main class="settings">
	<header class="settings-header">
		<a href="/" class="back-link">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M19 12H5M12 19l-7-7 7-7" />
			</svg>
			Back
		</a>
		<h1>Settings</h1>
	</header>

	{#if showRedirectNotice}
		<div class="redirect-notice">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<p>You need to set up a Discogs API token to view collections. Follow the steps below to get started.</p>
		</div>
	{/if}

	<section class="card">
		<h2>Discogs API Token</h2>
		<p class="description">
			Record Shelf needs a Discogs Personal Access Token to fetch collection data.
			Your token is stored locally in your browser and never sent to our servers.
		</p>

		<div class="token-input-group">
			<div class="input-wrapper">
				{#if showToken}
					<input
						type="text"
						bind:value={token}
						placeholder="Paste your token here"
						class="token-input"
					/>
				{:else}
					<input
						type="password"
						bind:value={token}
						placeholder="Paste your token here"
						class="token-input"
					/>
				{/if}
				<button
					type="button"
					class="toggle-visibility"
					onclick={() => (showToken = !showToken)}
					aria-label={showToken ? 'Hide token' : 'Show token'}
				>
					{#if showToken}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
							<line x1="1" y1="1" x2="23" y2="23" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					{/if}
				</button>
			</div>

			<div class="button-group">
				<button class="btn primary" onclick={handleSave} disabled={!token.trim()}>
					{#if saved}
						Saved!
					{:else}
						Save Token
					{/if}
				</button>
				<button class="btn secondary" onclick={testToken} disabled={testing || !token.trim()}>
					{#if testing}
						Testing...
					{:else}
						Test Token
					{/if}
				</button>
				{#if $settings.discogsToken}
					<button class="btn danger" onclick={handleClear}>Clear</button>
				{/if}
			</div>
		</div>

		{#if testResult}
			<div class="test-result" class:success={testResult.success} class:error={!testResult.success}>
				{#if testResult.success}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<line x1="15" y1="9" x2="9" y2="15" />
						<line x1="9" y1="9" x2="15" y2="15" />
					</svg>
				{/if}
				{testResult.message}
			</div>
		{/if}
	</section>

	<section class="card instructions">
		<h2>How to Get a Token</h2>
		<ol>
			<li>
				<strong>Go to Discogs</strong>
				<p>Visit <a href="https://www.discogs.com/settings/developers" target="_blank" rel="noopener">discogs.com/settings/developers</a></p>
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
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="16" x2="12" y2="12" />
				<line x1="12" y1="8" x2="12.01" y2="8" />
			</svg>
			<p>
				<strong>Privacy note:</strong> Your token is only stored in your browser's local storage.
				It's sent directly to Discogs when fetching data and is never stored on any server.
			</p>
		</div>
	</section>

	<section class="card about">
		<h2>About Record Shelf</h2>
		<p>
			Record Shelf visualizes your Discogs collection with beautiful charts and statistics.
			Enter any public Discogs username to explore their collection.
		</p>
		<p class="version">Version {version}</p>
		<p class="copyright">
			&copy; {new Date().getFullYear()} Record Shelf. All rights reserved.<br />
			Not affiliated with Discogs. Discogs is a trademark of Zink Media, Inc.
		</p>
	</section>
</main>

<style>
	.settings {
		max-width: 640px;
		margin: 0 auto;
		padding: 2rem;
	}

	.settings-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.redirect-notice {
		display: flex;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(234, 179, 8, 0.1));
		border: 1px solid rgba(249, 115, 22, 0.3);
		border-radius: 12px;
		margin-bottom: 1.5rem;
	}

	.redirect-notice svg {
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		color: #f97316;
	}

	.redirect-notice p {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--color-text);
		line-height: 1.5;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--color-text-secondary);
		text-decoration: none;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		transition: background-color 0.15s, color 0.15s;
	}

	.back-link:hover {
		background: var(--color-bg-secondary);
		color: var(--color-text);
	}

	.back-link svg {
		width: 18px;
		height: 18px;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.card {
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.card h2 {
		margin: 0 0 0.75rem;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.description {
		margin: 0 0 1.25rem;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.token-input-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.input-wrapper {
		position: relative;
		display: flex;
	}

	.token-input {
		flex: 1;
		padding: 0.875rem 3rem 0.875rem 1rem;
		font-size: 0.9375rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg);
		color: var(--color-text);
		font-family: monospace;
	}

	.token-input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	.toggle-visibility {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		padding: 0.375rem;
		cursor: pointer;
		color: var(--color-text-tertiary);
		border-radius: 6px;
		transition: color 0.15s, background-color 0.15s;
	}

	.toggle-visibility:hover {
		color: var(--color-text-secondary);
		background: var(--color-bg-secondary);
	}

	.toggle-visibility svg {
		width: 20px;
		height: 20px;
		display: block;
	}

	.button-group {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.btn {
		padding: 0.625rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 600;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn.primary {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	.btn.secondary {
		background: var(--color-bg-secondary);
		color: var(--color-text);
	}

	.btn.secondary:hover:not(:disabled) {
		background: var(--color-bg-tertiary);
	}

	.btn.danger {
		background: #fee2e2;
		color: #dc2626;
	}

	.btn.danger:hover:not(:disabled) {
		background: #fecaca;
	}

	.test-result {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.test-result svg {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.test-result.success {
		background: #dcfce7;
		color: #166534;
	}

	.test-result.error {
		background: #fee2e2;
		color: #dc2626;
	}

	.instructions ol {
		margin: 0;
		padding: 0 0 0 1.25rem;
	}

	.instructions li {
		margin-bottom: 1rem;
	}

	.instructions li:last-child {
		margin-bottom: 0;
	}

	.instructions li strong {
		display: block;
		margin-bottom: 0.25rem;
	}

	.instructions li p {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.instructions a {
		color: var(--color-primary);
	}

	.note {
		display: flex;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: 10px;
		font-size: 0.875rem;
	}

	.note svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--color-primary);
	}

	.note p {
		margin: 0;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	.note strong {
		color: var(--color-text);
	}

	.about p {
		margin: 0 0 0.75rem;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.version {
		font-size: 0.8125rem;
		color: var(--color-text-tertiary);
		margin-bottom: 0.5rem;
	}

	.copyright {
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		line-height: 1.6;
		margin: 0;
	}

	@media (max-width: 500px) {
		.settings {
			padding: 1rem;
		}

		.card {
			padding: 1.25rem;
		}

		.button-group {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>
