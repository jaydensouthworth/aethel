<script lang="ts">
  import { timeline, objects } from '$lib/stores';

  interface Props {
    open: boolean;
    mutationId: string | null;
    targetPosition: { type: 'between' | 'below'; afterRenderedIndex?: number; attachedToObjectId?: string } | null;
    onMove: () => void;
    onDuplicate: () => void;
    onNewMutation: () => void;
    onClose: () => void;
  }

  let { open, mutationId, targetPosition, onMove, onDuplicate, onNewMutation, onClose }: Props = $props();

  const mutation = $derived(mutationId ? timeline.getPlacement(mutationId) : null);
  const mutationObject = $derived(mutation ? objects.get(mutation.objectId) : null);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open && mutation}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true">
      <h2 class="title">Move Mutation</h2>
      <p class="subtitle">
        {#if mutationObject}
          <span class="object-name">{mutation.mutation?.label ?? 'Mutation'}</span>
          <span class="object-info">({mutationObject.name})</span>
        {:else}
          Mutation
        {/if}
      </p>

      <div class="options">
        <button class="option-btn" onclick={onMove}>
          <span class="option-icon">↪</span>
          <div class="option-text">
            <span class="option-title">Move here</span>
            <span class="option-desc">Move this mutation to the new position</span>
          </div>
        </button>

        <button class="option-btn" onclick={onDuplicate}>
          <span class="option-icon">⧉</span>
          <div class="option-text">
            <span class="option-title">Duplicate</span>
            <span class="option-desc">Copy the exact same mutation diff to this point</span>
          </div>
        </button>

        <button class="option-btn" onclick={onNewMutation}>
          <span class="option-icon">+</span>
          <div class="option-text">
            <span class="option-title">Create new mutation</span>
            <span class="option-desc">Open dialog to create a new mutation at this location</span>
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
