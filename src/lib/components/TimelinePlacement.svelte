<script lang="ts">
  import type { TimelinePlacement as TPlacement } from '$lib/types';
  import { getObjectType } from '$lib/types';
  import { objects, ui, timelineEditor, timeline } from '$lib/stores';

  interface Props {
    placement: TPlacement;
    hasRange?: boolean;
    oncontextmenu?: (e: MouseEvent) => void;
    onrazor?: (e: MouseEvent) => void;
  }

  let { placement, hasRange = false, oncontextmenu, onrazor }: Props = $props();

  // Object data
  const obj = $derived(objects.get(placement.objectId));
  const objectType = $derived(obj ? getObjectType(obj.typeId) : null);
  const effectiveColor = $derived(obj ? objects.getEffectiveColor(obj.id) : null);
  const effectiveIcon = $derived(obj ? objects.getEffectiveIcon(obj.id) : null);

  // Editor state
  const isSelected = $derived(timelineEditor.isSelected(placement.id));
  const isHighlighted = $derived(timelineEditor.isHighlighted(placement.id));
  const isLocked = $derived(timelineEditor.isPlacementLocked(placement.id));
  const activeTool = $derived(timelineEditor.activeTool);
  const isDragging = $derived(
    timelineEditor.dragState.isDragging &&
    timelineEditor.dragState.placementIds.includes(placement.id)
  );

  // Handle mouse down for selection and drag
  function handleMouseDown(e: MouseEvent) {
    // Don't handle if locked
    if (isLocked) return;

    // Only handle left button; allow right-click to open context menus
    if (e.button !== 0) return;

    if (activeTool === 'razor') {
      e.preventDefault();
      e.stopPropagation();
      onrazor?.(e);
      return;
    }

    // Prevent default to avoid text selection
    e.preventDefault();

    // Handle selection
    if (e.shiftKey) {
      // Shift+click: add to selection
      timelineEditor.toggleSelect(placement.id);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: toggle selection
      timelineEditor.toggleSelect(placement.id);
    } else if (!isSelected) {
      // Regular click on unselected: clear and select this one
      timelineEditor.clearSelection();
      timelineEditor.select(placement.id);
    }

    // Start drag if using select tool and left button
    // Note: In v3 model, position/track are not on placements - use timeslot index
    if (e.button === 0 && activeTool === 'select') {
      const timeslotIndex = timeline.getTimeslotIndex(placement.timeslotId);
      timelineEditor.startDrag('move', timeslotIndex, 0);
    }
  }

  // Handle edge drag for resize
  function handleEdgeMouseDown(e: MouseEvent, edge: 'start' | 'end') {
    e.stopPropagation();
    e.preventDefault();

    if (isLocked) return;

    // Select this placement if not selected
    if (!isSelected) {
      timelineEditor.clearSelection();
      timelineEditor.select(placement.id);
    }

    // Start resize drag
    // Note: In v3 model, position/track are not on placements - use timeslot index
    const dragType = edge === 'start' ? 'resize-start' : 'resize-end';
    const timeslotIndex = timeline.getTimeslotIndex(placement.timeslotId);
    timelineEditor.startDrag(dragType, timeslotIndex, 0);
  }

  // Handle click for selection
  function handleClick(e: MouseEvent) {
    // Select the object in tree view
    if (obj) {
      ui.select(obj.id);
    }
  }

  // Handle double-click to jump cursor
  function handleDoubleClick(e: MouseEvent) {
    // Jump cursor to this placement
    // This will be handled by the parent TimelineStrip
  }

  // Handle context menu
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Select if not already selected
    if (!isSelected) {
      timelineEditor.clearSelection();
      timelineEditor.select(placement.id);
    }

    oncontextmenu?.(e);
  }
</script>

