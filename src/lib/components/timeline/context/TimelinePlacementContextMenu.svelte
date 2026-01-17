<script lang="ts">
  import type { TimelinePlacement } from '$lib/types';
  import { objects, timeline, timelineEditor } from '$lib/stores';
  import * as ops from '$lib/services/timeline-operations';
  import ContextMenu from '$lib/editor/context/ContextMenu.svelte';
  import ContextMenuItem from '$lib/editor/context/ContextMenuItem.svelte';

  interface Props {
    open: boolean;
    x: number;
    y: number;
    placement: TimelinePlacement | null;
    onClose: () => void;
    onShowMutationDialog?: (placementId: string, objectId: string) => void;
    onShowSplitDialog?: (placementId: string) => void;
  }

  let {
    open,
    x,
    y,
    placement,
    onClose,
    onShowMutationDialog,
    onShowSplitDialog,
  }: Props = $props();

  // Derived state
  const obj = $derived(placement ? objects.get(placement.objectId) : null);
  const isLocked = $derived(placement ? timelineEditor.isPlacementLocked(placement.id) : false);
  const selectedCount = $derived(timelineEditor.selectedPlacementIds.size);

  // Delete confirmation state
  let showDeleteConfirm = $state(false);

  function handleClose() {
    showDeleteConfirm = false;
    onClose();
  }

  // Actions
  function handleRemoveFromTimeline() {
    if (!placement) return;
    ops.deletePlacement(placement.id);
    handleClose();
  }

  function handleDeleteObject() {
    if (!placement) return;
    showDeleteConfirm = true;
  }

  function handleConfirmDelete() {
    if (!placement) return;
    ops.deleteObject(placement.objectId);
    showDeleteConfirm = false;
    handleClose();
  }

  function handleCancelDelete() {
    showDeleteConfirm = false;
  }

  function handleAddMutation() {
    if (!placement) return;
    if (onShowMutationDialog) {
      onShowMutationDialog(placement.id, placement.objectId);
    }
    handleClose();
  }

  function handleToggleLock() {
    if (!placement) return;
    timelineEditor.togglePlacementLock(placement.id);
    handleClose();
  }

  function handleToggleRendered() {
    if (!placement || !obj) return;
    objects.update(obj.id, { rendered: !obj.rendered });
    handleClose();
  }

  function handleCopy() {
    timelineEditor.copySelected();
    handleClose();
  }
</script>

<ContextMenu {open} {x} {y} onClose={handleClose}>
  {#if placement && obj}
    <!-- Header -->
    <div class="menu-header">
      <span class="placement-name">{obj.name}</span>
      <span class="placement-type">{placement.type}</span>
    </div>

    <div class="menu-divider"></div>

    <!-- Edit actions -->
    {#if !showDeleteConfirm}
      <ContextMenuItem onclick={handleCopy}>
        {#snippet icon()}📄{/snippet}
        Copy
      </ContextMenuItem>

      <div class="menu-divider"></div>

      <!-- Object actions -->
      {#if placement.type === 'creation'}
        <ContextMenuItem onclick={handleAddMutation}>
          {#snippet icon()}~{/snippet}
          Add mutation here
        </ContextMenuItem>

        <ContextMenuItem onclick={handleToggleRendered}>
          {#snippet icon()}{obj.rendered ? '☐' : '☑'}{/snippet}
          {obj.rendered ? 'Mark as not rendered' : 'Mark as rendered'}
        </ContextMenuItem>
      {/if}

      <ContextMenuItem onclick={handleToggleLock}>
        {#snippet icon()}{isLocked ? '🔓' : '🔒'}{/snippet}
        {isLocked ? 'Unlock placement' : 'Lock placement'}
      </ContextMenuItem>

      <div class="menu-divider"></div>

      <!-- Delete actions -->
      <ContextMenuItem onclick={handleRemoveFromTimeline}>
        {#snippet icon()}⊝{/snippet}
        Remove from timeline
      </ContextMenuItem>

      <ContextMenuItem danger onclick={handleDeleteObject}>
        {#snippet icon()}🗑{/snippet}
        Delete object
      </ContextMenuItem>
    {:else}
      <!-- Delete confirmation -->
      <div class="confirm-panel">
        <div class="confirm-message">
          Delete "{obj.name}"?<br />
          <span class="confirm-warning">This cannot be undone.</span>
        </div>
        <div class="confirm-actions">
          <button class="confirm-btn cancel" onclick={handleCancelDelete}>
            Cancel
          </button>
          <button class="confirm-btn danger" onclick={handleConfirmDelete}>
            Delete
          </button>
        </div>
      </div>
    {/if}
  {/if}
</ContextMenu>

<style>
  .menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
  }

  .placement-name {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .placement-type {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle);
    margin: var(--space-xs) 0;
  }

  /* Delete confirmation */
  .confirm-panel {
    padding: var(--space-sm) var(--space-md);
  }

  .confirm-message {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    margin-bottom: var(--space-sm);
    text-align: center;
  }

  .confirm-warning {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .confirm-actions {
    display: flex;
    gap: var(--space-sm);
    justify-content: center;
  }

  .confirm-btn {
    padding: var(--space-xs) var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .confirm-btn.cancel {
    background-color: var(--surface-raised);
    color: var(--text-primary);
  }

  .confirm-btn.cancel:hover {
    background-color: var(--hover-bg);
  }

  .confirm-btn.danger {
    background-color: #ef4444;
    color: white;
  }

  .confirm-btn.danger:hover {
    background-color: #dc2626;
  }
</style>
