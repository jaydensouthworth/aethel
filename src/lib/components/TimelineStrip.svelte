<script lang="ts">
  import { timeline, ui, timelineEditor, timelineHistory } from '$lib/stores';
  import * as ops from '$lib/services/timeline-operations';
  import TimelinePlacement from './TimelinePlacement.svelte';
  import TrackHeader from './timeline/TrackHeader.svelte';
  import type { TimelinePlacement as TPlacement, TimelineMarker } from '$lib/types';

  interface Props {
    onplacementcontextmenu?: (e: MouseEvent, placement: TPlacement) => void;
    ontrackcontextmenu?: (e: MouseEvent, track: number, position: number) => void;
    oncreateobject?: (track: number, position: number) => void;
  }

  let { onplacementcontextmenu, ontrackcontextmenu, oncreateobject }: Props = $props();

  let isDraggingCursor = $state(false);
  let tracksContainer = $state<HTMLDivElement | null>(null);
  let isBoxSelecting = $state(false);
  let boxStart = $state({ x: 0, y: 0 });
  let boxEnd = $state({ x: 0, y: 0 });

  // Reactive store values
  const placements = $derived(timeline.allPlacements);
  const placementsByTrack = $derived(timeline.byTrack);
  const trackCountValue = $derived(timeline.trackCount);
  const markersValue = $derived(timeline.markers);

  // Computed values
  const zoom = $derived(timelineEditor.zoom);
  const scrollOffset = $derived(timelineEditor.scrollOffset);
  const dragState = $derived(timelineEditor.dragState);
  const selectionBox = $derived(timelineEditor.selectionBox);

  // Calculate visible range based on zoom and scroll
  function getVisibleRange() {
    const bounds = timeline.bounds;
    const totalRange = bounds.max - bounds.min || 10;
    const visibleWidth = totalRange / zoom;
    return {
      min: bounds.min + scrollOffset,
      max: bounds.min + scrollOffset + visibleWidth,
    };
  }

  // Calculate left position for a placement based on visible range
  function getPlacementStyle(placement: TPlacement): string {
    const visible = getVisibleRange();
    const range = visible.max - visible.min || 1;
    const leftPercent = ((placement.position - visible.min) / range) * 100;

    if (placement.endPosition != null) {
      const widthPercent = ((placement.endPosition - placement.position) / range) * 100;
      return `left: ${leftPercent}%; width: ${Math.max(widthPercent, 2)}%;`;
    }

    return `left: ${leftPercent}%;`;
  }

  // Calculate cursor position as percentage
  function getCursorLeftPercent(): number {
    const visible = getVisibleRange();
    const range = visible.max - visible.min || 1;
    return ((timeline.cursorPosition - visible.min) / range) * 100;
  }

  // Convert screen X to timeline position
  function screenToTimelinePosition(clientX: number): number {
    if (!tracksContainer) return 0;
    const rect = tracksContainer.getBoundingClientRect();
    const trackLabelWidth = 120; // Width of track labels
    const x = clientX - rect.left - trackLabelWidth;
    const width = rect.width - trackLabelWidth;
    const percent = Math.max(0, Math.min(1, x / width));

    const visible = getVisibleRange();
    return visible.min + percent * (visible.max - visible.min);
  }

  // Check if placement is after cursor (should be dimmed)
  function isAfterCursor(placement: TPlacement): boolean {
    return placement.position > timeline.cursorPosition;
  }

  function handleToggleCollapse() {
    ui.toggleTimeline();
  }

  // Handle wheel for zoom and scroll
  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const centerPosition = screenToTimelinePosition(e.clientX);
      timelineEditor.zoomAt(zoom + delta * zoom, centerPosition);
    } else if (e.shiftKey) {
      // Horizontal scroll
      e.preventDefault();
      const scrollDelta = e.deltaY * 0.01;
      timelineEditor.setScrollOffset(scrollOffset + scrollDelta);
    }
  }

  // Handle click on track background to set cursor or start box selection
  function handleTrackMouseDown(e: MouseEvent, trackIndex: number) {
    // Left click on empty area
    if (e.button === 0 && e.target === e.currentTarget) {
      const position = screenToTimelinePosition(e.clientX);

      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        // Start box selection
        isBoxSelecting = true;
        boxStart = { x: e.clientX, y: e.clientY };
        boxEnd = { x: e.clientX, y: e.clientY };
        timelineEditor.startBoxSelection(e.clientX, e.clientY);
      } else {
        // Click to set cursor and clear selection
        timeline.setCursorPosition(Math.round(position * 10) / 10);
        timelineEditor.clearSelection();
      }
    }
  }

  // Handle track context menu
  function handleTrackContextMenu(e: MouseEvent, trackIndex: number, providedPosition?: number) {
    e.preventDefault();
    e.stopPropagation();

    const position = providedPosition ?? screenToTimelinePosition(e.clientX);
    ontrackcontextmenu?.(e, trackIndex, position);
  }

  // Handle double-click on empty area to create object
  function handleTrackDoubleClick(e: MouseEvent, trackIndex: number) {
    if (e.target === e.currentTarget) {
      const position = screenToTimelinePosition(e.clientX);
      oncreateobject?.(trackIndex, position);
    }
  }

  // Handle drag over for tree-to-timeline drops
  let dropHighlight = $state<{ track: number; position: number } | null>(null);

  function handleTrackDragOver(e: DragEvent, trackIndex: number) {
    e.preventDefault();
    if (!e.dataTransfer) return;

    // Check if this is a tree object being dragged
    const types = e.dataTransfer.types;
    if (types.includes('text/plain') || types.includes('application/x-aethel-object')) {
      e.dataTransfer.dropEffect = 'copy';
      const position = screenToTimelinePosition(e.clientX);
      dropHighlight = { track: trackIndex, position };
    }
  }

  function handleTrackDragLeave(e: DragEvent) {
    // Only clear if leaving the track area entirely
    const related = e.relatedTarget as Element | null;
    if (!related || !tracksContainer?.contains(related)) {
      dropHighlight = null;
    }
  }

  function handleTrackDrop(e: DragEvent, trackIndex: number) {
    e.preventDefault();
    dropHighlight = null;

    if (!e.dataTransfer) return;

    // Get the dragged object ID
    const objectId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/x-aethel-object');
    if (!objectId) return;

    const position = screenToTimelinePosition(e.clientX);
    const snappedPosition = timelineEditor.snapPosition(position);

    // Add the object to the timeline
    ops.addObjectToTimeline(objectId, snappedPosition, trackIndex);
  }

  // Handle cursor drag
  function handleCursorDragStart(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingCursor = true;

    function handleMouseMove(e: MouseEvent) {
      const position = screenToTimelinePosition(e.clientX);
      timeline.setCursorPosition(Math.round(position * 10) / 10);
    }

    function handleMouseUp() {
      isDraggingCursor = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  // Handle global mouse move for drag operations
  function handleMouseMove(e: MouseEvent) {
    if (isBoxSelecting) {
      boxEnd = { x: e.clientX, y: e.clientY };
      timelineEditor.updateBoxSelection(e.clientX, e.clientY);
      updateBoxSelectionPlacements();
    } else if (dragState.isDragging) {
      const position = screenToTimelinePosition(e.clientX);
      const snappedPosition = timelineEditor.snapPosition(position);

      // Calculate track from Y position
      if (tracksContainer) {
        const rect = tracksContainer.getBoundingClientRect();
        const trackHeight = 40; // Approximate track height
        const y = e.clientY - rect.top;
        const track = Math.max(0, Math.floor(y / trackHeight));
        timelineEditor.updateDrag(snappedPosition, track);
      }
    }
  }

  // Handle global mouse up for drag operations
  function handleMouseUp(e: MouseEvent) {
    if (isBoxSelecting) {
      isBoxSelecting = false;
      timelineEditor.endBoxSelection();
    } else if (dragState.isDragging) {
      // Apply the drag operation
      const delta = dragState.currentPosition - dragState.startPosition;
      const trackDelta = dragState.currentTrack - dragState.startTrack;

      if (dragState.type === 'move') {
        if (Math.abs(delta) > 0.01 || trackDelta !== 0) {
          if (timelineEditor.movementMode === 'magnetic') {
            // Magnetic move for single placement
            if (dragState.placementIds.length === 1) {
              ops.movePlacementMagnetic(
                dragState.placementIds[0],
                dragState.currentPosition,
                dragState.currentTrack
              );
            } else {
              ops.moveSelectedPlacements(delta, trackDelta);
            }
          } else {
            ops.moveSelectedPlacements(delta, trackDelta);
          }
        }
      } else if (dragState.type === 'resize-start' || dragState.type === 'resize-end') {
        // Resize operation
        for (const id of dragState.placementIds) {
          ops.resizePlacement(
            id,
            dragState.type === 'resize-start' ? 'start' : 'end',
            dragState.currentPosition
          );
        }
      }

      timelineEditor.endDrag();
    }
  }

  // Update box selection placements
  function updateBoxSelectionPlacements() {
    if (!tracksContainer || !isBoxSelecting) return;

    const rect = tracksContainer.getBoundingClientRect();
    const trackLabelWidth = 120;

    // Calculate box in track coordinates
    const boxLeft = Math.min(boxStart.x, boxEnd.x) - rect.left - trackLabelWidth;
    const boxRight = Math.max(boxStart.x, boxEnd.x) - rect.left - trackLabelWidth;
    const boxTop = Math.min(boxStart.y, boxEnd.y) - rect.top;
    const boxBottom = Math.max(boxStart.y, boxEnd.y) - rect.top;

    const visible = getVisibleRange();
    const range = visible.max - visible.min || 1;
    const width = rect.width - trackLabelWidth;

    // Convert to timeline positions
    const leftPos = visible.min + (boxLeft / width) * range;
    const rightPos = visible.min + (boxRight / width) * range;

    // Calculate track range
    const trackHeight = 40;
    const topTrack = Math.floor(boxTop / trackHeight);
    const bottomTrack = Math.floor(boxBottom / trackHeight);

    // Find placements in box
    const newSelection = new Set<string>();
    for (const p of placements) {
      const pEnd = p.endPosition ?? p.position;
      const inXRange = pEnd >= leftPos && p.position <= rightPos;
      const inYRange = p.track >= topTrack && p.track <= bottomTrack;

      if (inXRange && inYRange) {
        newSelection.add(p.id);
      }
    }

    // Update selection (additive with shift/ctrl)
    for (const id of newSelection) {
      if (!timelineEditor.isSelected(id)) {
        timelineEditor.select(id, true);
      }
    }
  }

  // Handle placement context menu
  function handlePlacementContextMenu(e: MouseEvent, placement: TPlacement) {
    onplacementcontextmenu?.(e, placement);
  }

  // Build array of track indices
  const trackIndices = $derived(Array.from({ length: Math.max(trackCountValue, 1) }, (_, i) => i));
  const cursorLeftPercent = $derived(getCursorLeftPercent());
  const visibleRange = $derived(getVisibleRange());
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<div class="timeline-strip" class:collapsed={ui.timelineCollapsed}>
  <div class="timeline-header">
    <button class="collapse-toggle" onclick={handleToggleCollapse}>
      <span class="collapse-icon">{ui.timelineCollapsed ? '▶' : '▼'}</span>
      <span class="collapse-label">Timeline</span>
      {#if placements.length > 0}
        <span class="object-count">{placements.length}</span>
      {/if}
    </button>
    <div class="header-info">
      <span class="cursor-position">@ {timeline.cursorPosition.toFixed(1)}</span>
      <span class="zoom-level">{Math.round(zoom * 100)}%</span>
      {#if trackCountValue > 1}
        <span class="track-count">{trackCountValue} tracks</span>
      {/if}
      {#if timelineEditor.hasSelection}
        <span class="selection-count">{timelineEditor.selectedPlacementIds.size} selected</span>
      {/if}
    </div>
  </div>

  {#if !ui.timelineCollapsed}
    <div class="timeline-content" onwheel={handleWheel}>
      {#if placements.length === 0}
        <div class="empty-timeline">
          <span class="empty-text">No objects on timeline</span>
          <span class="empty-hint">Double-click to create, or drag objects from the tree</span>
        </div>
      {:else}
        <div
          class="timeline-tracks"
          class:dragging-cursor={isDraggingCursor}
          class:dragging-placement={dragState.isDragging}
          bind:this={tracksContainer}
        >
          <!-- Cursor line -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="timeline-cursor"
            style:left="{cursorLeftPercent}%"
            onmousedown={handleCursorDragStart}
          >
            <div class="cursor-handle"></div>
          </div>

          <!-- Markers -->
          {#each markersValue as marker (marker.id)}
            {@const markerPercent = ((marker.position - visibleRange.min) / (visibleRange.max - visibleRange.min)) * 100}
            <div
              class="timeline-marker"
              style:left="{markerPercent}%"
              title={marker.name}
            >
              <div class="marker-flag">{marker.name}</div>
            </div>
          {/each}

          <!-- Snap line (when dragging) -->
          {#if dragState.isDragging}
            {@const snapPercent = ((dragState.currentPosition - visibleRange.min) / (visibleRange.max - visibleRange.min)) * 100}
            <div class="snap-line" style:left="{snapPercent}%"></div>
          {/if}

          {#each trackIndices as trackIndex (trackIndex)}
            {@const trackPlacements = placementsByTrack.get(trackIndex) ?? []}
            {@const isTrackLocked = timelineEditor.isTrackLocked(trackIndex)}
            {@const track = timeline.getTrack(trackIndex)}
            {@const isMuted = track?.muted ?? false}
            {@const hasSoloTracks = timeline.allTracks.some(t => t.solo)}
            {@const isSolo = track?.solo ?? false}
            {@const isEffectivelyMuted = isMuted || (hasSoloTracks && !isSolo)}
            <div
              class="timeline-track"
              class:locked={isTrackLocked}
              class:muted={isEffectivelyMuted}
              class:solo={isSolo}
              data-track={trackIndex}
            >
              <div class="track-label">
                <TrackHeader
                  {trackIndex}
                  oncontextmenu={(e, ti) => handleTrackContextMenu(e, ti)}
                />
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="track-content"
                class:drop-target={dropHighlight?.track === trackIndex}
                onmousedown={(e) => handleTrackMouseDown(e, trackIndex)}
                oncontextmenu={(e) => handleTrackContextMenu(e, trackIndex)}
                ondblclick={(e) => handleTrackDoubleClick(e, trackIndex)}
                ondragover={(e) => handleTrackDragOver(e, trackIndex)}
                ondragleave={handleTrackDragLeave}
                ondrop={(e) => handleTrackDrop(e, trackIndex)}
              >
                {#each trackPlacements as placement (placement.id)}
                  <div
                    class="placement-wrapper"
                    class:after-cursor={isAfterCursor(placement)}
                    style={getPlacementStyle(placement)}
                  >
                    <TimelinePlacement
                      {placement}
                      hasRange={placement.endPosition != null}
                      oncontextmenu={(e) => handlePlacementContextMenu(e, placement)}
                    />
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Box selection overlay -->
      {#if isBoxSelecting}
        <div
          class="selection-box"
          style:left="{Math.min(boxStart.x, boxEnd.x)}px"
          style:top="{Math.min(boxStart.y, boxEnd.y)}px"
          style:width="{Math.abs(boxEnd.x - boxStart.x)}px"
          style:height="{Math.abs(boxEnd.y - boxStart.y)}px"
        ></div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .timeline-strip {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--surface-sunken);
    border-top: 1px solid var(--border-subtle);
  }

  .timeline-strip.collapsed {
    height: auto !important;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    background-color: var(--surface-raised);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .collapse-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    color: var(--text-primary);
    transition: background-color var(--transition-fast);
  }

  .collapse-toggle:hover {
    background-color: var(--hover-bg);
  }

  .collapse-icon {
    font-size: 10px;
    color: var(--text-muted);
    width: 12px;
  }

  .collapse-label {
    font-weight: 500;
  }

  .object-count {
    font-size: var(--font-size-xs);
    padding: 2px 6px;
    border-radius: 10px;
    background-color: var(--hover-bg);
    color: var(--text-secondary);
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .track-count,
  .zoom-level {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .cursor-position {
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    color: var(--text-secondary);
    padding: 2px 6px;
    background-color: var(--hover-bg);
    border-radius: var(--radius-sm);
  }

  .selection-count {
    font-size: var(--font-size-xs);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background-color: var(--color-accent, #3b82f6);
    color: white;
  }

  .timeline-content {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .timeline-tracks {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    position: relative;
  }

  .timeline-tracks.dragging-cursor {
    cursor: ew-resize;
  }

  .timeline-tracks.dragging-placement {
    cursor: grabbing;
  }

  /* Cursor line */
  .timeline-cursor {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background-color: var(--color-accent, #3b82f6);
    z-index: 20;
    cursor: ew-resize;
    margin-left: 120px;
  }

  .cursor-handle {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 12px;
    height: 12px;
    background-color: var(--color-accent, #3b82f6);
    border-radius: 50%;
    border: 2px solid var(--surface-raised);
  }

  .cursor-handle:hover {
    transform: translateX(-50%) scale(1.2);
  }

  /* Markers */
  .timeline-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: var(--color-warning, #f59e0b);
    z-index: 15;
    margin-left: 120px;
    pointer-events: none;
  }

  .marker-flag {
    position: absolute;
    top: 0;
    left: 0;
    transform: translateX(-50%);
    padding: 2px 4px;
    font-size: 9px;
    background-color: var(--color-warning, #f59e0b);
    color: black;
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    white-space: nowrap;
    pointer-events: auto;
    cursor: pointer;
  }

  /* Snap line */
  .snap-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: var(--color-success, #22c55e);
    z-index: 19;
    margin-left: 120px;
    opacity: 0.7;
    pointer-events: none;
  }

  .timeline-track {
    display: flex;
    align-items: stretch;
    min-height: 40px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .timeline-track:last-child {
    border-bottom: none;
  }

  .timeline-track.locked {
    background-color: var(--surface-sunken);
  }

  .timeline-track.muted {
    opacity: 0.4;
  }

  .timeline-track.solo {
    background-color: color-mix(in srgb, var(--color-warning, #f59e0b) 5%, transparent);
  }

  .track-label {
    width: 120px;
    flex-shrink: 0;
    min-height: 40px;
  }

  .track-content {
    flex: 1;
    position: relative;
    min-height: 40px;
    padding: var(--space-xs) 0;
    transition: background-color var(--transition-fast);
  }

  .track-content.drop-target {
    background-color: color-mix(in srgb, var(--color-accent, #3b82f6) 15%, transparent);
    outline: 2px dashed var(--color-accent, #3b82f6);
    outline-offset: -2px;
  }

  .placement-wrapper {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    max-width: calc(100% - 4px);
  }

  .placement-wrapper:hover {
    z-index: 10;
  }

  .placement-wrapper.after-cursor {
    opacity: 0.35;
  }

  .placement-wrapper.after-cursor:hover {
    opacity: 0.7;
  }

  .empty-timeline {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 100%;
    text-align: center;
    padding: var(--space-lg);
  }

  .empty-text {
    font-size: var(--font-size-md);
    color: var(--text-secondary);
  }

  .empty-hint {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin-top: var(--space-xs);
  }

  /* Box selection */
  .selection-box {
    position: fixed;
    border: 1px dashed var(--color-accent, #3b82f6);
    background-color: color-mix(in srgb, var(--color-accent, #3b82f6) 10%, transparent);
    pointer-events: none;
    z-index: 100;
  }
</style>
