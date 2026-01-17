<script lang="ts">
  import { timelineHistory } from '$lib/stores';

  const canUndo = $derived(timelineHistory.canUndo);
  const canRedo = $derived(timelineHistory.canRedo);
  const undoDescription = $derived(timelineHistory.undoDescription);
  const redoDescription = $derived(timelineHistory.redoDescription);

  function handleUndo() {
    timelineHistory.undo();
  }

  function handleRedo() {
    timelineHistory.redo();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Cmd/Ctrl+Z for undo, Cmd/Ctrl+Shift+Z for redo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        if (canRedo) handleRedo();
      } else {
        if (canUndo) handleUndo();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="timeline-header">
  <div class="header-controls">
    <button
      class="header-btn"
      onclick={handleUndo}
      disabled={!canUndo}
      title={canUndo ? `Undo: ${undoDescription}` : 'Nothing to undo'}
    >
      <span class="btn-icon">↩</span>
    </button>
    <button
      class="header-btn"
      onclick={handleRedo}
      disabled={!canRedo}
      title={canRedo ? `Redo: ${redoDescription}` : 'Nothing to redo'}
    >
      <span class="btn-icon">↪</span>
    </button>
  </div>

  <div class="header-status">
    {#if canUndo || canRedo}
      <span class="status-text">
        {#if undoDescription}
          Last: {undoDescription}
        {/if}
      </span>
    {/if}
  </div>
</div>

<style>
  .timeline-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 12px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .header-controls {
    display: flex;
    gap: 2px;
  }

  .header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 24px;
    font-size: 14px;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .header-btn:hover:not(:disabled) {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .header-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .header-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .btn-icon {
    font-size: 13px;
    line-height: 1;
  }

  .header-status {
    flex: 1;
    min-width: 0;
  }

  .status-text {
    font-size: 0.6875rem;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
