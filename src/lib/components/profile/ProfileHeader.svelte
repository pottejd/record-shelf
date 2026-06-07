<script lang="ts">
	let { profile, badges, refreshing, onRefresh }: {
		profile: { username: string; avatar_url?: string; location?: string };
		badges: Array<{ label: string; style: string }>;
		refreshing: boolean;
		onRefresh: () => void;
	} = $props();
</script>

<nav class="nav-bar">
	<a href="/" class="home-link">
		<svg aria-hidden="true" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/>
			<circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
			<circle cx="24" cy="24" r="3" fill="currentColor"/>
		</svg>
		<span>Record Shelf</span>
	</a>
</nav>

<header class="profile-header">
	<div class="user-info">
		{#if profile.avatar_url}
			<img src={profile.avatar_url} alt={profile.username} class="avatar" />
		{/if}
		<div>
			<h1>{profile.username}</h1>
			{#if profile.location}
				<p class="location">{profile.location}</p>
			{/if}
			<div class="badges">
				{#each badges as badge}
					<span class="badge {badge.style}">{badge.label}</span>
				{/each}
			</div>
		</div>
	</div>
	<div class="header-actions">
		<button
			class="refresh-btn"
			onclick={onRefresh}
			disabled={refreshing}
			aria-label="Refresh collection"
		>
			<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spinning={refreshing}>
				<polyline points="23 4 23 10 17 10" />
				<polyline points="1 20 1 14 7 14" />
				<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
			</svg>
		</button>
		<a href="/u/{profile.username}/wantlist" class="discogs-link">
			Wantlist
		</a>
		<a href="https://www.discogs.com/user/{profile.username}" target="_blank" rel="noopener noreferrer" class="discogs-link">
			Discogs
		</a>
		<a href="/settings" class="settings-btn" aria-label="Settings">
			<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
			</svg>
		</a>
	</div>
</header>

<style>
	.nav-bar {
		margin-bottom: 1.5rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 600;
		font-size: 1rem;
		padding: 0.5rem 0.75rem 0.5rem 0.5rem;
		margin: -0.5rem;
		border-radius: 8px;
		transition: background-color 0.15s;
	}

	.home-link:hover {
		background: var(--color-bg-secondary);
	}

	.home-link svg {
		width: 28px;
		height: 28px;
		color: var(--color-primary);
	}

	.profile-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.user-info {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.avatar {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		object-fit: cover;
		border: 3px solid var(--color-border, #e0e0e0);
	}

	h1 {
		margin: 0;
		font-size: 1.75rem;
	}

	.location {
		margin: 0.25rem 0 0.5rem;
		color: var(--color-text-secondary, #666);
		font-size: 0.9375rem;
	}

	.badges {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.badge.primary {
		background: var(--gradient-brand);
		color: white;
	}

	.badge.era {
		background: linear-gradient(135deg, #f97316, #eab308);
		color: white;
	}

	.badge.format {
		background: linear-gradient(135deg, #10b981, #14b8a6);
		color: white;
	}

	.badge.size {
		background: linear-gradient(135deg, #ec4899, #f43f5e);
		color: white;
	}

	.badge.special {
		background: linear-gradient(135deg, #3b82f6, #06b6d4);
		color: white;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.refresh-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-tertiary);
		background: var(--color-bg-secondary, #f5f5f5);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
	}

	.refresh-btn:hover:not(:disabled) {
		color: var(--color-primary);
		background: var(--color-bg-tertiary, #e5e5e5);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh-btn svg {
		width: 18px;
		height: 18px;
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.discogs-link {
		padding: 0.5rem 1rem;
		background: var(--color-bg-secondary, #f5f5f5);
		border-radius: 6px;
		text-decoration: none;
		color: var(--color-text, #333);
		font-size: 0.875rem;
		transition: background-color 0.2s;
	}

	.discogs-link:hover {
		background: var(--color-bg-tertiary, #e5e5e5);
	}

	.settings-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-tertiary);
		background: var(--color-bg-secondary, #f5f5f5);
		border-radius: 6px;
		transition: background-color 0.2s, color 0.2s;
	}

	.settings-btn:hover {
		color: var(--color-primary);
		background: var(--color-bg-tertiary, #e5e5e5);
	}

	.settings-btn svg {
		width: 18px;
		height: 18px;
	}

	@media (max-width: 600px) {
		h1 {
			font-size: 1.5rem;
		}
	}
</style>
