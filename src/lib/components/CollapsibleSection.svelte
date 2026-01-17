<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		defaultOpen?: boolean;
		badge?: string | number;
		children: Snippet;
	}

	let { title, defaultOpen = true, badge, children }: Props = $props();
	let isOpen = $state(defaultOpen);
</script>

<section class="collapsible-section">
	<button
		class="section-header"
		onclick={() => (isOpen = !isOpen)}
		aria-expanded={isOpen}
	>
		<span class="chevron" class:open={isOpen}>▶</span>
		<span class="title">{title}</span>
		{#if badge !== undefined}
			<span class="badge">{badge}</span>
		{/if}
	</button>
	{#if isOpen}
		<div class="section-content">
			{@render children()}
		</div>
	{/if}
</section>

<style>
	.collapsible-section {
		border-bottom: 1px solid var(--border-subtle);
	}

	.collapsible-section:last-child {
		border-bottom: none;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) 0;
		background: transparent;
		border: none;
		cursor: pointer;
		width: 100%;
		font-weight: 600;
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		text-align: left;
		transition: color var(--transition-fast);
	}

	.section-header:hover {
		color: var(--text-primary);
	}

	.section-header:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.chevron {
		font-size: 10px;
		transition: transform var(--transition-fast);
		flex-shrink: 0;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.title {
		flex: 1;
	}

	.badge {
		padding: 2px 6px;
		font-size: var(--font-size-xs);
		font-weight: 500;
		color: var(--text-muted);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}

	.section-content {
		padding: 0 0 var(--space-md);
		animation: slideDown 150ms ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
