<script lang="ts">
  import type { ObjectSection } from '$lib/types';

  interface Props {
    sections: ObjectSection[];
    activeSectionId: string;
    onSelect: (sectionId: string) => void;
    onAdd: () => void;
    onRemove: (sectionId: string) => void;
    onRename: (sectionId: string, newName: string) => void;
  }

  let { sections, activeSectionId, onSelect, onAdd, onRemove, onRename }: Props = $props();

  // Sort sections by sortOrder
  const sortedSections = $derived([...sections].sort((a, b) => a.sortOrder - b.sortOrder));

  // Editing state
  let editingId = $state<string | null>(null);
  let editingName = $state('');

  // Context menu state
  let contextMenuId = $state<string | null>(null);
  let contextMenuPos = $state({ x: 0, y: 0 });

  function handleTabClick(sectionId: string) {
    if (editingId !== sectionId) {
      onSelect(sectionId);
    }
  }

  function handleDoubleClick(section: ObjectSection) {
    editingId = section.id;
    editingName = section.name;
  }

  function handleContextMenu(e: MouseEvent, sectionId: string) {
    e.preventDefault();
    contextMenuId = sectionId;
    contextMenuPos = { x: e.clientX, y: e.clientY };
  }

  function closeContextMenu() {
    contextMenuId = null;
  }

  function handleRenameStart(section: ObjectSection) {
    editingId = section.id;
    editingName = section.name;
    closeContextMenu();
  }

  function handleRenameSubmit() {
    if (editingId && editingName.trim()) {
      onRename(editingId, editingName.trim());
    }
    editingId = null;
    editingName = '';
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      editingId = null;
      editingName = '';
    }
  }

  function handleDelete(sectionId: string) {
    closeContextMenu();
    if (sections.length > 1) {
      onRemove(sectionId);
    }
  }
</script>

<div class="section-tabs">
  <div class="tabs-container">
    {#each sortedSections as section (section.id)}
      <button
        class="section-tab"
        class:active={section.id === activeSectionId}
        class:editing={section.id === editingId}
        onclick={() => handleTabClick(section.id)}
        ondblclick={() => handleDoubleClick(section)}
        oncontextmenu={(e) => handleContextMenu(e, section.id)}
        title={section.name}
      >
        {#if section.id === editingId}
          <input
            type="text"
            class="rename-input"
            value={editingName}
            oninput={(e) => editingName = (e.target as HTMLInputElement).value}
            onkeydown={handleRenameKeydown}
            onblur={handleRenameSubmit}
            autofocus
          />
        {:else}
          <span class="tab-label">{section.name}</span>
        {/if}
      </button>
    {/each}

    <button class="add-section-btn" onclick={onAdd} title="Add section">
      <span class="plus-icon">+</span>
    </button>
  </div>

  <span class="section-count">{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
</div>

{#if contextMenuId}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="context-backdrop" onclick={closeContextMenu}></div>
  <div class="context-menu" style:left="{contextMenuPos.x}px" style:top="{contextMenuPos.y}px">
    <button class="context-item" onclick={() => {
      const section = sections.find(s => s.id === contextMenuId);
      if (section) handleRenameStart(section);
    }}>
      Rename
    </button>
    {#if sections.length > 1}
      <button class="context-item danger" onclick={() => handleDelete(contextMenuId!)}>
        Delete
      </button>
    {/if}
  </div>
{/if}

<style>
  .section-tabs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 var(--space-sm);
    background-color: var(--surface-sunken);
    border-bottom: 1px solid var(--border-subtle);
  }

  .tabs-container {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    overflow-x: auto;
  }

  .section-tab {
    display: flex;
    align-items: center;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-secondary);
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    max-width: 150px;
  }

  .section-tab:hover {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }

  .section-tab.active {
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border-color: var(--color-primary);
    color: var(--text-primary);
  }

  .section-tab.editing {
    padding: 0;
  }

  .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rename-input {
    width: 100px;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    font-weight: 500;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
    outline: none;
  }

  .add-section-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: 16px;
    color: var(--text-muted);
    background-color: transparent;
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .add-section-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    border-style: solid;
  }

  .plus-icon {
    line-height: 1;
  }

  .section-count {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .context-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .context-menu {
    position: fixed;
    z-index: 100;
    min-width: 120px;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    padding: var(--space-xs);
  }

  .context-item {
    display: block;
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    text-align: left;
    color: var(--text-primary);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .context-item:hover {
    background-color: var(--hover-bg);
  }

  .context-item.danger {
    color: var(--color-danger, #ef4444);
  }

  .context-item.danger:hover {
    background-color: color-mix(in srgb, var(--color-danger, #ef4444) 10%, transparent);
  }
</style>
