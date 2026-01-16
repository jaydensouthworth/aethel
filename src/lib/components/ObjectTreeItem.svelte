<script lang="ts">
  import { objects, ui, timeline } from '$lib/stores';
  import { getObjectType, OBJECT_TYPES } from '$lib/types';
  import type { AethelObject } from '$lib/types';
  // Self-import for recursion (replaces deprecated svelte:self)
  import ObjectTreeItem from './ObjectTreeItem.svelte';
  import ConfirmModal from './ConfirmModal.svelte';

  interface Props {
    obj: AethelObject;
    depth?: number;
    oncontextmenu?: (e: MouseEvent, obj: AethelObject) => void;
  }

  let { obj, depth = 0, oncontextmenu }: Props = $props();

  const objectType = $derived(getObjectType(obj.typeId));
  const effectiveColor = $derived(objects.getEffectiveColor(obj.id));
  const effectiveIcon = $derived(objects.getEffectiveIcon(obj.id));
  const children = $derived(objects.getChildren(obj.id));
  const hasChildren = $derived(children.length > 0);
  const isExpanded = $derived(ui.isTreeExpanded(obj.id));
  const isSelected = $derived(ui.selectedObjectId === obj.id);
  const placementCount = $derived(timeline.getPlacementsForObject(obj.id).length);
  const hasPlacement = $derived(placementCount > 0);
  const isFolder = $derived(obj.typeId === 'folder');

  // Drag state
  const isDragged = $derived(ui.draggedObjectId === obj.id);
  const isDropTarget = $derived(ui.dropTargetId === obj.id);
  const dropPos = $derived(isDropTarget ? ui.dropPosition : null);

  // Delete confirmation
  let showDeleteConfirm = $state(false);

  // Add child menu (for folders)
  let showAddMenu = $state(false);

  // Infer the default type for new items based on folder's color
  const inferredType = $derived.by(() => {
    if (!isFolder) return null;

    // Check if folder's color matches any object type's color
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

    // Default to note
    return OBJECT_TYPES.note;
  });

  function handleClick() {
    ui.select(obj.id);
  }

  function handleToggle(e: MouseEvent) {
    e.stopPropagation();
    ui.toggleTreeExpanded(obj.id);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
    if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      ui.setTreeExpanded(obj.id, true);
    }
    if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      ui.setTreeExpanded(obj.id, false);
    }
  }

  // Drag handlers
  function handleDragStart(e: DragEvent) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', obj.id);
    // Also set a custom type for timeline drops
    e.dataTransfer.setData('application/x-aethel-object', obj.id);
    e.dataTransfer.effectAllowed = 'copyMove';
    ui.setDraggedObject(obj.id);
  }

  // Context menu handler
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    oncontextmenu?.(e, obj);
  }

  function handleDragEnd() {
    ui.clearDrag();
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer) return;

    // Don't allow drop on self or descendants
    if (ui.draggedObjectId === obj.id) return;
    if (ui.draggedObjectId && objects.isDescendant(obj.id, ui.draggedObjectId)) return;

    e.dataTransfer.dropEffect = 'move';

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // For folders: always drop inside (more intuitive)
    // For non-folders: use position to determine sibling placement
    const isFolder = obj.typeId === 'folder';

    if (isFolder) {
      // Folders always accept drops inside
      ui.setDropTarget(obj.id, 'inside');
    } else if (y < height * 0.5) {
      // Non-folders: top half = before (same parent, above)
      ui.setDropTarget(obj.id, 'before');
    } else {
      // Non-folders: bottom half = after (same parent, below)
      ui.setDropTarget(obj.id, 'after');
    }
  }

  function handleDragLeave() {
    if (ui.dropTargetId === obj.id) {
      ui.setDropTarget(null, null);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const draggedId = e.dataTransfer?.getData('text/plain');

    if (draggedId && draggedId !== obj.id && ui.dropPosition) {
      objects.reparent(draggedId, obj.id, ui.dropPosition);
    }

    ui.clearDrag();
  }

  // Delete handlers
  function handleDeleteClick(e: MouseEvent) {
    e.stopPropagation();
    showDeleteConfirm = true;
  }

  function handleConfirmDelete() {
    const id = obj.id;
    if (ui.selectedObjectId === id) {
      ui.select(null);
    }
    objects.delete(id);
    timeline.removeAllForObject(id);
    showDeleteConfirm = false;
  }

  function handleCancelDelete() {
    showDeleteConfirm = false;
  }

  // Add child object to folder
  function handleAddClick(e: MouseEvent) {
    e.stopPropagation();
    showAddMenu = !showAddMenu;
  }

  function handleCreateItem() {
    if (!inferredType) return;
    const name = prompt(`Enter name for new ${inferredType.name}:`);
    if (name?.trim()) {
      const newObj = objects.create(name.trim(), inferredType.id, obj.id);
      // New items are not rendered by default (already the default)
      ui.setTreeExpanded(obj.id, true);
      ui.select(newObj.id);
    }
    showAddMenu = false;
  }

  function handleCreateFolder() {
    const name = prompt('Enter name for new folder:');
    if (name?.trim()) {
      const newObj = objects.create(name.trim(), 'folder', obj.id);
      ui.setTreeExpanded(obj.id, true);
      ui.select(newObj.id);
    }
    showAddMenu = false;
  }
</script>

<div class="tree-item-container" class:dragging={isDragged}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="tree-item"
    class:selected={isSelected}
    class:on-timeline={hasPlacement}
    class:drop-before={dropPos === 'before'}
    class:drop-after={dropPos === 'after'}
    class:drop-inside={dropPos === 'inside'}
    style:padding-left="{16 + depth * 16}px"
    role="treeitem"
    tabindex="0"
    draggable="true"
    aria-selected={isSelected}
    aria-expanded={hasChildren ? isExpanded : undefined}
    onclick={handleClick}
    onkeydown={handleKeydown}
    ondragstart={handleDragStart}
    ondragend={handleDragEnd}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    oncontextmenu={handleContextMenu}
  >
    {#if hasChildren}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span class="expand-toggle" onclick={handleToggle}>
        <span class="expand-icon" class:expanded={isExpanded}>›</span>
      </span>
    {:else}
      <span class="expand-spacer"></span>
    {/if}

    <span class="item-icon" style:color={effectiveColor}>{effectiveIcon}</span>
    <span class="item-name">{obj.name}</span>

    <span class="item-badges">
      {#if hasPlacement}
        <span class="badge timeline" title="{placementCount} placement{placementCount > 1 ? 's' : ''} on timeline">
          {placementCount}
        </span>
      {/if}
      {#if obj.rendered}
        <span class="badge rendered" title="Rendered in book">*</span>
      {/if}
    </span>

    {#if isFolder}
      <button
        class="add-btn"
        title="Add to {obj.name}"
        onclick={handleAddClick}
      >+</button>
    {/if}

    <button
      class="delete-btn"
      title="Delete {obj.name}"
      onclick={handleDeleteClick}
    >x</button>

    {#if showAddMenu}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="add-menu-backdrop" onclick={() => showAddMenu = false}></div>
      <div class="add-menu">
        {#if inferredType}
          <button class="add-menu-item" onclick={handleCreateItem}>
            <span class="add-menu-icon">{inferredType.icon}</span>
            New {inferredType.name}
          </button>
        {/if}
        <button class="add-menu-item" onclick={handleCreateFolder}>
          <span class="add-menu-icon">📁</span>
          New Folder
        </button>
      </div>
    {/if}
  </div>

  {#if hasChildren && isExpanded}
    <div class="children" role="group">
      {#each children as child (child.id)}
        <ObjectTreeItem obj={child} depth={depth + 1} {oncontextmenu} />
      {/each}
    </div>
  {/if}
</div>

{#if showDeleteConfirm}
  <ConfirmModal
    title="Delete {obj.name}?"
    message={hasChildren
      ? `This will also delete ${children.length} child object${children.length > 1 ? 's' : ''}. This action cannot be undone.`
      : 'This action cannot be undone.'}
    confirmLabel="Delete"
    destructive={true}
    onConfirm={handleConfirmDelete}
    onCancel={handleCancelDelete}
  />
{/if}

<style>
  .tree-item-container {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .tree-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: var(--font-size-base);
    color: var(--text-primary);
    transition: background-color var(--transition-fast);
    outline: none;
  }

  .tree-item:hover {
    background-color: var(--hover-bg);
  }

  .tree-item:focus-visible {
    background-color: var(--hover-bg);
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .tree-item.selected {
    background-color: var(--selected-bg);
  }

  .expand-toggle {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast);
  }

  .expand-toggle:hover {
    background-color: var(--active-bg);
  }

  .expand-icon {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    transition: transform var(--transition-normal);
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .expand-spacer {
    width: 16px;
    flex-shrink: 0;
  }

  .item-icon {
    font-size: var(--font-size-base);
    line-height: 1;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-badges {
    display: flex;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .badge {
    font-size: 10px;
    opacity: 0.6;
    transition: opacity var(--transition-fast);
  }

  .badge.timeline {
    padding: 1px 4px;
    border-radius: 8px;
    background-color: var(--hover-bg);
    font-family: var(--font-mono);
    font-weight: 500;
  }

  .badge.rendered {
    font-weight: bold;
  }

  .tree-item:hover .badge {
    opacity: 1;
  }

  .children {
    display: flex;
    flex-direction: column;
  }

  /* Drag and drop styles */
  .tree-item-container.dragging {
    opacity: 0.5;
  }

  .tree-item.drop-before {
    box-shadow: inset 0 2px 0 var(--color-accent, #3b82f6);
  }

  .tree-item.drop-after {
    box-shadow: inset 0 -2px 0 var(--color-accent, #3b82f6);
  }

  .tree-item.drop-inside {
    background-color: color-mix(in srgb, var(--color-accent, #3b82f6) 15%, transparent);
    outline: 1px dashed var(--color-accent, #3b82f6);
    outline-offset: -1px;
  }

  /* Action buttons (add, delete) */
  .add-btn,
  .delete-btn {
    display: none;
    padding: 0 var(--space-xs);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    flex-shrink: 0;
    transition: all var(--transition-fast);
  }

  .tree-item:hover .add-btn,
  .tree-item:hover .delete-btn {
    display: block;
  }

  .add-btn:hover {
    color: var(--color-accent, #3b82f6);
    background-color: color-mix(in srgb, var(--color-accent, #3b82f6) 10%, transparent);
  }

  .delete-btn:hover {
    color: var(--color-error, #ef4444);
    background-color: color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent);
  }

  /* Add menu dropdown */
  .add-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .add-menu {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 100;
    min-width: 160px;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: var(--space-xs);
  }

  .add-menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    text-align: left;
    transition: background-color var(--transition-fast);
  }

  .add-menu-item:hover {
    background-color: var(--hover-bg);
  }

  .add-menu-icon {
    font-size: var(--font-size-base);
  }
</style>
