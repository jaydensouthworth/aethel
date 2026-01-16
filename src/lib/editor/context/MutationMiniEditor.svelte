<script lang="ts">
  import { getEditorContext } from '../EditorContext.svelte';

  const ctx = getEditorContext();

  // State for the mini editor
  let editorState = $state<{
    open: boolean;
    objectId: string;
    label: string;
  }>({
    open: false,
    objectId: '',
    label: '',
  });

  // Listen for mutation:open events
  $effect(() => {
    const unsubscribe = ctx.on('mutation:open', (data) => {
      const obj = ctx.getObject(data.objectId);
      editorState = {
        open: true,
        objectId: data.objectId,
        label: obj ? `Update to ${obj.name}` : 'Update',
      };
    });

    return unsubscribe;
  });

  // Get object info
  const objectInfo = $derived(() => {
    if (!editorState.objectId) return null;
    return ctx.getObject(editorState.objectId);
  });

  // Get current timeline position
  const timelinePosition = $derived(() => {
    return ctx.getCursorPosition();
  });

  function closeEditor() {
    editorState.open = false;
    editorState.label = '';
  }

  function handleSave() {
    if (!editorState.objectId || !editorState.label.trim()) {
      return;
    }

    // Create a mutation at the current timeline position
    ctx.addMutation(editorState.objectId, editorState.label.trim(), {
      // Empty changes for now - user can edit later
    });

    ctx.emit('mutation:create', {
      objectId: editorState.objectId,
      label: editorState.label.trim(),
      changes: {},
    });

    closeEditor();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      closeEditor();
    }
  }

  function handleBackdropClick() {
    closeEditor();
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && editorState.open) {
      closeEditor();
    }
  }}
/>

{#if editorState.open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="mini-editor-backdrop" onclick={handleBackdropClick}></div>

  <div class="mini-editor">
    <div class="mini-editor-header">
      <span class="header-title">Create Timeline Mutation</span>
      <button class="close-btn" onclick={closeEditor}>&#10005;</button>
    </div>

    <div class="mini-editor-content">
      <!-- Object info -->
      {#if objectInfo()}
        <div class="object-info">
          <span
            class="object-badge"
            style:background-color="{ctx.getEffectiveColor(editorState.objectId)}20"
            style:color={ctx.getEffectiveColor(editorState.objectId)}
            style:border-color="{ctx.getEffectiveColor(editorState.objectId)}40"
          >
            {objectInfo()?.name}
          </span>
          <span class="timeline-pos">
            at position {timelinePosition()}
          </span>
        </div>
      {/if}

      <!-- Label input -->
      <div class="input-group">
        <label for="mutation-label">Description</label>
        <input
          id="mutation-label"
          type="text"
          bind:value={editorState.label}
          onkeydown={handleKeydown}
          placeholder="What changed?"
          autofocus
        />
        <span class="input-hint">Press Enter to save, Escape to cancel</span>
      </div>
    </div>

    <div class="mini-editor-footer">
      <button class="btn-secondary" onclick={closeEditor}>Cancel</button>
      <button
        class="btn-primary"
        onclick={handleSave}
        disabled={!editorState.label.trim()}
      >
        Create Mutation
      </button>
    </div>
  </div>
{/if}

<style>
  .mini-editor-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 999;
    animation: fadeIn 0.15s ease-out;
  }

  .mini-editor {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    width: 400px;
    max-width: 90vw;
    background-color: var(--surface-overlay, var(--surface-raised));
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl, 0 8px 32px rgba(0, 0, 0, 0.25));
    animation: slideIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  .mini-editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-title {
    font-weight: 600;
    font-size: var(--font-size-md);
    color: var(--text-primary);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }

  .mini-editor-content {
    padding: var(--space-md);
  }

  .object-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }

  .object-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.2em 0.6em;
    border-radius: 4px;
    border: 1px solid;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .timeline-pos {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .input-group label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-secondary);
  }

  .input-group input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
    color: var(--text-primary);
    font-size: var(--font-size-md);
    transition: border-color var(--transition-fast);
  }

  .input-group input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 0 0 3px var(--focus-ring, rgba(59, 130, 246, 0.2));
  }

  .input-hint {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .mini-editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md);
    border-top: 1px solid var(--border-subtle);
  }

  .btn-secondary,
  .btn-primary {
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-secondary {
    background-color: transparent;
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }

  .btn-primary {
    background-color: var(--accent-color, #3b82f6);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
