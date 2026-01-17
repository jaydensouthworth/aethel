<script lang="ts">
  import { timeline, timelineEditor } from '$lib/stores';
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
  const hasClipboard = $derived(timelineEditor.clipboard.length > 0);

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

  function handleAddMarker() {
    if (onShowMarkerDialog) {
      onShowMarkerDialog(position);
    }
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
    <span class="track-label">Timeline</span>
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

  <div class="menu-divider"></div>

  <ContextMenuItem onclick={handleAddMarker}>
    {#snippet icon()}|{/snippet}
    Add milestone here
  </ContextMenuItem>

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

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle);
    margin: var(--space-xs) 0;
  }
</style>
