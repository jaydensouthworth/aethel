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
  const hasRange = $derived(placement?.endPosition !== undefined);
  const selectedCount = $derived(timelineEditor.selectedPlacementIds.size);
  const tracks = $derived(timeline.allTracks);

  // Track submenu state
  let showTrackSubmenu = $state(false);
  let showDeleteConfirm = $state(false);

  function handleClose() {
    showTrackSubmenu = false;
    showDeleteConfirm = false;
    onClose();
  }

  // Actions
  function handleDuplicate() {
    if (!placement) return;
    ops.duplicateSelectedPlacements();
    handleClose();
  }

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

  function handleMoveToTrack(trackIndex: number) {
    if (!placement) return;
    const deltaTrack = trackIndex - placement.track;
    ops.moveSelectedPlacements(0, deltaTrack);
    showTrackSubmenu = false;
    handleClose();
  }

  function handleSplit() {
    if (!placement) return;
    if (onShowSplitDialog) {
      onShowSplitDialog(placement.id);
    } else {
      // Default: split at cursor position
      const cursorPos = timeline.cursorPosition;
      if (cursorPos > placement.position &&
          (!hasRange || (placement.endPosition && cursorPos < placement.endPosition))) {
        ops.splitPlacement(placement.id, cursorPos);
      }
    }
    handleClose();
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

  function handleGroup() {
    timelineEditor.groupSelected();
    handleClose();
  }

  function handleUngroup() {
    timelineEditor.ungroupSelected();
    handleClose();
  }

  function handleSelectAll() {
    timelineEditor.selectAll();
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
      <ContextMenuItem onclick={handleDuplicate}>
        {#snippet icon()}📋{/snippet}
        Duplicate
        {#if selectedCount > 1}
          <span class="badge">{selectedCount}</span>
        {/if}
      </ContextMenuItem>

      <ContextMenuItem onclick={handleCopy}>
        {#snippet icon()}📄{/snippet}
        Copy
      </ContextMenuItem>

      {#if selectedCount > 1}
        <ContextMenuItem onclick={handleGroup}>
          {#snippet icon()}⊕{/snippet}
          Group selected
        </ContextMenuItem>
      {/if}

      {#if placement.groupId}
        <ContextMenuItem onclick={handleUngroup}>
          {#snippet icon()}⊖{/snippet}
          Ungroup
        </ContextMenuItem>
      {/if}

      <div class="menu-divider"></div>

      <!-- Move to track submenu -->
      <div class="submenu-container">
        <button
          class="submenu-trigger"
          onclick={() => showTrackSubmenu = !showTrackSubmenu}
        >
          <span class="item-icon">↕</span>
          <span class="item-label">Move to track</span>
          <span class="submenu-arrow">{showTrackSubmenu ? '▾' : '▸'}</span>
        </button>

        {#if showTrackSubmenu}
          <div class="submenu">
            {#each tracks as track, i}
              <button
                class="submenu-item"
                class:current={i === placement.track}
                onclick={() => handleMoveToTrack(i)}
                disabled={i === placement.track}
              >
                Track {i + 1}
                {#if track.name}
                  <span class="track-name">({track.name})</span>
                {/if}
                {#if i === placement.track}
                  <span class="current-indicator">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#if hasRange}
        <ContextMenuItem onclick={handleSplit}>
          {#snippet icon()}/{/snippet}
          Split...
        </ContextMenuItem>
      {/if}

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

  .badge {
    font-size: 0.7rem;
    background-color: var(--color-accent, #3b82f6);
    color: white;
    padding: 0.1em 0.4em;
    border-radius: 8px;
    margin-left: auto;
  }

  /* Submenu styles */
  .submenu-container {
    position: relative;
  }

  .submenu-trigger {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .submenu-trigger:hover {
    background-color: var(--hover-bg);
  }

  .item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-size: 14px;
  }

  .item-label {
    flex: 1;
  }

  .submenu-arrow {
    font-size: 10px;
    color: var(--text-muted);
  }

  .submenu {
    padding: var(--space-xs);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-sm);
    margin: var(--space-xs) var(--space-sm);
  }

  .submenu-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--font-size-xs);
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .submenu-item:hover:not(:disabled) {
    background-color: var(--hover-bg);
  }

  .submenu-item:disabled {
    color: var(--text-muted);
    cursor: default;
  }

  .submenu-item.current {
    font-weight: 500;
  }

  .track-name {
    color: var(--text-muted);
    margin-left: var(--space-xs);
  }

  .current-indicator {
    margin-left: auto;
    color: var(--color-accent, #3b82f6);
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
