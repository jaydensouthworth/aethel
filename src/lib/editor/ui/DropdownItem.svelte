<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Click handler */
    onclick?: () => void;
    /** Whether this item is currently selected/active */
    selected?: boolean;
    /** Whether this item is disabled */
    disabled?: boolean;
    /** Item content */
    children: Snippet;
    /** Additional class */
    class?: string;
  }

  let {
    onclick,
    selected = false,
    disabled = false,
    children,
    class: className = '',
  }: Props = $props();

  function handleClick() {
    if (!disabled && onclick) {
      onclick();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="dropdown-item {className}"
  class:selected
  class:disabled
  {disabled}
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="menuitem"
  tabindex={disabled ? -1 : 0}
>
  {@render children()}
  {#if selected}
    <span class="check-icon">✓</span>
  {/if}
</button>

<style>
  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .dropdown-item:hover:not(.disabled) {
    background-color: var(--hover-bg);
  }

  .dropdown-item:focus-visible {
    outline: 2px solid var(--focus-ring, #3b82f6);
    outline-offset: -2px;
  }

  .dropdown-item.selected {
    background-color: var(--selected-bg);
    font-weight: 500;
  }

  .dropdown-item.disabled {
    color: var(--text-muted);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .check-icon {
    color: var(--accent-color, #3b82f6);
    font-size: var(--font-size-xs);
    margin-left: var(--space-sm);
  }
</style>
