<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Whether the menu is visible */
    open: boolean;
    /** X position (clientX) */
    x: number;
    /** Y position (clientY) */
    y: number;
    /** Callback to close the menu */
    onClose: () => void;
    /** Menu content */
    children: Snippet;
  }

  let { open, x, y, onClose, children }: Props = $props();

  // Adjust position to stay within viewport
  const adjustedPosition = $derived(() => {
    if (!open) return { x: 0, y: 0 };

    const menuWidth = 200; // Approximate menu width
    const menuHeight = 150; // Approximate menu height
    const padding = 8;

    let adjustedX = x;
    let adjustedY = y;

    // Check right edge
    if (x + menuWidth > window.innerWidth - padding) {
      adjustedX = window.innerWidth - menuWidth - padding;
    }

    // Check bottom edge
    if (y + menuHeight > window.innerHeight - padding) {
      adjustedY = window.innerHeight - menuHeight - padding;
    }

    return { x: adjustedX, y: adjustedY };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onClose();
    }
  }

  function handleBackdropClick() {
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="context-backdrop"
    onclick={handleBackdropClick}
    oncontextmenu={(e) => e.preventDefault()}
  ></div>

  <div
    class="context-menu"
    style:left="{adjustedPosition().x}px"
    style:top="{adjustedPosition().y}px"
    role="menu"
  >
    {@render children()}
  </div>
{/if}

<style>
  .context-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
  }

  .context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 180px;
    padding: var(--space-xs);
    background-color: var(--surface-overlay, var(--surface-raised));
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.2));
    animation: contextMenuIn 0.1s ease-out;
  }

  @keyframes contextMenuIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
