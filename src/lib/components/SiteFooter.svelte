<script lang="ts">
	// Shared page footer (standard bordered variant) for the profile and
	// comparison pages. The home and settings pages use their own footers.
</script>

<footer class="footer">
	<p>&copy; {new Date().getFullYear()} Record Shelf. Not affiliated with Discogs.</p>
</footer>

<style>
	.footer {
		margin-top: 2rem;
		padding: 2rem 0;
		border-top: 1px solid var(--color-border);
	}

	.footer p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		text-align: center;
	}
</style>
