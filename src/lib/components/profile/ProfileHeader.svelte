<script lang="ts">
	let { profile, badges }: {
		profile: { username: string; avatar_url?: string; location?: string };
		badges: Array<{ label: string; style: string }>;
	} = $props();
</script>

<header class="profile-header">
	<div class="user-info">
		{#if profile.avatar_url}
			<img src={profile.avatar_url} alt={profile.username} class="avatar cover" />
		{/if}
		<div class="user-text">
			<h1>{profile.username}</h1>
			{#if profile.location}
				<p class="location lead">{profile.location}</p>
			{/if}
			<div class="badges">
				{#each badges as badge}
					<span class="badge {badge.style}">{badge.label}</span>
				{/each}
			</div>
		</div>
	</div>
</header>

<style>
	.profile-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 40px;
		flex-wrap: wrap;
		gap: 16px;
	}

	.user-info {
		display: flex;
		align-items: flex-start;
		gap: 20px;
		min-width: 0;
	}

	.user-text {
		min-width: 0;
	}

	.avatar {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
	}

	h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.location {
		margin: 12px 0 0;
	}

	/* Every badge alike: ink text with a hairline edge, square, no colour. */
	.badges {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 16px;
	}

	.badge {
		display: inline-block;
		padding: 4px 10px;
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-size: 15px;
		font-weight: 500;
	}

	@media (max-width: 699px) {
		.avatar {
			width: 48px;
			height: 48px;
		}
	}
</style>
