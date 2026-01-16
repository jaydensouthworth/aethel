<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Click handler */
    onclick?: () => void;
    /** Whether the button is in active state */
    active?: boolean;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Tooltip text */
    title?: string;
    /** Keyboard shortcut hint (displayed in tooltip) */
    shortcut?: string;
    /** Button content */
    children: Snippet;
    /** Additional class */
    class?: string;
  }

  let {
    onclick,
    active = false,
    disabled = false,
    title = '',
    shortcut = '',
    children,
    class: className = '',
  }: Props = $props();

  const fullTitle = $derived(
    shortcut ? `${title} (${shortcut})` : title
  );

  function handleClick() {
    if (!disabled && onclick) {
      onclick();
    }
  }
</script>

<button
  class="toolbar-btn {className}"
  class:active
  class:disabled
  {disabled}
  title={fullTitle}
  onclick={handleClick}
  type="button"
>
  {@render children()}
</button>

<style>
  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 var(--space-sm);
    border: none;
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .toolbar-btn:hover:not(.disabled) {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }

  .toolbar-btn:focus-visible {
    outline: 2px solid var(--focus-ring, #3b82f6);
    outline-offset: -2px;
  }

  .toolbar-btn.active {
    background-color: var(--selected-bg);
    color: var(--text-primary);
  }

  .toolbar-btn.disabled {
    color: var(--text-muted);
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
