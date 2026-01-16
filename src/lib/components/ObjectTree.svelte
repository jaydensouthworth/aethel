<script lang="ts">
  import { objects, ui } from '$lib/stores';
  import ObjectTreeItem from './ObjectTreeItem.svelte';
  import type { AethelObject } from '$lib/types';

  interface Props {
    oncontextmenu?: (e: MouseEvent, obj: AethelObject) => void;
  }

  let { oncontextmenu }: Props = $props();

  // Get root objects sorted: folders first, then by name
  const rootObjects = $derived.by(() => {
    return [...objects.roots].sort((a, b) => {
      // Folders first
      const aIsFolder = a.typeId === 'folder';
      const bIsFolder = b.typeId === 'folder';
      if (aIsFolder !== bIsFolder) {
        return aIsFolder ? -1 : 1;
      }
      // Then by name
      return a.name.localeCompare(b.name);
    });
  });

  function handleCreateRootFolder() {
    const name = prompt('Enter name for new folder:');
    if (name?.trim()) {
      const obj = objects.create(name.trim(), 'folder');
      ui.setTreeExpanded(obj.id, true);
      ui.select(obj.id);
    }
  }
</script>

<div class="object-tree">
  <div class="tree-header">
    <span class="tree-title">Project</span>
    <button class="tree-action" title="Add folder" onclick={handleCreateRootFolder}>+</button>
  </div>

  <div class="tree-content">
    {#if rootObjects.length > 0}
      {#each rootObjects as obj (obj.id)}
        <ObjectTreeItem {obj} depth={0} {oncontextmenu} />
      {/each}
    {:else}
      <div class="empty-state">
        <p>No objects yet</p>
        <p class="hint">Create your first folder or object</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .object-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--surface-raised);
  }

  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    border-bottom: 1px solid var(--border-subtle);
  }

  .tree-title {
    font-weight: 600;
    font-size: var(--font-size-md);
    color: var(--text-primary);
  }

  .tree-action {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: var(--font-size-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color var(--transition-fast);
  }

  .tree-action:hover {
    background-color: var(--hover-bg);
  }

  .tree-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm) 0;
  }

  .empty-state {
    padding: var(--space-xl) var(--space-md);
    text-align: center;
    color: var(--text-secondary);
  }

  .empty-state p {
    margin: 0;
  }

  .empty-state .hint {
    font-size: var(--font-size-sm);
    margin-top: var(--space-xs);
    color: var(--text-muted);
  }
</style>
