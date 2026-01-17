<script lang="ts">
  import { threads, timelineEditor } from '$lib/stores';
  import { createThread, updateThread, deleteThread } from '$lib/services/timeline-operations';

  interface Props {
    collapsed?: boolean;
  }

  let { collapsed = false }: Props = $props();

  const allThreads = $derived(threads.all);

  // Color palette for new threads
  const colorPalette = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];

  let isCreating = $state(false);
  let newThreadName = $state('');
  let newThreadColor = $state(colorPalette[0]);

  function handleCreateThread() {
    if (!newThreadName.trim()) return;

    createThread(newThreadName.trim(), newThreadColor);

    // Reset form
    newThreadName = '';
    newThreadColor = colorPalette[(colorPalette.indexOf(newThreadColor) + 1) % colorPalette.length];
    isCreating = false;
  }

  function handleDeleteThread(threadId: string) {
    if (confirm('Delete this thread? Items will be removed from the thread but not deleted.')) {
      deleteThread(threadId);
    }
  }

  function handleToggleVisibility(threadId: string) {
    timelineEditor.toggleThreadVisibility(threadId);
  }

  function handleToggleLines(threadId: string) {
    const thread = threads.get(threadId);
    if (thread) {
      updateThread(threadId, { showConnectingLines: !thread.showConnectingLines });
    }
  }

  function handleColorChange(threadId: string, color: string) {
    updateThread(threadId, { color });
  }

  function handleRename(threadId: string, newName: string) {
    if (newName.trim()) {
      updateThread(threadId, { name: newName.trim() });
    }
  }
</script>

<div class="thread-manager" class:collapsed>
  <div class="manager-header">
    <h3 class="manager-title">Threads</h3>
    <span class="thread-count">{allThreads.length}</span>
  </div>

  {#if !collapsed}
    <div class="thread-list">
      {#each allThreads as thread (thread.id)}
        {@const isVisible = timelineEditor.isThreadVisible(thread.id)}
        <div class="thread-item" class:visible={isVisible}>
          <!-- Color indicator -->
          <input
            type="color"
            class="thread-color"
            value={thread.color}
            onchange={(e) => handleColorChange(thread.id, e.currentTarget.value)}
            title="Change color"
          />

          <!-- Name (editable) -->
          <input
            type="text"
            class="thread-name"
            value={thread.name}
            onblur={(e) => handleRename(thread.id, e.currentTarget.value)}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
          />

          <!-- Controls -->
          <div class="thread-controls">
            <!-- Visibility toggle -->
            <button
              class="control-btn"
              class:active={isVisible}
              onclick={() => handleToggleVisibility(thread.id)}
              title={isVisible ? 'Hide thread' : 'Show thread'}
            >
              {isVisible ? '👁' : '👁‍🗨'}
            </button>

            <!-- Lines toggle -->
            <button
              class="control-btn"
              class:active={thread.showConnectingLines}
              onclick={() => handleToggleLines(thread.id)}
              title={thread.showConnectingLines ? 'Hide lines' : 'Show lines'}
            >
              ⟿
            </button>

            <!-- Delete -->
            <button
              class="control-btn delete"
              onclick={() => handleDeleteThread(thread.id)}
              title="Delete thread"
            >
              ×
            </button>
          </div>
        </div>
      {/each}

      {#if allThreads.length === 0}
        <p class="empty-hint">No threads yet. Create one to track narrative arcs.</p>
      {/if}
    </div>

    <!-- Create new thread -->
    {#if isCreating}
      <div class="create-form">
        <input
          type="color"
          class="thread-color"
          bind:value={newThreadColor}
        />
        <input
          type="text"
          class="thread-name-input"
          placeholder="Thread name..."
          bind:value={newThreadName}
          onkeydown={(e) => {
            if (e.key === 'Enter') handleCreateThread();
            if (e.key === 'Escape') isCreating = false;
          }}
        />
        <button class="create-btn confirm" onclick={handleCreateThread} disabled={!newThreadName.trim()}>
          Add
        </button>
        <button class="create-btn cancel" onclick={() => isCreating = false}>
          ×
        </button>
      </div>
    {:else}
      <button class="add-thread-btn" onclick={() => isCreating = true}>
        + New Thread
      </button>
    {/if}
  {/if}
</div>

<style>
  .thread-manager {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-sm);
    background-color: var(--surface-raised);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }

  .thread-manager.collapsed {
    padding: var(--space-xs) var(--space-sm);
  }

  .manager-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .manager-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .thread-count {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    background-color: var(--surface-sunken);
    padding: 0 var(--space-xs);
    border-radius: var(--radius-sm);
  }

  .thread-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .thread-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-sm);
    opacity: 0.6;
    transition: opacity var(--transition-fast);
  }

  .thread-item.visible {
    opacity: 1;
  }

  .thread-color {
    width: 20px;
    height: 20px;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    flex-shrink: 0;
  }

  .thread-color::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .thread-color::-webkit-color-swatch {
    border: none;
    border-radius: var(--radius-sm);
  }

  .thread-name {
    flex: 1;
    font-size: var(--font-size-xs);
    color: var(--text-primary);
    background: transparent;
    border: none;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
  }

  .thread-name:focus {
    background-color: var(--surface-default);
    outline: 1px solid var(--focus-ring);
  }

  .thread-controls {
    display: flex;
    gap: 2px;
  }

  .control-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-tertiary);
    transition: all var(--transition-fast);
  }

  .control-btn:hover {
    background-color: var(--surface-default);
    color: var(--text-primary);
  }

  .control-btn.active {
    color: var(--accent-primary);
  }

  .control-btn.delete:hover {
    background-color: var(--error-bg);
    color: var(--error-text);
  }

  .empty-hint {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    text-align: center;
    padding: var(--space-sm);
  }

  .create-form {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-sm);
  }

  .thread-name-input {
    flex: 1;
    font-size: var(--font-size-xs);
    padding: 4px 8px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background-color: var(--surface-default);
  }

  .thread-name-input:focus {
    outline: none;
    border-color: var(--focus-ring);
  }

  .create-btn {
    padding: 4px 8px;
    font-size: var(--font-size-xs);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .create-btn.confirm {
    background-color: var(--accent-primary);
    color: white;
  }

  .create-btn.confirm:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .create-btn.confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-btn.cancel {
    background-color: var(--surface-default);
    color: var(--text-secondary);
  }

  .create-btn.cancel:hover {
    background-color: var(--hover-bg);
  }

  .add-thread-btn {
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    background-color: transparent;
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .add-thread-btn:hover {
    background-color: var(--surface-sunken);
    border-color: var(--border-strong);
    color: var(--text-secondary);
  }
</style>
