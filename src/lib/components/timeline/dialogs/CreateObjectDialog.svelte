<script lang="ts">
  import { OBJECT_TYPES, getObjectType, createObject } from '$lib/types';
  import type { ObjectType } from '$lib/types';
  import { objects, ui } from '$lib/stores';
  import * as ops from '$lib/services/timeline-operations';

  interface Props {
    open: boolean;
    /** Track to place the new object on */
    track?: number;
    /** Position to place the new object at */
    position?: number;
    /** Parent ID for hierarchical placement */
    parentId?: string | null;
    /** Callback when dialog closes */
    onClose: () => void;
    /** Callback when object is created */
    onCreated?: (objectId: string) => void;
  }

  let {
    open,
    track = 0,
    position = 0,
    parentId = null,
    onClose,
    onCreated,
  }: Props = $props();

  // Form state
  let name = $state('');
  let selectedTypeId = $state('note');
  let addToTimeline = $state(true);
  let markAsRendered = $state(true);

  // Available types (exclude folder for timeline creation)
  const availableTypes = Object.values(OBJECT_TYPES).filter(t => t.id !== 'folder');
  const selectedType = $derived(getObjectType(selectedTypeId));

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;

    let objectId: string;

    if (addToTimeline) {
      // Create object with timeline placement
      const result = ops.createObjectWithPlacement(
        name.trim(),
        selectedTypeId,
        position,
        track,
        {
          parentId,
          rendered: markAsRendered,
        }
      );
      objectId = result.object.id;
    } else {
      // Create object without timeline placement
      const obj = createObject(name.trim(), selectedTypeId, parentId);
      obj.rendered = markAsRendered;
      objects.add(obj);
      ui.select(obj.id);
      objectId = obj.id;
    }

    onCreated?.(objectId);
    resetForm();
    onClose();
  }

  function handleCancel() {
    resetForm();
    onClose();
  }

  function resetForm() {
    name = '';
    selectedTypeId = 'note';
    addToTimeline = true;
    markAsRendered = true;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title" class="dialog-title">Create New Object</h2>

      <form onsubmit={handleSubmit}>
        <!-- Name input -->
        <div class="form-group">
          <label for="object-name" class="form-label">Name</label>
          <input
            id="object-name"
            type="text"
            class="form-input"
            bind:value={name}
            placeholder="Enter object name..."
            required
          />
        </div>

        <!-- Type selection -->
        <div class="form-group">
          <label class="form-label">Type</label>
          <div class="type-grid">
            {#each availableTypes as type}
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

        <!-- Options -->
        <div class="form-group options-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={addToTimeline} />
            <span>Add to timeline at position {position}</span>
          </label>

          {#if addToTimeline}
            <label class="checkbox-label nested">
              <input type="checkbox" bind:checked={markAsRendered} />
              <span>Mark as rendered in book</span>
            </label>
          {/if}
        </div>

        <!-- Actions -->
        <div class="dialog-actions">
          <button type="button" class="btn cancel" onclick={handleCancel}>
            Cancel
          </button>
          <button
            type="submit"
            class="btn confirm"
            disabled={!name.trim()}
            style:--btn-color={selectedType.color}
          >
            <span class="btn-icon">{selectedType.icon}</span>
            Create {selectedType.name}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .dialog {
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .dialog-title {
    margin: 0 0 var(--space-lg) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .form-group {
    margin-bottom: var(--space-md);
  }

  .form-label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-base);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background-color: var(--surface-base);
    color: var(--text-primary);
    transition: border-color var(--transition-fast);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--color-accent, #3b82f6);
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: var(--space-xs);
  }

  .type-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm);
    border: 2px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .type-option:hover {
    border-color: var(--type-color);
    background-color: color-mix(in srgb, var(--type-color) 10%, transparent);
  }

  .type-option.selected {
    border-color: var(--type-color);
    background-color: color-mix(in srgb, var(--type-color) 15%, transparent);
  }

  .type-icon {
    font-size: var(--font-size-xl);
  }

  .type-name {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .type-option.selected .type-name {
    color: var(--text-primary);
    font-weight: 500;
  }

  .options-group {
    padding: var(--space-md);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-md);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    cursor: pointer;
  }

  .checkbox-label.nested {
    margin-top: var(--space-sm);
    margin-left: var(--space-md);
    color: var(--text-secondary);
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .dialog-actions {
    display: flex;
    gap: var(--space-sm);
    justify-content: flex-end;
    margin-top: var(--space-lg);
  }

  .btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn.cancel {
    background-color: transparent;
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  .btn.cancel:hover {
    background-color: var(--hover-bg);
  }

  .btn.confirm {
    background-color: var(--btn-color, var(--color-accent, #3b82f6));
    border: 1px solid var(--btn-color, var(--color-accent, #3b82f6));
    color: white;
  }

  .btn.confirm:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn.confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-icon {
    font-size: var(--font-size-base);
  }
</style>
