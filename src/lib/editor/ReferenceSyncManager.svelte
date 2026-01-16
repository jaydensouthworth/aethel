<script lang="ts">
  /**
   * ReferenceSyncManager
   *
   * Watches the objects store and updates editor references when:
   * - An object is renamed: Update displayText in all matching references
   * - An object is deleted: Mark references as "unknown" status
   * - An object's color changes: Update the color attribute
   *
   * This component renders nothing but maintains sync via $effect.
   */

  import { getEditorContext } from './EditorContext.svelte';
  import { objects } from '$lib/stores/objects.svelte';
  import { getObjectType } from '$lib/types';

  const ctx = getEditorContext();

  // Track object state for change detection
  let previousObjects = $state<Map<string, { name: string; color: string | null }>>(new Map());

  // Initialize previous state
  $effect(() => {
    if (previousObjects.size === 0) {
      const initial = new Map<string, { name: string; color: string | null }>();
      for (const obj of objects.all) {
        const objType = getObjectType(obj.typeId);
        initial.set(obj.id, {
          name: obj.name,
          color: obj.color ?? objType.color,
        });
      }
      previousObjects = initial;
    }
  });

  // Watch for object changes and sync references
  $effect(() => {
    const editor = ctx.editor;
    if (!editor) return;

    const currentObjects = new Map<string, { name: string; color: string | null }>();
    for (const obj of objects.all) {
      const objType = getObjectType(obj.typeId);
      currentObjects.set(obj.id, {
        name: obj.name,
        color: obj.color ?? objType.color,
      });
    }

    // Find renamed objects
    const renamedObjects: Array<{ id: string; oldName: string; newName: string; newColor: string }> = [];
    const colorChangedObjects: Array<{ id: string; newColor: string }> = [];

    for (const [id, current] of currentObjects) {
      const previous = previousObjects.get(id);
      if (previous) {
        if (previous.name !== current.name) {
          renamedObjects.push({
            id,
            oldName: previous.name,
            newName: current.name,
            newColor: current.color ?? '#3b82f6',
          });
        } else if (previous.color !== current.color) {
          colorChangedObjects.push({
            id,
            newColor: current.color ?? '#3b82f6',
          });
        }
      }
    }

    // Find deleted objects
    const deletedIds: string[] = [];
    for (const id of previousObjects.keys()) {
      if (!currentObjects.has(id)) {
        deletedIds.push(id);
      }
    }

    // Apply updates to editor
    if (renamedObjects.length > 0 || colorChangedObjects.length > 0 || deletedIds.length > 0) {
      const { tr } = editor.state;
      let modified = false;

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'objectRef') {
          const objectId = node.attrs.objectId;

          // Check for rename
          const renamed = renamedObjects.find((r) => r.id === objectId);
          if (renamed) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              displayText: renamed.newName,
              color: renamed.newColor,
            });
            modified = true;
            return false; // Don't descend into this node
          }

          // Check for color change
          const colorChanged = colorChangedObjects.find((c) => c.id === objectId);
          if (colorChanged) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              color: colorChanged.newColor,
            });
            modified = true;
            return false;
          }

          // Check for deletion
          if (deletedIds.includes(objectId)) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              status: 'unknown',
            });
            modified = true;
            return false;
          }
        }
      });

      if (modified) {
        editor.view.dispatch(tr);
      }
    }

    // Update previous state
    previousObjects = currentObjects;
  });
</script>

<!-- This component renders nothing, it only provides sync functionality -->
