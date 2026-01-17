<script lang="ts">
  import { OBJECT_TYPES, getObjectType } from '$lib/types';
  import { createNewObject } from '$lib/services/timeline-operations';

  interface Props {
    open: boolean;
    timeslotIndex: number;
    onClose: () => void;
  }

  let { open, timeslotIndex, onClose }: Props = $props();

  let name = $state('');
  let selectedTypeId = $state('chapter');

  // Available types (exclude folder)
  const availableTypes = Object.values(OBJECT_TYPES).filter(t => t.id !== 'folder' && t.isContentType);
  const selectedType = $derived(getObjectType(selectedTypeId));

  $effect(() => {
    if (open) {
      name = '';
      selectedTypeId = 'chapter';
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;

    // Create the object with rendered: true so it appears on timeline
    createNewObject(name.trim(), selectedTypeId, null, {
      rendered: true,
    });

    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true">
      <h2 class="title">Create New Object</h2>
      <p class="subtitle">Will appear at slot {timeslotIndex + 1}</p>

      <form onsubmit={handleSubmit}>
        <div class="field">
          <label for="obj-name">Name</label>
          <input
            id="obj-name"
            type="text"
            bind:value={name}
            placeholder="Enter object name..."
            required
          />
        </div>

        <div class="field">
          <label>Type</label>
          <div class="type-grid">
            {#each availableTypes as type (type.id)}
              <button
                type="button"
                class="type-option"
                class:selected={selectedTypeId === type.id}
                style:--type-color={type.color}
                onclick={() => selectedTypeId = type.id}
              >
                <span class="type-icon">{type.icon}</span>
                <span class="type-name">{type.name}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="preview">
          <div class="preview-label">Preview</div>
          <div class="preview-card" style:--pc={selectedType.color}>
            <span class="preview-icon">{selectedType.icon}</span>
            <span class="preview-name">{name || 'New Object'}</span>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn cancel" onclick={onClose}>Cancel</button>
          <button
            type="submit"
            class="btn confirm"
            disabled={!name.trim()}
            style:--btn-color={selectedType.color}
          >
            Create & Add
          </button>
        </div>
      </form>
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
    min-width: 380px;
    max-width: 440px;
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

  .field {
    margin-bottom: 14px;
  }

  .field label {
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .field input {
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    border: 1px solid var(--border-default);
    border-radius: 6px;
    background: var(--surface-base);
    color: var(--text-primary);
    font-family: inherit;
  }

  .field input:focus {
    outline: none;
    border-color: var(--accent-primary, #3b82f6);
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .type-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 8px;
    background: var(--surface-base);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.12s;
  }

  .type-option:hover {
    border-color: var(--border-default);
    background: var(--hover-bg);
  }

  .type-option.selected {
    border-color: var(--type-color);
    background: color-mix(in srgb, var(--type-color) 10%, var(--surface-base));
  }

  .type-icon {
    font-size: 18px;
  }

  .type-name {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .type-option.selected .type-name {
    color: var(--type-color);
  }

  .preview {
    padding: 12px;
    background: var(--surface-sunken, var(--surface-base));
    border-radius: 6px;
    margin-bottom: 16px;
  }

  .preview-label {
    font-size: 10px;
    color: var(--text-tertiary);
    margin-bottom: 8px;
  }

  .preview-card {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface-raised);
    border: 1px solid var(--pc);
    border-radius: 6px;
  }

  .preview-icon {
    font-size: 16px;
  }

  .preview-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 4px;
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

  .btn.confirm {
    background: var(--btn-color, var(--accent-primary, #3b82f6));
    border: 1px solid var(--btn-color, var(--accent-primary, #3b82f6));
    color: #fff;
  }

  .btn.confirm:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn.confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