{#if obj && objectType && effectiveColor && effectiveIcon}
  <button
    class="timeline-placement"
    class:selected={isSelected}
    class:highlighted={isHighlighted}
    class:locked={isLocked}
    class:dragging={isDragging}
    class:creation={placement.type === 'creation'}
    class:mutation={placement.type === 'mutation'}
    class:rendered={obj.rendered}
    class:has-range={hasRange}
    style:--block-color={effectiveColor}
    onmousedown={handleMouseDown}
    onclick={handleClick}
    ondblclick={handleDoubleClick}
    oncontextmenu={handleContextMenu}
  >
    <!-- Left resize handle for range placements -->
    {#if hasRange && !isLocked && activeTool === 'select'}
      <div
        class="resize-handle left"
        onmousedown={(e) => handleEdgeMouseDown(e, 'start')}
        role="slider"
        aria-label="Resize start"
        aria-valuenow={0}
        tabindex="-1"
      ></div>
    {/if}

    <!-- Content -->
    <div class="placement-content">
      {#if placement.type === 'mutation'}
        <span class="mutation-icon">~</span>
        <span class="placement-label">{placement.mutation?.label ?? obj.name}</span>
      {:else}
        <span class="block-icon">{effectiveIcon}</span>
        <span class="placement-label">{obj.name}</span>
      {/if}

      <!-- Indicators -->
      <div class="indicators">
        {#if obj.rendered && placement.type === 'creation'}
          <span class="rendered-indicator" title="Rendered in book">*</span>
        {/if}
        {#if isLocked}
          <span class="lock-indicator" title="Locked">🔒</span>
        {/if}
      </div>
    </div>

    <!-- Right resize handle for range placements -->
    {#if hasRange && !isLocked && activeTool === 'select'}
      <div
        class="resize-handle right"
        onmousedown={(e) => handleEdgeMouseDown(e, 'end')}
        role="slider"
        aria-label="Resize end"
        aria-valuenow={0}
        tabindex="-1"
      ></div>
    {/if}
  </button>
{/if}

<style>
  .timeline-placement {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    border: 2px solid var(--block-color);
    border-radius: var(--radius-md);
    background-color: var(--surface-raised);
    color: var(--text-primary);
    font-size: var(--font-size-xs);
    white-space: nowrap;
    flex-shrink: 0;
    transition: background-color var(--transition-fast),
                transform var(--transition-fast),
                box-shadow var(--transition-fast);
    min-height: 28px;
    cursor: pointer;
    user-select: none;
  }

  .timeline-placement:hover {
    background-color: var(--hover-bg);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .timeline-placement.selected {
    background-color: var(--selected-bg);
    box-shadow: 0 0 0 2px var(--block-color);
    z-index: 10;
  }

  .timeline-placement.highlighted {
    animation: highlight-pulse 0.5s ease-in-out 3;
  }

  @keyframes highlight-pulse {
    0%, 100% {
      box-shadow: 0 0 0 2px var(--block-color);
    }
    50% {
      box-shadow: 0 0 0 4px var(--block-color), 0 0 8px var(--block-color);
    }
  }

  .timeline-placement.locked {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .timeline-placement.locked:hover {
    transform: none;
  }

  .timeline-placement.dragging {
    opacity: 0.7;
    transform: scale(1.02);
    z-index: 100;
  }

  /* Creation placements - solid */
  .timeline-placement.creation {
    border-style: solid;
  }

  .timeline-placement.creation:not(.rendered) {
    border-style: dashed;
    opacity: 0.7;
  }

  .timeline-placement.creation:not(.rendered):hover {
    opacity: 1;
  }

  /* Mutation placements - smaller, tag-like */
  .timeline-placement.mutation {
    border-style: dashed;
    background-color: color-mix(in srgb, var(--block-color) 10%, var(--surface-raised));
    font-size: var(--font-size-xs);
    padding: 2px var(--space-sm);
    min-height: 24px;
  }

  /* Range placements stretch to fill width */
  .timeline-placement.has-range {
    width: 100%;
    min-width: 0;
  }

  .placement-content {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .mutation-icon {
    font-size: var(--font-size-sm);
    font-weight: bold;
    color: var(--block-color);
    flex-shrink: 0;
  }

  .block-icon {
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  .placement-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }

  .has-range .placement-label {
    max-width: none;
  }

  .indicators {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .rendered-indicator {
    font-size: 10px;
    font-weight: bold;
    color: var(--block-color);
  }

  .lock-indicator {
    font-size: 10px;
  }

  /* Resize handles */
  .resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
    background: transparent;
    opacity: 0;
    transition: opacity var(--transition-fast), background-color var(--transition-fast);
  }

  .resize-handle.left {
    left: 0;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
  }

  .resize-handle.right {
    right: 0;
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
  }

  .timeline-placement:hover .resize-handle,
  .timeline-placement.selected .resize-handle {
    opacity: 1;
  }

  .resize-handle:hover {
    background-color: color-mix(in srgb, var(--block-color) 30%, transparent);
  }
</style>
