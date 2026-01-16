<script lang="ts">
  import type { AethelObject } from '$lib/types';
  import { getObjectType, OBJECT_TYPES } from '$lib/types';
  import { objects, timeline, ui, timelineEditor } from '$lib/stores';
  import * as ops from '$lib/services/timeline-operations';
  import ContextMenu from '$lib/editor/context/ContextMenu.svelte';
  import ContextMenuItem from '$lib/editor/context/ContextMenuItem.svelte';

  interface Props {
    open: boolean;
    x: number;
    y: number;
    object: AethelObject | null;
    onClose: () => void;
    onShowCreateDialog?: (parentId: string | null, position?: number, track?: number) => void;
  }

  let {
    open,
    x,
    y,
    object: obj,
    onClose,
    onShowCreateDialog,
  }: Props = $props();

  // Derived state
  const objectType = $derived(obj ? getObjectType(obj.typeId) : null);
  const children = $derived(obj ? objects.getChildren(obj.id) : []);
  const hasChildren = $derived(children.length > 0);
  const isFolder = $derived(obj?.typeId === 'folder');
  const placements = $derived(obj ? timeline.getPlacementsForObject(obj.id) : []);
  const hasPlacement = $derived(placements.length > 0);
  const cursorPosition = $derived(timeline.cursorPosition);

  // Track submenu state
  let showAddToTrackSubmenu = $state(false);
  let showDeleteConfirm = $state(false);

  // Infer the default type for new items based on folder's color
  const inferredType = $derived.by(() => {
    if (!obj || !isFolder) return OBJECT_TYPES.note;

    const folderColor = objects.getEffectiveColor(obj.id);
    for (const [typeId, type] of Object.entries(OBJECT_TYPES)) {
      if (typeId !== 'folder' && type.color === folderColor) {
        return type;
      }
    }

    // Check children's most common type
    const childTypes = children.map(c => c.typeId).filter(t => t !== 'folder');
    if (childTypes.length > 0) {
      const counts = childTypes.reduce((acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      return OBJECT_TYPES[mostCommon];
    }

    return OBJECT_TYPES.note;
  });

  function handleClose() {
    showAddToTrackSubmenu = false;
    showDeleteConfirm = false;
    onClose();
  }

  // Actions
  function handleSelectInTree() {
    if (!obj) return;
    ui.select(obj.id);
    handleClose();
  }

  function handleExpandAll() {
    if (!obj) return;
    ui.setTreeExpanded(obj.id, true);
    const expandChildren = (id: string) => {
      const children = objects.getChildren(id);
      children.forEach(child => {
        ui.setTreeExpanded(child.id, true);
        expandChildren(child.id);
      });
    };
    expandChildren(obj.id);
    handleClose();
  }

  function handleCollapseAll() {
    if (!obj) return;
    ui.setTreeExpanded(obj.id, false);
    const collapseChildren = (id: string) => {
      const children = objects.getChildren(id);
      children.forEach(child => {
        ui.setTreeExpanded(child.id, false);
        collapseChildren(child.id);
      });
    };
    collapseChildren(obj.id);
    handleClose();
  }

  function handleAddToTimeline(track: number = 0) {
    if (!obj) return;
    ops.addObjectToTimeline(obj.id, cursorPosition, track);
    showAddToTrackSubmenu = false;
    handleClose();
  }

  function handleJumpToPlacement() {
    if (!obj || placements.length === 0) return;
    // Jump to first placement
    const firstPlacement = placements.sort((a, b) => a.position - b.position)[0];
    timeline.setCursorPosition(firstPlacement.position);
    timelineEditor.clearSelection();
    timelineEditor.select(firstPlacement.id);
    handleClose();
  }

  function handleHighlightPlacements() {
    if (!obj) return;
    timelineEditor.highlightPlacements(obj.id);
    handleClose();
  }

  function handleRemoveFromTimeline() {
    if (!obj) return;
    placements.forEach(p => {
      ops.deletePlacement(p.id);
    });
    handleClose();
  }

  function handleToggleRendered() {
    if (!obj) return;
    objects.update(obj.id, { rendered: !obj.rendered });
    handleClose();
  }

  function handleCreateChild() {
    if (!obj || !isFolder) return;
    if (onShowCreateDialog) {
      onShowCreateDialog(obj.id);
    } else {
      // Fallback to prompt
      const name = prompt(`Enter name for new ${inferredType.name}:`);
      if (name?.trim()) {
        objects.create(name.trim(), inferredType.id, obj.id);
        ui.setTreeExpanded(obj.id, true);
      }
    }
    handleClose();
  }

  function handleCreateFolder() {
    if (!obj || !isFolder) return;
    const name = prompt('Enter name for new folder:');
    if (name?.trim()) {
      const newObj = objects.create(name.trim(), 'folder', obj.id);
      ui.setTreeExpanded(obj.id, true);
      ui.select(newObj.id);
    }
    handleClose();
  }

  function handleDuplicate() {
    if (!obj) return;
    const newObj = objects.duplicate(obj.id);
    if (newObj) {
      ui.select(newObj.id);
    }
    handleClose();
  }

  function handleMoveUp() {
    if (!obj) return;
    const parent = obj.parentId ? objects.get(obj.parentId) : null;
    const siblings = parent ? objects.getChildren(parent.id) : objects.getChildren(null);
    const index = siblings.findIndex(s => s.id === obj.id);
    if (index > 0) {
      objects.reorder(obj.id, index - 1);
    }
    handleClose();
  }

  function handleMoveDown() {
    if (!obj) return;
    const parent = obj.parentId ? objects.get(obj.parentId) : null;
    const siblings = parent ? objects.getChildren(parent.id) : objects.getChildren(null);
    const index = siblings.findIndex(s => s.id === obj.id);
    if (index < siblings.length - 1) {
      objects.reorder(obj.id, index + 1);
    }
    handleClose();
  }

  function handleDelete() {
    if (!obj) return;
    showDeleteConfirm = true;
  }

  function handleConfirmDelete() {
    if (!obj) return;
    if (ui.selectedObjectId === obj.id) {
      ui.select(null);
    }
    ops.deleteObject(obj.id);
    showDeleteConfirm = false;
    handleClose();
  }

  function handleCancelDelete() {
    showDeleteConfirm = false;
  }
</script>

<ContextMenu {open} {x} {y} onClose={handleClose}>
  {#if obj && objectType}
    <!-- Header -->
    <div class="menu-header">
      <span class="object-icon" style:color={objectType.color}>{objectType.icon}</span>
      <span class="object-name">{obj.name}</span>
      <span class="object-type">{objectType.name}</span>
    </div>

    <div class="menu-divider"></div>

    {#if !showDeleteConfirm}
      <!-- Navigation -->
      <ContextMenuItem onclick={handleSelectInTree}>
        {#snippet icon()}↖{/snippet}
        Select in tree
      </ContextMenuItem>

      {#if hasChildren}
        <ContextMenuItem onclick={handleExpandAll}>
          {#snippet icon()}⊞{/snippet}
          Expand all
        </ContextMenuItem>

        <ContextMenuItem onclick={handleCollapseAll}>
          {#snippet icon()}⊟{/snippet}
          Collapse all
        </ContextMenuItem>
      {/if}

      <div class="menu-divider"></div>

      <!-- Timeline actions -->
      {#if hasPlacement}
        <ContextMenuItem onclick={handleJumpToPlacement}>
          {#snippet icon()}▶{/snippet}
          Jump to placement
          {#if placements.length > 1}
            <span class="badge">{placements.length}</span>
          {/if}
        </ContextMenuItem>

        <ContextMenuItem onclick={handleHighlightPlacements}>
          {#snippet icon()}✦{/snippet}
          Highlight on timeline
        </ContextMenuItem>

        <ContextMenuItem onclick={handleRemoveFromTimeline}>
          {#snippet icon()}⊝{/snippet}
          Remove from timeline
        </ContextMenuItem>
      {:else if !isFolder}
        <!-- Add to track submenu -->
        <div class="submenu-container">
          <button
            class="submenu-trigger"
            onclick={() => showAddToTrackSubmenu = !showAddToTrackSubmenu}
          >
            <span class="item-icon">+</span>
            <span class="item-label">Add to timeline</span>
            <span class="submenu-arrow">{showAddToTrackSubmenu ? '▾' : '▸'}</span>
          </button>

          {#if showAddToTrackSubmenu}
            <div class="submenu">
              {#each timeline.allTracks as track, i}
                <button
                  class="submenu-item"
                  onclick={() => handleAddToTimeline(i)}
                >
                  Track {i + 1}
                  {#if track.name}
                    <span class="track-name">({track.name})</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if !isFolder}
        <ContextMenuItem onclick={handleToggleRendered}>
          {#snippet icon()}{obj.rendered ? '☐' : '☑'}{/snippet}
          {obj.rendered ? 'Mark as not rendered' : 'Mark as rendered'}
        </ContextMenuItem>
      {/if}

      <div class="menu-divider"></div>

      <!-- Structure actions -->
      {#if isFolder}
        <ContextMenuItem onclick={handleCreateChild}>
          {#snippet icon()}{inferredType.icon}{/snippet}
          New {inferredType.name}
        </ContextMenuItem>

        <ContextMenuItem onclick={handleCreateFolder}>
          {#snippet icon()}📁{/snippet}
          New folder
        </ContextMenuItem>

        <div class="menu-divider"></div>
      {/if}

      <ContextMenuItem onclick={handleDuplicate}>
        {#snippet icon()}📋{/snippet}
        Duplicate
      </ContextMenuItem>

      <ContextMenuItem onclick={handleMoveUp}>
        {#snippet icon()}↑{/snippet}
        Move up
      </ContextMenuItem>

      <ContextMenuItem onclick={handleMoveDown}>
        {#snippet icon()}↓{/snippet}
        Move down
      </ContextMenuItem>

      <div class="menu-divider"></div>

      <ContextMenuItem danger onclick={handleDelete}>
        {#snippet icon()}🗑{/snippet}
        Delete
        {#if hasChildren}
          <span class="badge danger">{children.length}</span>
        {/if}
      </ContextMenuItem>
    {:else}
      <!-- Delete confirmation -->
      <div class="confirm-panel">
        <div class="confirm-message">
          Delete "{obj.name}"?
          {#if hasChildren}
            <br /><span class="confirm-warning">This will also delete {children.length} child object{children.length > 1 ? 's' : ''}.</span>
          {/if}
          <br /><span class="confirm-warning">This cannot be undone.</span>
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
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
  }

  .object-icon {
    font-size: var(--font-size-md);
  }

  .object-name {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 120px;
    flex: 1;
  }

  .object-type {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
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

  .badge.danger {
    background-color: #ef4444;
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

  .submenu-item:hover {
    background-color: var(--hover-bg);
  }

  .track-name {
    color: var(--text-muted);
    margin-left: var(--space-xs);
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
