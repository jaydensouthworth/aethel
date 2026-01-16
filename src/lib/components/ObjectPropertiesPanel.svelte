<script lang="ts">
  import { ui, objects, timeline } from '$lib/stores';
  import { getObjectType } from '$lib/types';
  import type { AethelObject } from '$lib/types';
  import ColorPicker from './ColorPicker.svelte';
  import IconPicker from './IconPicker.svelte';

  // Derived values directly from stores
  const selectedObject = $derived(ui.selectedObject);
  const objectType = $derived(selectedObject ? getObjectType(selectedObject.typeId) : null);
  const objectState = $derived(selectedObject ? timeline.getObjectStateAtCursor(selectedObject.id) : null);

  // Color inheritance
  const effectiveColor = $derived(selectedObject ? objects.getEffectiveColor(selectedObject.id) : null);
  const isColorInherited = $derived(selectedObject ? objects.isColorInherited(selectedObject.id) : true);
  
  // Get parent's effective color for inheritance display
  const inheritedColor = $derived.by(() => {
    if (!selectedObject?.parentId) return objectType?.color;
    return objects.getEffectiveColor(selectedObject.parentId);
  });

  // Icon inheritance
  const isIconInherited = $derived(selectedObject ? objects.isIconInherited(selectedObject.id) : true);
  
  // Get parent's effective icon for inheritance display
  const inheritedIcon = $derived.by(() => {
    if (!selectedObject?.parentId) return objectType?.icon;
    return objects.getEffectiveIcon(selectedObject.parentId);
  });

  // Local state for editing
  let editingName = $state(false);
  let nameValue = $state('');
  let newAlias = $state('');
  let showMutationEditor = $state(false);
  let newMutationLabel = $state('');

  // Start editing name
  function handleEditName() {
    if (selectedObject) {
      nameValue = selectedObject.name;
      editingName = true;
    }
  }

  // Save name
  function handleSaveName() {
    if (selectedObject && nameValue.trim()) {
      objects.update(selectedObject.id, { name: nameValue.trim() });
    }
    editingName = false;
  }

  // Handle name keydown
  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      editingName = false;
    }
  }

  // Toggle rendered
  function handleToggleRendered() {
    if (selectedObject) {
      objects.update(selectedObject.id, { rendered: !selectedObject.rendered });
    }
  }

  // Add alias
  function handleAddAlias() {
    if (selectedObject && newAlias.trim()) {
      const newAliases = [...selectedObject.aliases, newAlias.trim()];
      objects.update(selectedObject.id, { aliases: newAliases });
      newAlias = '';
    }
  }

  // Remove alias
  function handleRemoveAlias(index: number) {
    if (selectedObject) {
      const newAliases = selectedObject.aliases.filter((_, i) => i !== index);
      objects.update(selectedObject.id, { aliases: newAliases });
    }
  }

  // Jump to mutation position
  function handleJumpToMutation(position: number) {
    timeline.setCursorPosition(position);
  }

  // Add new mutation
  function handleAddMutation() {
    if (selectedObject && newMutationLabel.trim()) {
      timeline.addMutation(
        selectedObject.id,
        timeline.cursorPosition,
        newMutationLabel.trim(),
        {},
        0
      );
      newMutationLabel = '';
      showMutationEditor = false;
    }
  }

  // Delete mutation
  function handleDeleteMutation(id: string) {
    timeline.removePlacement(id);
  }

  // Delete object
  function handleDeleteObject() {
    if (selectedObject && confirm(`Delete "${selectedObject.name}"? This cannot be undone.`)) {
      const id = selectedObject.id;
      ui.select(null);
      objects.delete(id);
      timeline.removeAllForObject(id);
    }
  }

  // Handle color change
  function handleColorChange(color: string | undefined) {
    if (selectedObject) {
      objects.update(selectedObject.id, { color });
    }
  }

  // Handle icon change
  function handleIconChange(icon: string | undefined) {
    if (selectedObject) {
      objects.update(selectedObject.id, { icon });
    }
  }
</script>

