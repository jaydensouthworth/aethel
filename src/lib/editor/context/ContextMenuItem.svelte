<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Click handler */
    onclick?: () => void;
    /** Whether this item is destructive */
    danger?: boolean;
    /** Item content */
    children: Snippet;
    /** Optional icon slot */
    icon?: Snippet;
  }

  let { onclick, danger = false, children, icon }: Props = $props();

  function handleClick() {
    onclick?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="context-item"
  class:danger
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="menuitem"
  tabindex="0"
>
  {#if icon}
    <span class="item-icon">
      {@render icon()}
    </span>
  {/if}
  <span class="item-label">
    {@render children()}
  </span>
</button>

<style>
  .context-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .context-item:hover {
    background-color: var(--hover-bg);
  }

  .context-item:focus-visible {
    outline: 2px solid var(--focus-ring, #3b82f6);
    outline-offset: -2px;
  }

  .context-item.danger {
    color: #ef4444;
  }

  .context-item.danger:hover {
    background-color: #ef444410;
  }

  .item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-size: 14px;
  }

  .item-label {
    flex: 1;
  }
</style>
