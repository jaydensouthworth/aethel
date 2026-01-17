<script lang="ts">
  import { timelineEditor, timelineHistory } from '$lib/stores';
  import * as ops from '$lib/services/timeline-operations';

  // Tools configuration
  const tools = [
    { id: 'select', label: 'V', title: 'Selection Tool (V)', icon: '↖' },
    { id: 'razor', label: 'B', title: 'Razor/Split Tool (B)', icon: '/' },
    { id: 'slip', label: 'S', title: 'Slip Tool (S)', icon: '↔' },
    { id: 'slide', label: 'D', title: 'Slide Tool (D)', icon: '⇔' },
  ] as const;

  const activeTool = $derived(timelineEditor.activeTool);
  const movementMode = $derived(timelineEditor.movementMode);
  const snapEnabled = $derived(timelineEditor.snapEnabled);
  const zoom = $derived(timelineEditor.zoom);
  const canUndo = $derived(timelineHistory.canUndo);
  const canRedo = $derived(timelineHistory.canRedo);
  const hasSelection = $derived(timelineEditor.hasSelection);

  function handleToolClick(toolId: typeof tools[number]['id']) {
    timelineEditor.setTool(toolId);
  }

  function handleModeToggle() {
    timelineEditor.toggleMovementMode();
  }

  function handleSnapToggle() {
    timelineEditor.toggleSnap();
  }

  function handleZoomIn() {
    timelineEditor.zoomIn();
  }

  function handleZoomOut() {
    timelineEditor.zoomOut();
  }

  function handleZoomReset() {
    timelineEditor.resetZoom();
  }

  function handleUndo() {
    timelineHistory.undo();
  }

  function handleRedo() {
    timelineHistory.redo();
  }

  function handleDelete() {
    // Delete all selected placements
    const selectedIds = Array.from(timelineEditor.selectedPlacementIds);
    selectedIds.forEach(id => ops.deletePlacement(id));
    timelineEditor.clearSelection();
  }

  function handleDuplicate() {
    ops.duplicateSelectedPlacements();
  }

  function handleGroup() {
    timelineEditor.groupSelected();
  }

  function handleUngroup() {
    timelineEditor.ungroupSelected();
  }

  function handleLock() {
    timelineEditor.toggleLockSelected();
  }
</script>

<div class="timeline-toolbar">
  <!-- Tools -->
  <div class="toolbar-group">
    {#each tools as tool (tool.id)}
      <button
        class="toolbar-btn"
        class:active={activeTool === tool.id}
        onclick={() => handleToolClick(tool.id)}
        title={tool.title}
      >
        <span class="tool-icon">{tool.icon}</span>
        <span class="tool-key">{tool.label}</span>
      </button>
    {/each}
  </div>

  <div class="toolbar-divider"></div>

  <!-- Movement Mode -->
  <div class="toolbar-group">
    <button
      class="toolbar-btn mode-btn"
      class:active={movementMode === 'magnetic'}
      onclick={handleModeToggle}
      title={movementMode === 'free' ? 'Free Mode (M to toggle)' : 'Magnetic Mode (M to toggle)'}
    >
      <span class="mode-icon">{movementMode === 'free' ? '○' : '◉'}</span>
      <span class="mode-label">{movementMode === 'free' ? 'Free' : 'Mag'}</span>
    </button>
  </div>

  <div class="toolbar-divider"></div>

  <!-- Snap -->
  <div class="toolbar-group">
    <button
      class="toolbar-btn"
      class:active={snapEnabled}
      onclick={handleSnapToggle}
      title="Toggle Snap (N)"
    >
      <span class="snap-icon">⊞</span>
      <span class="snap-label">Snap</span>
    </button>
  </div>

  <div class="toolbar-divider"></div>

  <!-- Zoom -->
  <div class="toolbar-group zoom-group">
    <button
      class="toolbar-btn small"
      onclick={handleZoomOut}
      title="Zoom Out (Ctrl+-)"
    >
      −
    </button>
    <button
      class="zoom-display"
      onclick={handleZoomReset}
      title="Reset Zoom (Ctrl+0)"
    >
      {Math.round(zoom * 100)}%
    </button>
    <button
      class="toolbar-btn small"
      onclick={handleZoomIn}
      title="Zoom In (Ctrl++)"
    >
      +
    </button>
  </div>

  <div class="toolbar-divider"></div>

  <!-- Undo/Redo -->
  <div class="toolbar-group">
    <button
      class="toolbar-btn"
      onclick={handleUndo}
      disabled={!canUndo}
      title="Undo (Ctrl+Z)"
    >
      ↩
    </button>
    <button
      class="toolbar-btn"
      onclick={handleRedo}
      disabled={!canRedo}
      title="Redo (Ctrl+Y)"
    >
      ↪
    </button>
  </div>

  <div class="toolbar-spacer"></div>

  <!-- Selection Actions -->
  {#if hasSelection}
    <div class="toolbar-group selection-actions">
      <button
        class="toolbar-btn"
        onclick={handleDuplicate}
        title="Duplicate (Ctrl+D)"
      >
        📋
      </button>
      <button
        class="toolbar-btn"
        onclick={handleGroup}
        title="Group (Ctrl+G)"
      >
        ⊕
      </button>
      <button
        class="toolbar-btn"
        onclick={handleUngroup}
        title="Ungroup (Ctrl+Shift+G)"
      >
        ⊖
      </button>
      <button
        class="toolbar-btn"
        onclick={handleLock}
        title="Lock/Unlock (Ctrl+L)"
      >
        🔒
      </button>
      <button
        class="toolbar-btn danger"
        onclick={handleDelete}
        title="Delete (Del)"
      >
        🗑
      </button>
    </div>
  {/if}
</div>

<style>
  .timeline-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-md);
    background-color: var(--surface-raised);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
    overflow-x: auto;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background-color: var(--border-subtle);
    margin: 0 var(--space-xs);
  }

  .toolbar-spacer {
    flex: 1;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    transition: all var(--transition-fast);
    min-width: 32px;
    height: 28px;
  }

  .toolbar-btn:hover:not(:disabled) {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toolbar-btn.active {
    background-color: var(--color-accent, #3b82f6);
    color: white;
  }

  .toolbar-btn.small {
    min-width: 24px;
    padding: var(--space-xs);
  }

  .toolbar-btn.danger:hover {
    background-color: var(--color-danger, #ef4444);
    color: white;
  }

  .tool-icon {
    font-size: var(--font-size-md);
  }

  .tool-key {
    font-size: 10px;
    font-family: var(--font-mono);
    opacity: 0.7;
  }

  .mode-btn {
    min-width: 60px;
  }

  .mode-icon {
    font-size: var(--font-size-sm);
  }

  .mode-label {
    font-size: var(--font-size-xs);
  }

  .snap-icon {
    font-size: var(--font-size-sm);
  }

  .snap-label {
    font-size: var(--font-size-xs);
  }

  .zoom-group {
    gap: 0;
  }

  .zoom-display {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    color: var(--text-secondary);
    min-width: 50px;
    text-align: center;
    border-radius: 0;
  }

  .zoom-display:hover {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }

  .selection-actions {
    background-color: var(--surface-sunken);
    padding: 2px;
    border-radius: var(--radius-md);
  }
</style>