<div class="properties-panel" class:collapsed={ui.propertiesPanelCollapsed}>
  <button class="collapse-toggle" onclick={() => ui.togglePropertiesPanel()}>
    <span class="collapse-icon">{ui.propertiesPanelCollapsed ? '<' : '>'}</span>
    {#if ui.propertiesPanelCollapsed}
      <span class="collapse-label">Properties</span>
    {/if}
  </button>

  {#if !ui.propertiesPanelCollapsed}
    {#if selectedObject && objectType && objectState}
      <div class="panel-content">
        <header class="panel-header">
          {#if editingName}
            <input
              class="name-input"
              type="text"
              bind:value={nameValue}
              onblur={handleSaveName}
              onkeydown={handleNameKeydown}
            />
          {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <h2 class="object-name" ondblclick={handleEditName}>{selectedObject.name}</h2>
          {/if}
          <span class="type-badge" style:background-color="{effectiveColor}20" style:color={effectiveColor}>
            {objectType.name}
          </span>
        </header>

        <section class="section visual-section">
          <h3 class="section-title">Appearance</h3>
          <div class="visual-row">
            <div class="visual-item">
              <span class="visual-label">Icon</span>
              <IconPicker
                value={selectedObject.icon}
                inheritedIcon={inheritedIcon}
                onSelect={handleIconChange}
              />
            </div>
            <div class="visual-item">
              <span class="visual-label">Color</span>
              <ColorPicker
                value={selectedObject.color}
                inheritedColor={inheritedColor}
                onSelect={handleColorChange}
              />
            </div>
          </div>
          <span class="visual-info">
            {#if isIconInherited && isColorInherited}
              Inheriting from {selectedObject.parentId ? 'parent' : 'type'}
            {:else if !isIconInherited && !isColorInherited}
              Using custom icon and color
            {:else}
              Mixed inheritance
            {/if}
          </span>
        </section>

        <section class="section">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={selectedObject.rendered}
              onchange={handleToggleRendered}
            />
            Rendered in book
          </label>
        </section>

        <section class="section">
          <h3 class="section-title">Aliases</h3>
          <div class="aliases-list">
            {#each selectedObject.aliases as alias, i}
              <div class="alias-item">
                <span class="alias-text">{alias}</span>
                <button class="alias-remove" onclick={() => handleRemoveAlias(i)}>x</button>
              </div>
            {/each}
            <div class="alias-add">
              <input
                type="text"
                placeholder="Add alias..."
                bind:value={newAlias}
                onkeydown={(e) => e.key === 'Enter' && handleAddAlias()}
              />
              <button onclick={handleAddAlias} disabled={!newAlias.trim()}>+</button>
            </div>
          </div>
        </section>

        {#if Object.keys(objectState.computedAttributes).length > 0}
          <section class="section">
            <h3 class="section-title">State at position {timeline.cursorPosition}</h3>
            <div class="attributes-list">
              {#each Object.entries(objectState.computedAttributes) as [key, value]}
                <div class="attribute-item">
                  <span class="attribute-key">{key}:</span>
                  <span class="attribute-value">{String(value)}</span>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <section class="section">
          <h3 class="section-title">Mutations</h3>

          {#if objectState.mutations.length > 0}
            <div class="mutations-list">
              <div class="mutations-group">
                <span class="mutations-label">Applied (before cursor)</span>
                {#each objectState.mutations as mutation}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="mutation-item applied"
                    onclick={() => handleJumpToMutation(mutation.position)}
                  >
                    <span class="mutation-position">@{mutation.position}</span>
                    <span class="mutation-label">{mutation.mutation?.label}</span>
                    <button
                      class="mutation-delete"
                      onclick={(e) => { e.stopPropagation(); handleDeleteMutation(mutation.id); }}
                    >x</button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if objectState.futureMutations.length > 0}
            <div class="mutations-list">
              <div class="mutations-group future">
                <span class="mutations-label">Future (after cursor)</span>
                {#each objectState.futureMutations as mutation}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="mutation-item future"
                    onclick={() => handleJumpToMutation(mutation.position)}
                  >
                    <span class="mutation-position">@{mutation.position}</span>
                    <span class="mutation-label">{mutation.mutation?.label}</span>
                    <button
                      class="mutation-delete"
                      onclick={(e) => { e.stopPropagation(); handleDeleteMutation(mutation.id); }}
                    >x</button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if showMutationEditor}
            <div class="mutation-editor">
              <input
                type="text"
                placeholder="Mutation label..."
                bind:value={newMutationLabel}
                onkeydown={(e) => e.key === 'Enter' && handleAddMutation()}
              />
              <button onclick={handleAddMutation} disabled={!newMutationLabel.trim()}>Add</button>
              <button onclick={() => showMutationEditor = false}>Cancel</button>
            </div>
          {:else}
            <button class="add-mutation-btn" onclick={() => showMutationEditor = true}>
              + Add mutation at position {timeline.cursorPosition}
            </button>
          {/if}
        </section>

        <section class="section danger-zone">
          <button class="delete-btn" onclick={handleDeleteObject}>
            Delete object
          </button>
        </section>
      </div>
    {:else}
      <div class="empty-state">
        <p class="empty-text">Select an object to view its properties</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .properties-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--space-md);
    overflow-y: auto;
    background-color: var(--surface-raised);
    border-left: 1px solid var(--border-subtle);
    transition: width var(--transition-normal), padding var(--transition-normal);
  }

  .properties-panel.collapsed {
    width: 40px;
    min-width: 40px;
    padding: var(--space-sm);
    overflow: hidden;
  }

  .collapse-toggle {
    position: absolute;
    top: var(--space-sm);
    left: var(--space-sm);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs);
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    transition: background-color var(--transition-fast);
    z-index: 10;
  }

  .collapse-toggle:hover {
    background-color: var(--hover-bg);
  }

  .collapse-icon {
    width: 16px;
    text-align: center;
    font-weight: 600;
  }

  .collapse-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-muted);
    padding: var(--space-sm) 0;
  }

  .collapsed .collapse-toggle {
    position: static;
    flex-direction: column;
    width: 100%;
    border: none;
    padding: var(--space-xs) 0;
  }

  .panel-content {
    margin-top: calc(32px + var(--space-sm));
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    margin-top: calc(32px + var(--space-sm));
  }

  .empty-text {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--border-subtle);
  }

  .object-name {
    flex: 1;
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin: 0;
    cursor: pointer;
  }

  .object-name:hover {
    color: var(--text-secondary);
  }

  .name-input {
    flex: 1;
    font-size: var(--font-size-lg);
    font-weight: 600;
    padding: var(--space-xs);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
  }

  .type-badge {
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 500;
  }

  .section {
    margin-bottom: var(--space-md);
  }

  .section-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 var(--space-sm) 0;
  }

  .visual-section .visual-row {
    display: flex;
    gap: var(--space-lg);
    margin-bottom: var(--space-sm);
  }

  .visual-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .visual-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .visual-info {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .checkbox-label input {
    width: 16px;
    height: 16px;
  }

  .aliases-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .alias-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
  }

  .alias-text {
    flex: 1;
  }

  .alias-remove {
    padding: 0 var(--space-xs);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
  }

  .alias-remove:hover {
    color: var(--color-error, #ef4444);
  }

  .alias-add {
    display: flex;
    gap: var(--space-xs);
  }

  .alias-add input {
    flex: 1;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
  }

  .alias-add button {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
    cursor: pointer;
  }

  .alias-add button:hover:not(:disabled) {
    background-color: var(--hover-bg);
  }

  .alias-add button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attributes-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .attribute-item {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
  }

  .attribute-key {
    color: var(--text-secondary);
  }

  .attribute-value {
    color: var(--text-primary);
  }

  .mutations-list {
    margin-bottom: var(--space-sm);
  }

  .mutations-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .mutations-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
  }

  .mutation-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    background-color: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .mutation-item:hover {
    background-color: var(--hover-bg);
  }

  .mutation-item.future {
    opacity: 0.5;
  }

  .mutation-position {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .mutation-label {
    flex: 1;
  }

  .mutation-delete {
    padding: 0 var(--space-xs);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
  }

  .mutation-delete:hover {
    color: var(--color-error, #ef4444);
  }

  .mutation-editor {
    display: flex;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
  }

  .mutation-editor input {
    flex: 1;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
  }

  .mutation-editor button {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
    cursor: pointer;
  }

  .mutation-editor button:hover:not(:disabled) {
    background-color: var(--hover-bg);
  }

  .mutation-editor button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-mutation-btn {
    width: 100%;
    padding: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background-color: var(--surface-sunken);
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .add-mutation-btn:hover {
    background-color: var(--hover-bg);
    border-style: solid;
  }

  .danger-zone {
    margin-top: auto;
    padding-top: var(--space-md);
    border-top: 1px solid var(--border-subtle);
  }

  .delete-btn {
    width: 100%;
    padding: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--color-error, #ef4444);
    background-color: transparent;
    border: 1px solid var(--color-error, #ef4444);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .delete-btn:hover {
    background-color: var(--color-error, #ef4444);
    color: white;
  }
</style>
