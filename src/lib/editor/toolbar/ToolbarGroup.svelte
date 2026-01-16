<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Whether to show a divider after this group */
    divider?: boolean;
    /** Group content (buttons) */
    children: Snippet;
    /** Additional class */
    class?: string;
  }

  let {
    divider = true,
    children,
    class: className = '',
  }: Props = $props();
</script>

<div class="toolbar-group {className}">
  {@render children()}
</div>

{#if divider}
  <div class="toolbar-divider"></div>
{/if}

<style>
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background-color: var(--border-subtle);
    margin: 0 var(--space-xs);
  }
</style>
