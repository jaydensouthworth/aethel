<script lang="ts">
  import { getEditorContext } from '../EditorContext.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import ContextMenuItem from './ContextMenuItem.svelte';
  import { objects } from '$lib/stores/objects.svelte';

  const ctx = getEditorContext();

  // State for the context menu
  let menuState = $state<{
    open: boolean;
    x: number;
    y: number;
    objectId: string;
    displayText: string;
    pos: number;
  }>({
    open: false,
    x: 0,
    y: 0,
    objectId: '',
    displayText: '',
    pos: 0,
  });

  // State for inline text editing
  let isEditingText = $state(false);
  let editTextValue = $state('');

  // State for viewing mutations
  let showMutationsPanel = $state(false);

  // State for alias editor
  let showAliasEditor = $state(false);

  // Listen for right-click events from the editor
  $effect(() => {
    const unsubscribe = ctx.on('ref:rightclick', (data) => {
      menuState = {
        open: true,
        x: data.clientX,
        y: data.clientY,
        objectId: data.objectId,
        displayText: data.displayText,
        pos: data.pos,
      };
      // Reset sub-states
      isEditingText = false;
      editTextValue = data.displayText;
      showMutationsPanel = false;
      showAliasEditor = false;
    });

    return unsubscribe;
  });

  function closeMenu() {
    menuState.open = false;
    isEditingText = false;
    showMutationsPanel = false;
    showAliasEditor = false;
  }

  function handleGoTo() {
    ctx.selectObject(menuState.objectId);
    ctx.emit('ref:navigate', { objectId: menuState.objectId });
    closeMenu();
  }

  function handleRemoveReference() {
    const editor = ctx.editor;
    if (editor) {
      // Delete the node at the stored position
      editor
        .chain()
        .focus()
        .setNodeSelection(menuState.pos)
        .deleteSelection()
        .run();
    }
    ctx.emit('ref:remove', { pos: menuState.pos });
    closeMenu();
  }

  function handleUpdateAtTimeline() {
    // This will open the MutationMiniEditor
    ctx.emit('mutation:open', { objectId: menuState.objectId });
    closeMenu();
  }

  function handleEditText() {
    isEditingText = true;
  }

  function handleSaveText() {
    const editor = ctx.editor;
    if (editor && editTextValue.trim() !== menuState.displayText) {
      // Update the ObjectRef node's displayText attribute
      const { state } = editor;
      const pos = menuState.pos;

      // Find the node at this position
      const node = state.doc.nodeAt(pos);
      if (node && node.type.name === 'objectRef') {
        editor.chain()
          .focus()
          .setNodeSelection(pos)
          .updateAttributes('objectRef', { displayText: editTextValue.trim() })
          .run();
      }
    }
    isEditingText = false;
    closeMenu();
  }

  function handleCancelEdit() {
    isEditingText = false;
    editTextValue = menuState.displayText;
  }

  function handleEditTextKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveText();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }

  function handleViewMutations() {
    showMutationsPanel = !showMutationsPanel;
  }

  function handleEditAliases() {
    showAliasEditor = !showAliasEditor;
  }

  // Get object info for display
  const objectInfo = $derived(() => {
    const obj = ctx.getObject(menuState.objectId);
    return obj;
  });

  // Get mutations for this object
  const objectMutations = $derived(() => {
    if (!menuState.objectId) return { past: [], future: [] };
    return ctx.getObjectMutations(menuState.objectId);
  });

  // Get current aliases
  const currentAliases = $derived(() => {
    const obj = objectInfo();
    return obj?.aliases ?? [];
  });
</script>

<ContextMenu
  open={menuState.open}
  x={menuState.x}
  y={menuState.y}
  onClose={closeMenu}
