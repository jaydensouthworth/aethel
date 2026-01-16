/**
 * UI state store
 * Uses Svelte 5 Runes for reactivity
 */

import type { UIState } from '$lib/types';
import { objects } from './objects.svelte';

interface UISnapshot {
  selectedObjectId: string | null;
  timelineCollapsed: boolean;
  treePanelWidth: number;
  treeExpandedIds: Set<string>;
  propertiesPanelCollapsed: boolean;
}

class UIStore {
  // ============================================================================
  // Core State
  // ============================================================================

  selectedObjectId = $state<string | null>(null);
  timelineCollapsed = $state<boolean>(false);
  treePanelWidth = $state<number>(250);
  treeExpandedIds = $state<Set<string>>(new Set());
  propertiesPanelCollapsed = $state<boolean>(false);

  // Drag state
  draggedObjectId = $state<string | null>(null);
  dropTargetId = $state<string | null>(null);
  dropPosition = $state<'before' | 'after' | 'inside' | null>(null);

  // ============================================================================
  // Derived State
  // ============================================================================

  // Combined UI state for convenience (and serialization)
  state = $derived.by<UIState>(() => ({
    selectedObjectId: this.selectedObjectId,
    timelineCollapsed: this.timelineCollapsed,
    treePanelWidth: this.treePanelWidth,
    treeExpandedIds: this.treeExpandedIds,
  }));

  // Selected object
  get selectedObject() {
    if (!this.selectedObjectId) return null;
    return objects.get(this.selectedObjectId);
  }

  // ============================================================================
  // Selection
  // ============================================================================

  select(id: string | null): void {
    this.selectedObjectId = id;
  }

  clearSelection(): void {
    this.selectedObjectId = null;
  }

  // ============================================================================
  // Timeline Panel
  // ============================================================================

  toggleTimeline(): void {
    this.timelineCollapsed = !this.timelineCollapsed;
  }

  setTimelineCollapsed(collapsed: boolean): void {
    this.timelineCollapsed = collapsed;
  }

  // ============================================================================
  // Tree Panel
  // ============================================================================

  setTreePanelWidth(width: number): void {
    this.treePanelWidth = Math.max(150, Math.min(500, width));
  }

  toggleTreeExpanded(id: string): void {
    // We need to create a new Set to trigger reactivity if we were using a simple
    // state, but Set methods like add/delete are fine if the Set itself is a $state
    // Wait, with Svelte 5 $state on Set, mutations are reactive if using Set methods?
    // Svelte 5 proxies Set and Map. So `this.treeExpandedIds.add(id)` SHOULD be reactive.
    // But `this.treeExpandedIds = new Set(...)` is definitely safe.
    // For now, let's stick to immutable updates for safety or use the proxy methods if confident.
    // Documentation says Set/Map are proxied.
    // But to be consistent with the "update" pattern and ensuring full reactivity propagation:
    if (this.treeExpandedIds.has(id)) {
      this.treeExpandedIds.delete(id);
    } else {
      this.treeExpandedIds.add(id);
    }
  }

  setTreeExpanded(id: string, expanded: boolean): void {
    if (expanded) {
      this.treeExpandedIds.add(id);
    } else {
      this.treeExpandedIds.delete(id);
    }
  }

  isTreeExpanded(id: string): boolean {
    return this.treeExpandedIds.has(id);
  }

  expandAll(): void {
    // Replace the Set with a new one containing all IDs
    this.treeExpandedIds = new Set(objects.all.map((o) => o.id));
  }

  collapseAll(): void {
    this.treeExpandedIds = new Set();
  }

  // ============================================================================
  // Drag and Drop
  // ============================================================================

  setDraggedObject(id: string | null): void {
    this.draggedObjectId = id;
  }

  setDropTarget(id: string | null, position: 'before' | 'after' | 'inside' | null): void {
    this.dropTargetId = id;
    this.dropPosition = position;
  }

  clearDrag(): void {
    this.draggedObjectId = null;
    this.dropTargetId = null;
    this.dropPosition = null;
  }

  // ============================================================================
  // Properties Panel
  // ============================================================================

  togglePropertiesPanel(): void {
    this.propertiesPanelCollapsed = !this.propertiesPanelCollapsed;
  }

  setPropertiesPanelCollapsed(collapsed: boolean): void {
    this.propertiesPanelCollapsed = collapsed;
  }

  // ============================================================================
  // Bulk Operations (for serialization)
  // ============================================================================

  /**
   * Restore UI state from a snapshot (used for deserialization)
   */
  restore(snapshot: UISnapshot): void {
    this.selectedObjectId = snapshot.selectedObjectId;
    this.timelineCollapsed = snapshot.timelineCollapsed;
    this.treePanelWidth = snapshot.treePanelWidth;
    this.treeExpandedIds = snapshot.treeExpandedIds;
    this.propertiesPanelCollapsed = snapshot.propertiesPanelCollapsed;
  }

  /**
   * Clear UI state to defaults
   */
  clear(): void {
    this.selectedObjectId = null;
    this.timelineCollapsed = false;
    this.treePanelWidth = 250;
    this.treeExpandedIds = new Set();
    this.propertiesPanelCollapsed = false;
    this.draggedObjectId = null;
    this.dropTargetId = null;
    this.dropPosition = null;
  }
}

export const ui = new UIStore();
