<script lang="ts">
  import { OBJECT_TYPES, type ObjectType } from '$lib/types';

  interface Props {
    onSelect: (typeId: string) => void;
    onClose: () => void;
  }

  let { onSelect, onClose }: Props = $props();

  const types = Object.values(OBJECT_TYPES);

  function handleSelect(typeId: string) {
    onSelect(typeId);
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="picker-backdrop" onclick={handleBackdropClick}>
  <div class="picker-menu">
    <div class="picker-header">Create new...</div>
    <div class="picker-options">
      {#each types as type (type.id)}
        <button
          class="picker-option"
          onclick={() => handleSelect(type.id)}
        >
          <span class="option-dot" style:background-color={type.color}></span>
          <span class="option-name">{type.name}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
  }

  .picker-menu {
    position: absolute;
    top: 48px;
    left: var(--picker-left, 16px);
    min-width: 180px;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .picker-header {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-subtle);
  }

  .picker-options {
    padding: var(--space-xs) 0;
  }

  .picker-option {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .picker-option:hover {
    background-color: var(--hover-bg);
  }

  .option-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .option-name {
    flex: 1;
    text-align: left;
  }
</style>