>
  <!-- Header showing the reference -->
  <div class="menu-header">
    <span class="ref-label">{menuState.displayText}</span>
    {#if objectInfo()}
      <span class="ref-type">{objectInfo()?.typeId}</span>
    {/if}
  </div>

  <div class="menu-divider"></div>

  <ContextMenuItem onclick={handleGoTo}>
    {#snippet icon()}&#8594;{/snippet}
    Go to object
  </ContextMenuItem>

  <!-- Edit reference text -->
  {#if isEditingText}
    <div class="edit-text-row">
      <input
        type="text"
        class="edit-text-input"
        bind:value={editTextValue}
        onkeydown={handleEditTextKeydown}
      />
      <button class="edit-btn save" onclick={handleSaveText} title="Save">&#10003;</button>
      <button class="edit-btn cancel" onclick={handleCancelEdit} title="Cancel">&#10005;</button>
    </div>
  {:else}
    <ContextMenuItem onclick={handleEditText}>
      {#snippet icon()}&#9998;{/snippet}
      Edit reference text
    </ContextMenuItem>
  {/if}

  <!-- View mutations -->
  <ContextMenuItem onclick={handleViewMutations}>
    {#snippet icon()}&#9719;{/snippet}
    {showMutationsPanel ? 'Hide mutations' : 'View mutations'}
    {#if objectMutations().past.length + objectMutations().future.length > 0}
      <span class="badge">{objectMutations().past.length + objectMutations().future.length}</span>
    {/if}
  </ContextMenuItem>

  {#if showMutationsPanel}
    <div class="mutations-panel">
      {#if objectMutations().past.length === 0 && objectMutations().future.length === 0}
        <div class="no-mutations">No mutations</div>
      {:else}
        {#if objectMutations().past.length > 0}
          <div class="mutation-section">
            <div class="mutation-section-label">Past</div>
            {#each objectMutations().past as mutation}
              <button class="mutation-item" onclick={() => {}}>
                <span class="mutation-label">{mutation.mutation?.label || 'Unnamed'}</span>
                <span class="mutation-position">@{mutation.position}</span>
              </button>
            {/each}
          </div>
        {/if}
        {#if objectMutations().future.length > 0}
          <div class="mutation-section">
            <div class="mutation-section-label">Future</div>
            {#each objectMutations().future as mutation}
              <button class="mutation-item" onclick={() => {}}>
                <span class="mutation-label">{mutation.mutation?.label || 'Unnamed'}</span>
                <span class="mutation-position">@{mutation.position}</span>
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- Edit aliases -->
  <ContextMenuItem onclick={handleEditAliases}>
    {#snippet icon()}+{/snippet}
    {showAliasEditor ? 'Hide aliases' : 'Add/edit aliases'}
    {#if currentAliases().length > 0}
      <span class="badge">{currentAliases().length}</span>
    {/if}
  </ContextMenuItem>

  {#if showAliasEditor}
    <div class="alias-panel">
      <div class="alias-list">
        {#each currentAliases() as alias, i}
          <span class="alias-chip">
            {alias}
            <button
              class="alias-remove"
              onclick={() => {
                const newAliases = currentAliases().filter((_, idx) => idx !== i);
                objects.update(menuState.objectId, { aliases: newAliases });
              }}
            >&#10005;</button>
          </span>
        {/each}
      </div>
      <form
        class="add-alias-form"
        onsubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget as HTMLFormElement;
          const input = form.querySelector('input') as HTMLInputElement;
          const newAlias = input.value.trim();
          if (newAlias && !currentAliases().includes(newAlias)) {
            objects.update(menuState.objectId, { aliases: [...currentAliases(), newAlias] });
            input.value = '';
          }
        }}
      >
        <input type="text" placeholder="Add alias..." class="alias-input" />
        <button type="submit" class="alias-add-btn">+</button>
      </form>
    </div>
  {/if}

  <div class="menu-divider"></div>

  <ContextMenuItem onclick={handleUpdateAtTimeline}>
    {#snippet icon()}&#8853;{/snippet}
    Update at timeline
  </ContextMenuItem>

  <div class="menu-divider"></div>

  <ContextMenuItem danger onclick={handleRemoveReference}>
    {#snippet icon()}&#10005;{/snippet}
    Remove reference
  </ContextMenuItem>
</ContextMenu>

<style>
  .menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
  }

  .ref-label {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }

  .ref-type {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border-subtle);
    margin: var(--space-xs) 0;
  }

  .badge {
    font-size: 0.7rem;
    background-color: var(--accent-color, #3b82f6);
    color: white;
    padding: 0.1em 0.4em;
    border-radius: 8px;
    margin-left: auto;
  }

  /* Edit text row */
  .edit-text-row {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
  }

  .edit-text-input {
    flex: 1;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    background-color: var(--surface-base);
    color: var(--text-primary);
  }

  .edit-text-input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .edit-btn {
    padding: var(--space-xs);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    line-height: 1;
  }

  .edit-btn.save {
    background-color: #22c55e20;
    color: #22c55e;
  }

  .edit-btn.cancel {
    background-color: #ef444420;
    color: #ef4444;
  }

  /* Mutations panel */
  .mutations-panel {
    padding: var(--space-xs) var(--space-sm);
    max-height: 200px;
    overflow-y: auto;
  }

  .no-mutations {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-sm);
  }

  .mutation-section {
    margin-bottom: var(--space-sm);
  }

  .mutation-section-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
    letter-spacing: 0.5px;
  }

  .mutation-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    border: none;
    background-color: transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: var(--text-primary);
    text-align: left;
  }

  .mutation-item:hover {
    background-color: var(--hover-bg, rgba(0, 0, 0, 0.05));
  }

  .mutation-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mutation-position {
    font-size: 0.65rem;
    color: var(--text-muted);
    margin-left: var(--space-sm);
  }

  /* Alias panel */
  .alias-panel {
    padding: var(--space-xs) var(--space-sm);
  }

  .alias-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-bottom: var(--space-sm);
  }

  .alias-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0.15em 0.5em;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .alias-remove {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 0.7em;
    color: var(--text-muted);
    line-height: 1;
  }

  .alias-remove:hover {
    color: #ef4444;
  }

  .add-alias-form {
    display: flex;
    gap: var(--space-xs);
  }

  .alias-input {
    flex: 1;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    background-color: var(--surface-base);
    color: var(--text-primary);
  }

  .alias-input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .alias-add-btn {
    padding: var(--space-xs) var(--space-sm);
    border: none;
    background-color: var(--accent-color, #3b82f6);
    color: white;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .alias-add-btn:hover {
    opacity: 0.9;
  }
</style>
