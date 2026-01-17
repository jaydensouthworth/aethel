/**
 * Object registry store
 * Uses Svelte 5 Runes for reactivity
 */

import type { AethelObject } from '$lib/types';
import { createObject, getObjectType } from '$lib/types';

class ObjectsStore {
  // ============================================================================
  // Core State
  // ============================================================================

  _objectsById = $state<Record<string, AethelObject>>({});

  // ============================================================================
  // Derived State
  // ============================================================================

  // All objects as array - use $derived.by for explicit dependency tracking
  all = $derived.by(() => {
    // Access _objectsById explicitly to ensure reactivity tracking
    const byId = this._objectsById;
    return Object.values(byId);
  });

  // Thread objects (objects that can be used as narrative threads)
  threadObjects = $derived(this.all.filter((o) => o.isThread));

  // Lookup by name/alias
  byName = $derived.by(() => {
    const map = new Map<string, AethelObject>();
    for (const obj of this.all) {
      map.set(obj.name.toLowerCase(), obj);
      for (const alias of obj.aliases) {
        map.set(alias.toLowerCase(), obj);
      }
    }
    return map;
  });

  // Tree structure: objects grouped by parent
  byParent = $derived.by(() => {
    const map = new Map<string | null, AethelObject[]>();
    for (const obj of this.all) {
      const parentId = obj.parentId;
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId)!.push(obj);
    }
    // Sort children by sortOrder, then by name
    for (const children of map.values()) {
      children.sort((a, b) => {
        const aOrder = a.sortOrder ?? Infinity;
        const bOrder = b.sortOrder ?? Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
    }
    return map;
  });

  // Root objects (no parent)
  roots = $derived(this.byParent.get(null) ?? []);

  // Get the raw map (for imperative access)
  get map(): Record<string, AethelObject> {
    return this._objectsById;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  add(obj: AethelObject): void {
    // Create new object reference to ensure reactivity
    this._objectsById = {
      ...this._objectsById,
      [obj.id]: obj,
    };
  }

  update(id: string, updates: Partial<AethelObject>): void {
    if (!this._objectsById[id]) return;
    // Create a completely new object reference to ensure Svelte 5 reactivity triggers
    this._objectsById = {
      ...this._objectsById,
      [id]: {
        ...this._objectsById[id],
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  delete(id: string): void {
    // Collect all IDs to delete (object + all descendants)
    const idsToDelete = new Set<string>();

    const collectDescendants = (objId: string) => {
      idsToDelete.add(objId);
      for (const obj of Object.values(this._objectsById)) {
        if (obj.parentId === objId) {
          collectDescendants(obj.id);
        }
      }
    };

    collectDescendants(id);

    // Create new object without deleted IDs
    const newObjectsById: Record<string, AethelObject> = {};
    for (const [objId, obj] of Object.entries(this._objectsById)) {
      if (!idsToDelete.has(objId)) {
        newObjectsById[objId] = obj;
      }
    }

    this._objectsById = newObjectsById;
  }

  get(id: string): AethelObject | undefined {
    return this._objectsById[id];
  }

  getByName(name: string): AethelObject | undefined {
    return this.byName.get(name.toLowerCase());
  }

  getAllMatches(word: string): AethelObject[] {
    const searchTerm = word.toLowerCase().trim();
    if (searchTerm.length < 2) return [];

    const matches = new Map<string, AethelObject>();

    for (const obj of this.all) {
      if (obj.name.toLowerCase() === searchTerm) {
        matches.set(obj.id, obj);
        continue;
      }
      for (const alias of obj.aliases) {
        if (alias.toLowerCase() === searchTerm) {
          matches.set(obj.id, obj);
          break;
        }
      }
    }

    return [...matches.values()];
  }

  getChildren(parentId: string | null): AethelObject[] {
    return this.byParent.get(parentId) ?? [];
  }

  create(name: string, typeId: string, parentId: string | null = null): AethelObject {
    const obj = createObject(name, typeId, parentId);
    this.add(obj);
    return obj;
  }

  // ============================================================================
  // Thread Operations
  // ============================================================================

  toggleThread(objectId: string, isThread?: boolean): void {
    const obj = this._objectsById[objectId];
    if (!obj) return;
    const newIsThread = isThread ?? !obj.isThread;
    this.update(objectId, {
      isThread: newIsThread,
      // Set default thread color if enabling and no color set
      threadColor: newIsThread && !obj.threadColor ? obj.color ?? getObjectType(obj.typeId).color : obj.threadColor,
    });
  }

  setThreadColor(objectId: string, color: string): void {
    this.update(objectId, { threadColor: color });
  }

  getEffectiveThreadColor(objectId: string): string {
    const obj = this._objectsById[objectId];
    if (!obj) return '#78716c';
    return obj.threadColor ?? obj.color ?? getObjectType(obj.typeId).color;
  }

  // ============================================================================
  // Hierarchy Operations
  // ============================================================================

  isDescendant(potentialDescendant: string | null, objectId: string): boolean {
    return this._isDescendantOf(potentialDescendant, objectId);
  }

  _isDescendantOf(
    potentialDescendant: string | null,
    objectId: string
  ): boolean {
    if (!potentialDescendant) return false;
    if (potentialDescendant === objectId) return true;

    const obj = this._objectsById[potentialDescendant];
    if (!obj || !obj.parentId) return false;

    return this._isDescendantOf(obj.parentId, objectId);
  }

  reparent(
    objectId: string,
    targetId: string | null,
    position: 'before' | 'after' | 'inside'
  ): void {
    const obj = this._objectsById[objectId];
    if (!obj) return;

    if (targetId && this._isDescendantOf(targetId, objectId)) return;

    if (position === 'inside') {
      const siblings = this.getChildren(targetId);
      const maxOrder = siblings.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), 0);
      this.update(objectId, { parentId: targetId, sortOrder: maxOrder + 1 });
    } else {
      const targetObj = targetId ? this._objectsById[targetId] : null;
      if (!targetObj) return;

      const targetParentId = targetObj.parentId;
      const siblings = this.getChildren(targetParentId).filter((s) => s.id !== objectId);
      const targetIndex = siblings.findIndex((s) => s.id === targetId);

      let newSortOrder: number;
      if (position === 'before') {
        if (targetIndex === 0) {
          newSortOrder = (targetObj.sortOrder ?? 0) - 1;
        } else {
          const prevObj = siblings[targetIndex - 1];
          newSortOrder = ((prevObj.sortOrder ?? 0) + (targetObj.sortOrder ?? 0)) / 2;
        }
      } else {
        if (targetIndex >= siblings.length - 1) {
          newSortOrder = (targetObj.sortOrder ?? 0) + 1;
        } else {
          const nextObj = siblings[targetIndex + 1];
          newSortOrder = ((targetObj.sortOrder ?? 0) + (nextObj.sortOrder ?? 0)) / 2;
        }
      }

      this.update(objectId, { parentId: targetParentId, sortOrder: newSortOrder });
    }
  }

  // ============================================================================
  // Color Inheritance
  // ============================================================================

  getEffectiveColor(objectId: string): string {
    const obj = this._objectsById[objectId];
    if (!obj) return '#78716c';

    if (obj.color) return obj.color;

    if (obj.parentId) {
      const parentColor = this._getInheritedColor(obj.parentId);
      if (parentColor) return parentColor;
    }

    return getObjectType(obj.typeId).color;
  }

  _getInheritedColor(objectId: string): string | null {
    const obj = this._objectsById[objectId];
    if (!obj) return null;
    if (obj.color) return obj.color;
    if (obj.parentId) return this._getInheritedColor(obj.parentId);
    return null;
  }

  isColorInherited(objectId: string): boolean {
    return !this._objectsById[objectId]?.color;
  }

  // ============================================================================
  // Icon Inheritance
  // ============================================================================

  getEffectiveIcon(objectId: string): string {
    const obj = this._objectsById[objectId];
    if (!obj) return '📁';

    if (obj.icon) return obj.icon;

    if (obj.parentId) {
      const parentIcon = this._getInheritedIcon(obj.parentId);
      if (parentIcon) return parentIcon;
    }

    return getObjectType(obj.typeId).icon;
  }

  _getInheritedIcon(objectId: string): string | null {
    const obj = this._objectsById[objectId];
    if (!obj) return null;
    if (obj.icon) return obj.icon;
    if (obj.parentId) return this._getInheritedIcon(obj.parentId);
    return null;
  }

  isIconInherited(objectId: string): boolean {
    return !this._objectsById[objectId]?.icon;
  }

  // ============================================================================
  // Duplicate and Reorder
  // ============================================================================

  duplicate(objectId: string): AethelObject | null {
    const obj = this._objectsById[objectId];
    if (!obj) return null;

    const newObj = createObject(`${obj.name} (copy)`, obj.typeId, obj.parentId);
    newObj.content = obj.content ? JSON.parse(JSON.stringify(obj.content)) : undefined;
    newObj.attributes = obj.attributes ? JSON.parse(JSON.stringify(obj.attributes)) : [];
    newObj.aliases = [...obj.aliases];
    newObj.rendered = obj.rendered;
    newObj.color = obj.color;
    newObj.icon = obj.icon;

    const siblings = this.getChildren(obj.parentId);
    const originalIndex = siblings.findIndex((s) => s.id === objectId);
    if (originalIndex >= 0 && originalIndex < siblings.length - 1) {
      const nextSibling = siblings[originalIndex + 1];
      newObj.sortOrder = ((obj.sortOrder ?? 0) + (nextSibling.sortOrder ?? 0)) / 2;
    } else {
      newObj.sortOrder = (obj.sortOrder ?? 0) + 1;
    }

    this.add(newObj);
    return newObj;
  }

  reorder(objectId: string, newIndex: number): void {
    const obj = this._objectsById[objectId];
    if (!obj) return;

    const siblings = this.getChildren(obj.parentId).filter((s) => s.id !== objectId);
    if (newIndex < 0 || newIndex > siblings.length) return;

    let newSortOrder: number;
    if (siblings.length === 0) {
      newSortOrder = 0;
    } else if (newIndex === 0) {
      newSortOrder = (siblings[0].sortOrder ?? 0) - 1;
    } else if (newIndex >= siblings.length) {
      newSortOrder = (siblings[siblings.length - 1].sortOrder ?? 0) + 1;
    } else {
      const before = siblings[newIndex - 1];
      const after = siblings[newIndex];
      newSortOrder = ((before.sortOrder ?? 0) + (after.sortOrder ?? 0)) / 2;
    }

    this.update(objectId, { sortOrder: newSortOrder });
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  load(objectsList: AethelObject[]): void {
    const map: Record<string, AethelObject> = {};
    for (const obj of objectsList) {
      map[obj.id] = obj;
    }
    this._objectsById = map;
  }

  clear(): void {
    this._objectsById = {};
  }
}

export const objects = new ObjectsStore();
