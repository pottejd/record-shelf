<script lang="ts">
	let { profile, badges }: {
		profile: { username: string; avatar_url?: string; location?: string };
		badges: Array<{ label: string; style: string }>;
	} = $props();
</script>

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
</header>

<style>
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

	@media (max-width: 600px) {
		h1 {
			font-size: 1.5rem;
		}
	}
</style>
