<script lang="ts">
  import { objects } from '$lib/stores';
  import { getObjectType } from '$lib/types';
  import { addObjectAsCard } from '$lib/services/timeline-operations';

  interface Props {
    open: boolean;
    timeslotIndex: number;
    onClose: () => void;
  }

  let { open, timeslotIndex, onClose }: Props = $props();

  let searchQuery = $state('');
  let selectedObjectId = $state<string | null>(null);

  // Get objects that can be added (not already rendered, content types, not folders)
  const availableObjects = $derived(
    objects.all.filter(obj => {
      const objType = getObjectType(obj.typeId);
      return objType.isContentType &&
             obj.typeId !== 'folder' &&
             !obj.rendered;
    })
  );

  const filteredObjects = $derived(
    searchQuery.trim()
      ? availableObjects.filter(obj =>
          obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          obj.aliases.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : availableObjects
  );

  const selectedObject = $derived(selectedObjectId ? objects.get(selectedObjectId) : null);

  $effect(() => {
    if (open) {
      searchQuery = '';
      selectedObjectId = null;
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!selectedObjectId) return;

    addObjectAsCard(selectedObjectId);
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function selectObject(id: string) {
    selectedObjectId = id;
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true">
      <h2 class="title">Add Existing Object</h2>
      <p class="subtitle">Insert at slot {timeslotIndex + 1}</p>

      <form onsubmit={handleSubmit}>
        <div class="field">
          <label>Search Objects</label>
          <input
            type="text"
            class="search-input"
            bind:value={searchQuery}
            placeholder="Search by name or alias..."
          />

          <div class="object-list">
            {#if availableObjects.length === 0}
              <div class="no-results">All objects are already on the timeline</div>
            {:else if filteredObjects.length === 0}
              <div class="no-results">No matching objects found</div>
            {:else}
              {#each filteredObjects.slice(0, 10) as obj (obj.id)}
                {@const objType = getObjectType(obj.typeId)}
                {@const color = objects.getEffectiveColor(obj.id)}
                {@const icon = objects.getEffectiveIcon(obj.id)}
                <button
                  type="button"
                  class="object-item"
                  class:selected={selectedObjectId === obj.id}
                  onclick={() => selectObject(obj.id)}
                >
                  <span class="obj-icon" style:color>{icon}</span>
                  <span class="obj-name">{obj.name}</span>
                  <span class="obj-type">{objType.name}</span>
                </button>
              {/each}
              {#if filteredObjects.length > 10}
                <div class="more-hint">+{filteredObjects.length - 10} more...</div>
              {/if}
            {/if}
          </div>
        </div>

        {#if selectedObject}
          <div class="selected-preview">
            <span class="preview-icon" style:color={objects.getEffectiveColor(selectedObject.id)}>
              {objects.getEffectiveIcon(selectedObject.id)}
            </span>
            <span class="preview-name">{selectedObject.name}</span>
            <button type="button" class="clear-btn" onclick={() => selectedObjectId = null}>×</button>
          </div>
        {/if}

        <div class="actions">
          <button type="button" class="btn cancel" onclick={onClose}>Cancel</button>
          <button
            type="submit"
            class="btn confirm"
            disabled={!selectedObjectId}
          >
            Add to Timeline
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

  .search-input {
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    border: 1px solid var(--border-default);
    border-radius: 6px;
    background: var(--surface-base);
    color: var(--text-primary);
    font-family: inherit;
    margin-bottom: 8px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-primary, #3b82f6);
  }

  .object-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--surface-base);
  }

  .object-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 0.1s;
  }

  .object-item:last-child {
    border-bottom: none;
  }

  .object-item:hover {
    background: var(--hover-bg);
  }

  .object-item.selected {
    background: color-mix(in srgb, var(--accent-primary, #3b82f6) 15%, var(--surface-base));
  }

  .obj-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .obj-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .obj-type {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .no-results {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .more-hint {
    padding: 8px;
    text-align: center;
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .selected-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--accent-primary, #3b82f6) 10%, var(--surface-base));
    border: 1px solid var(--accent-primary, #3b82f6);
    border-radius: 6px;
    margin-bottom: 14px;
  }

  .preview-icon {
    font-size: 16px;
  }

  .preview-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
  }

  .clear-btn {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
  }

  .clear-btn:hover {
    background: var(--error-bg);
    color: var(--error-text);
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
    background: var(--accent-primary, #3b82f6);
    border: 1px solid var(--accent-primary, #3b82f6);
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
