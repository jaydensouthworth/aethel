<script lang="ts">
  import { timeline, timelineEditor } from '$lib/stores';
  import * as ops from '$lib/services/timeline-operations';
  import ContextMenu from '$lib/editor/context/ContextMenu.svelte';
  import ContextMenuItem from '$lib/editor/context/ContextMenuItem.svelte';

  interface Props {
    open: boolean;
    x: number;
    y: number;
    trackIndex: number;
    position: number;
    onClose: () => void;
    onShowCreateDialog?: (trackIndex: number, position: number) => void;
    onShowMutationDialog?: (trackIndex: number, position: number) => void;
    onShowMarkerDialog?: (position: number) => void;
  }

  let {
    open,
    x,
    y,
    trackIndex,
    position,
    onClose,
    onShowCreateDialog,
    onShowMutationDialog,
    onShowMarkerDialog,
  }: Props = $props();

  // Derived state
  const track = $derived(timeline.allTracks[trackIndex]);
  const isTrackLocked = $derived(track ? timelineEditor.isTrackLocked(trackIndex) : false);
  const hasClipboard = $derived(timelineEditor.clipboard.length > 0);
  const trackCount = $derived(timeline.allTracks.length);

  function handleClose() {
    onClose();
  }

  // Actions
  function handleCreateObject() {
    if (onShowCreateDialog) {
      onShowCreateDialog(trackIndex, position);
    }
    handleClose();
  }

  function handleAddMutation() {
    if (onShowMutationDialog) {
      onShowMutationDialog(trackIndex, position);
    }
    handleClose();
  }

  function handlePaste() {
    if (!hasClipboard) return;
    // Move cursor to position first
    timeline.setCursorPosition(position);
    ops.pasteAtCursor();
    handleClose();
  }

  function handleAddMarker() {
    if (onShowMarkerDialog) {
      onShowMarkerDialog(position);
    } else {
      // Default: add simple marker
      timeline.addMarker({
        id: crypto.randomUUID(),
        position: position,
        label: `Marker at ${position}`,
        color: '#3b82f6',
      });
    }
    handleClose();
  }

  function handleJumpCursor() {
    timeline.setCursorPosition(position);
    handleClose();
  }

  function handleToggleTrackLock() {
    timelineEditor.toggleTrackLock(trackIndex);
    handleClose();
  }

  function handleRenameTrack() {
    const newName = prompt('Enter track name:', track?.name || `Track ${trackIndex + 1}`);
    if (newName !== null) {
      timeline.updateTrack(trackIndex, { name: newName.trim() || undefined });
    }
    handleClose();
  }

  function handleSetTrackColor() {
    // Simple color selection - could be enhanced with a color picker
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const currentIndex = track?.color ? colors.indexOf(track.color) : -1;
    const nextColor = colors[(currentIndex + 1) % colors.length];
    timeline.updateTrack(trackIndex, { color: nextColor });
    handleClose();
  }

  function handleAddTrackAbove() {
    timeline.insertTrack(trackIndex, { locked: false });
    handleClose();
  }

  function handleAddTrackBelow() {
    timeline.insertTrack(trackIndex + 1, { locked: false });
    handleClose();
  }

  function handleDeleteTrack() {
    if (trackCount <= 1) return; // Don't delete the last track

    const placementsOnTrack = timeline.allPlacements.filter(p => p.track === trackIndex);
    if (placementsOnTrack.length > 0) {
      const confirm = window.confirm(
        `This track has ${placementsOnTrack.length} placement(s). Delete anyway?`
      );
      if (!confirm) return;
    }

    timeline.removeTrack(trackIndex);
    handleClose();
  }

  function handleSelectAllOnTrack() {
    const placementsOnTrack = timeline.allPlacements.filter(p => p.track === trackIndex);
    timelineEditor.clearSelection();
    placementsOnTrack.forEach(p => timelineEditor.select(p.id));
    handleClose();
  }

  function handleZoomToFit() {
    timelineEditor.resetZoom();
    handleClose();
  }
</script>

<ContextMenu {open} {x} {y} onClose={handleClose}>
  <!-- Header -->
  <div class="menu-header">
    <span class="track-label">Track {trackIndex + 1}</span>
    {#if track?.name}
      <span class="track-name">{track.name}</span>
    {/if}
  </div>

  <div class="menu-divider"></div>

  <!-- Create actions -->
  <ContextMenuItem onclick={handleCreateObject}>
    {#snippet icon()}+{/snippet}
    Create object here
  </ContextMenuItem>

  <ContextMenuItem onclick={handleAddMutation}>
    {#snippet icon()}~{/snippet}
    Add mutation here
  </ContextMenuItem>

  {#if hasClipboard}
    <ContextMenuItem onclick={handlePaste}>
      {#snippet icon()}📋{/snippet}
      Paste here
    </ContextMenuItem>
  {/if}

  <div class="menu-divider"></div>

  <!-- Navigation -->
  <ContextMenuItem onclick={handleJumpCursor}>
    {#snippet icon()}▶{/snippet}
    Jump cursor here
  </ContextMenuItem>

  <ContextMenuItem onclick={handleAddMarker}>
    {#snippet icon()}🚩{/snippet}
    Add marker here
  </ContextMenuItem>

  <div class="menu-divider"></div>

  <!-- Track management -->
  <ContextMenuItem onclick={handleSelectAllOnTrack}>
    {#snippet icon()}☐{/snippet}
    Select all on track
  </ContextMenuItem>

  <ContextMenuItem onclick={handleToggleTrackLock}>
    {#snippet icon()}{isTrackLocked ? '🔓' : '🔒'}{/snippet}
    {isTrackLocked ? 'Unlock track' : 'Lock track'}
  </ContextMenuItem>

  <ContextMenuItem onclick={handleRenameTrack}>
    {#snippet icon()}✎{/snippet}
    Rename track
  </ContextMenuItem>

  <ContextMenuItem onclick={handleSetTrackColor}>
    {#snippet icon()}🎨{/snippet}
    Set track color
  </ContextMenuItem>

  <div class="menu-divider"></div>

  <!-- Track structure -->
  <ContextMenuItem onclick={handleAddTrackAbove}>
    {#snippet icon()}↑{/snippet}
    Add track above
  </ContextMenuItem>

  <ContextMenuItem onclick={handleAddTrackBelow}>
    {#snippet icon()}↓{/snippet}
    Add track below
  </ContextMenuItem>

  {#if trackCount > 1}
    <ContextMenuItem danger onclick={handleDeleteTrack}>
      {#snippet icon()}🗑{/snippet}
      Delete track
    </ContextMenuItem>
  {/if}

  <div class="menu-divider"></div>

  <!-- View -->
  <ContextMenuItem onclick={handleZoomToFit}>
    {#snippet icon()}⊡{/snippet}
    Reset zoom
  </ContextMenuItem>
</ContextMenu>

<style>
  .menu-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
  }

  .track-label {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }

  .track-name {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle);
    margin: var(--space-xs) 0;
  }
</style>
