<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Whether the dropdown is open */
    open?: boolean;
    /** Callback when open state changes */
    onOpenChange?: (open: boolean) => void;
    /** Trigger button content */
    trigger: Snippet;
    /** Dropdown content */
    children: Snippet;
    /** Alignment of dropdown relative to trigger */
    align?: 'left' | 'right' | 'center';
    /** Additional class for dropdown panel */
    class?: string;
  }

  let {
    open = $bindable(false),
    onOpenChange,
    trigger,
    children,
    align = 'left',
    class: className = '',
  }: Props = $props();

  function toggle() {
    open = !open;
    onOpenChange?.(open);
  }

  function close() {
    if (open) {
      open = false;
      onOpenChange?.(false);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dropdown">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dropdown-trigger" onclick={toggle}>
    {@render trigger()}
  </div>

  {#if open}
    <div class="dropdown-panel {className}" class:align-left={align === 'left'} class:align-right={align === 'right'} class:align-center={align === 'center'}>
      {@render children()}
    </div>
  {/if}
</div>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dropdown-backdrop" onclick={close}></div>
{/if}

<style>
  .dropdown {
    position: relative;
    display: inline-block;
  }

  .dropdown-trigger {
    cursor: pointer;
  }

  .dropdown-panel {
    position: absolute;
    top: calc(100% + 4px);
    background-color: var(--surface-overlay, var(--surface-raised));
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-xs);
    min-width: 120px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.15));
  }

  .dropdown-panel.align-left {
    left: 0;
  }

  .dropdown-panel.align-right {
    right: 0;
  }

  .dropdown-panel.align-center {
    left: 50%;
    transform: translateX(-50%);
  }

  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }
</style>
