<script lang="ts">
  import type { AutoDetectMatch } from '../extensions';

  interface Props {
    /** Whether the popup is visible */
    open: boolean;
    /** List of matches to display */
    matches: AutoDetectMatch[];
    /** Position of the popup */
    position: { x: number; y: number };
    /** Callback when a match is selected */
    onSelect: (match: AutoDetectMatch) => void;
    /** Callback to close the popup */
    onClose: () => void;
  }

  let {
    open,
    matches,
    position,
    onSelect,
    onClose,
  }: Props = $props();

  let selectedIndex = $state(0);

  // Reset selection when matches change
  $effect(() => {
    if (matches.length > 0) {
      selectedIndex = 0;
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % matches.length;
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + matches.length) % matches.length;
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (matches[selectedIndex]) {
          onSelect(matches[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }

  function handleSelect(match: AutoDetectMatch) {
    onSelect(match);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open && matches.length > 0}
  <div
    class="suggestion-popup"
    style:left="{position.x}px"
    style:top="{position.y}px"
  >
    <div class="suggestion-header">
      Link to object
      <span class="hint">Tab to accept</span>
    </div>
    <div class="suggestion-list">
      {#each matches as match, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          class="suggestion-item"
          class:selected={i === selectedIndex}
          onclick={() => handleSelect(match)}
          role="option"
          aria-selected={i === selectedIndex}
        >
          <span
            class="suggestion-chip"
            style:background-color="{match.color}20"
            style:color={match.color}
            style:border-color="{match.color}40"
          >
            {match.name}
          </span>
        </div>
      {/each}
    </div>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="suggestion-backdrop" onclick={onClose}></div>
{/if}

<style>
  .suggestion-popup {
    position: fixed;
    background-color: var(--surface-overlay, var(--surface-raised));
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-xs);
    min-width: 180px;
    max-width: 300px;
    max-height: 250px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.15));
  }

  .suggestion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.75rem;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: var(--space-xs);
  }

  .hint {
    font-size: 0.7rem;
    opacity: 0.7;
  }

  .suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .suggestion-item {
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .suggestion-item:hover,
  .suggestion-item.selected {
    background-color: var(--hover-bg, rgba(0, 0, 0, 0.05));
  }

  .suggestion-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.1em 0.5em;
    border-radius: 4px;
    border: 1px solid;
    font-size: 0.9em;
    font-weight: 500;
  }

  .suggestion-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
  }
</style>
