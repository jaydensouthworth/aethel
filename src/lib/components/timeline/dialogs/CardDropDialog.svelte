<script lang="ts">
  import { objects } from '$lib/stores';

  interface Props {
    open: boolean;
    draggedCardId: string | null;
    targetCardId: string | null;
    onSwap: () => void;
    onStack: () => void;
    onClose: () => void;
  }

  let { open, draggedCardId, targetCardId, onSwap, onStack, onClose }: Props = $props();

  const draggedObject = $derived(draggedCardId ? objects.get(draggedCardId) : null);
  const targetObject = $derived(targetCardId ? objects.get(targetCardId) : null);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open && draggedObject && targetObject}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true">
      <h2 class="title">Move Card</h2>
      <p class="subtitle">
        <span class="object-name">{draggedObject.name}</span>
        <span class="object-info"> onto {targetObject.name}</span>
      </p>

      <div class="options">
        <button class="option-btn" onclick={onSwap}>
          <span class="option-icon">⇄</span>
          <div class="option-text">
            <span class="option-title">Swap positions</span>
            <span class="option-desc">Exchange timeline positions between the two cards</span>
          </div>
        </button>

        <button class="option-btn" onclick={onStack}>
          <span class="option-icon">▤</span>
          <div class="option-text">
            <span class="option-title">Stack in same slot</span>
            <span class="option-desc">Group as simultaneous events in the same time slot</span>
          </div>
        </button>
      </div>

      <div class="actions">
        <button class="btn cancel" onclick={onClose}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .dialog {
    background: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: 10px;
    padding: 20px;
    min-width: 320px;
    max-width: 380px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }

  .title {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0 0 16px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .object-name {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .object-info {
    color: var(--text-tertiary);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .option-btn {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--surface-base);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s;
  }

  .option-btn:hover {
    border-color: var(--accent-primary, #3b82f6);
    background: color-mix(in srgb, var(--accent-primary, #3b82f6) 6%, var(--surface-base));
  }

  .option-icon {
    font-size: 16px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .option-desc {
    font-size: 11px;
    color: var(--text-tertiary);
    line-height: 1.4;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn {
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.12s;
  }

  .btn.cancel {
    background: transparent;
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  .btn.cancel:hover {
    background: var(--hover-bg);
  }
</style>
