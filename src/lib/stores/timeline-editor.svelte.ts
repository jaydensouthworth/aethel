/**
 * Timeline Editor State Store
 * Uses Svelte 5 Runes for reactivity
 */

import { timeline } from './timeline.svelte';
import { ui } from './ui.svelte';

// ============================================================================
// Types
// ============================================================================

export type EditingTool = 'select' | 'razor' | 'slip' | 'slide';
export type MovementMode = 'free' | 'magnetic';

export interface DragState {
  isDragging: boolean;
  type: 'move' | 'resize-start' | 'resize-end' | 'slip' | null;
  placementIds: string[];
  startPosition: number;
  startTrack: number;
  currentPosition: number;
  currentTrack: number;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface TimelineEditorSnapshot {
  zoom: number;
  scrollOffset: number;
  snapEnabled: boolean;
  snapGridSize: number;
  lockedTracks: number[];
  lockedPlacements: string[];
  groups: Record<string, string[]>;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10.0;

const DEFAULT_DRAG_STATE: DragState = {
  isDragging: false,
  type: null,
  placementIds: [],
  startPosition: 0,
  startTrack: 0,
  currentPosition: 0,
  currentTrack: 0,
};

class TimelineEditorStore {
  // ============================================================================
  // Core State
  // ============================================================================

  activeTool = $state<EditingTool>('select');
  movementMode = $state<MovementMode>('free');

  selectedPlacementIds = $state<Set<string>>(new Set());
  highlightedPlacementIds = $state<Set<string>>(new Set());
  _highlightTimeout: ReturnType<typeof setTimeout> | null = null;

  dragState = $state<DragState>({ ...DEFAULT_DRAG_STATE });

  selectionBox = $state<SelectionBox | null>(null);

  zoom = $state<number>(1.0);
  scrollOffset = $state<number>(0);

  snapEnabled = $state<boolean>(true);
  snapGridSize = $state<number>(1.0);

  lockedTracks = $state<Set<number>>(new Set());
  lockedPlacements = $state<Set<string>>(new Set());

  groups = $state<Map<string, Set<string>>>(new Map());

  clipboard = $state<string[]>([]);

  // ============================================================================
  // Derived State
  // ============================================================================

  hasSelection = $derived(this.selectedPlacementIds.size > 0);

  get selectedPlacements() {
    return Array.from(this.selectedPlacementIds)
      .map((id) => timeline.getPlacement(id))
      .filter((p) => p !== undefined);
  }

  get visibleRange() {
    const currentZoom = this.zoom;
    const currentScrollOffset = this.scrollOffset;
    const { min, max } = timeline.bounds;
    const totalRange = max - min || 10;
    const visibleWidth = totalRange / currentZoom;
    return {
      min: min + currentScrollOffset,
      max: min + currentScrollOffset + visibleWidth,
    };
  }

  // ============================================================================
  // Tool and Mode
  // ============================================================================

  setTool(tool: EditingTool): void {
    this.activeTool = tool;
  }

  setMovementMode(mode: MovementMode): void {
    this.movementMode = mode;
  }

  toggleMovementMode(): void {
    this.movementMode = this.movementMode === 'free' ? 'magnetic' : 'free';
  }

  // ============================================================================
  // Selection Operations
  // ============================================================================

  select(id: string, additive: boolean = false): void {
    if (!additive) {
      this.selectedPlacementIds = new Set([id]);
    } else {
      this.selectedPlacementIds.add(id);
    }

    // Sync with object selection
    const placement = timeline.getPlacement(id);
    if (placement) {
      ui.select(placement.objectId);
    }
  }

  toggleSelect(id: string): void {
    if (this.selectedPlacementIds.has(id)) {
      this.selectedPlacementIds.delete(id);
    } else {
      this.selectedPlacementIds.add(id);
    }

    // If we have exactly one selection, sync object selection
    if (this.selectedPlacementIds.size === 1) {
      const [singleId] = this.selectedPlacementIds;
      const placement = timeline.getPlacement(singleId);
      if (placement) {
        ui.select(placement.objectId);
      }
    }
  }

  clearSelection(): void {
    this.selectedPlacementIds = new Set();
  }

  selectAll(): void {
    const allIds = timeline.allPlacements.map((p) => p.id);
    this.selectedPlacementIds = new Set(allIds);
  }

  selectAllForObject(objectId: string): void {
    const ids = timeline.allPlacements
      .filter((p) => p.objectId === objectId)
      .map((p) => p.id);
    this.selectedPlacementIds = new Set(ids);
  }

  isSelected(id: string): boolean {
    return this.selectedPlacementIds.has(id);
  }

  // ============================================================================
  // Highlight Operations
  // ============================================================================

  highlightPlacements(objectId: string, duration: number = 2000): void {
    const ids = timeline.allPlacements
      .filter((p) => p.objectId === objectId)
      .map((p) => p.id);

    this.highlightedPlacementIds = new Set(ids);

    if (this._highlightTimeout) {
      clearTimeout(this._highlightTimeout);
    }

    if (duration > 0) {
      this._highlightTimeout = setTimeout(() => {
        this.highlightedPlacementIds = new Set();
        this._highlightTimeout = null;
      }, duration);
    }
  }

  clearHighlights(): void {
    this.highlightedPlacementIds = new Set();
    if (this._highlightTimeout) {
      clearTimeout(this._highlightTimeout);
      this._highlightTimeout = null;
    }
  }

  isHighlighted(id: string): boolean {
    return this.highlightedPlacementIds.has(id);
  }

  // ============================================================================
  // Drag Operations
  // ============================================================================

  startDrag(type: DragState['type'], position: number, track: number): void {
    this.dragState = {
      isDragging: true,
      type,
      placementIds: Array.from(this.selectedPlacementIds),
      startPosition: position,
      startTrack: track,
      currentPosition: position,
      currentTrack: track,
    };
  }

  updateDrag(position: number, track: number): void {
    if (!this.dragState.isDragging) return;
    this.dragState = {
      ...this.dragState,
      currentPosition: position,
      currentTrack: track,
    };
  }

  endDrag(): void {
    this.dragState = { ...DEFAULT_DRAG_STATE };
  }

  // ============================================================================
  // Box Selection
  // ============================================================================

  startBoxSelection(x: number, y: number): void {
    this.selectionBox = { startX: x, startY: y, endX: x, endY: y };
  }

  updateBoxSelection(x: number, y: number): void {
    if (!this.selectionBox) return;
    this.selectionBox = { ...this.selectionBox, endX: x, endY: y };
  }

  endBoxSelection(): void {
    this.selectionBox = null;
  }

  // ============================================================================
  // Zoom and Scroll
  // ============================================================================

  setZoom(newZoom: number): void {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
  }

  zoomIn(): void {
    this.setZoom(this.zoom * 1.2);
  }

  zoomOut(): void {
    this.setZoom(this.zoom / 1.2);
  }

  resetZoom(): void {
    this.zoom = 1.0;
    this.scrollOffset = 0;
  }

  setScrollOffset(offset: number): void {
    this.scrollOffset = Math.max(0, offset);
  }

  zoomAt(newZoom: number, centerPosition: number): void {
    const currentZoom = this.zoom;
    const currentScrollOffset = this.scrollOffset;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    const bounds = timeline.bounds;
    const { min, max } = bounds;
    const totalRange = max - min || 10;

    const relativePos = centerPosition - min - currentScrollOffset;
    const oldWidth = totalRange / currentZoom;
    const newWidth = totalRange / clampedZoom;
    const positionRatio = relativePos / oldWidth;
    const newRelativePos = positionRatio * newWidth;
    const scrollDelta = relativePos - newRelativePos;

    this.zoom = clampedZoom;
    this.scrollOffset = Math.max(0, currentScrollOffset + scrollDelta);
  }

  // ============================================================================
  // Snap
  // ============================================================================

  toggleSnap(): void {
    this.snapEnabled = !this.snapEnabled;
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  setSnapGridSize(size: number): void {
    this.snapGridSize = Math.max(0.1, size);
  }

  snapPosition(position: number): number {
    if (!this.snapEnabled) return position;

    const currentZoom = this.zoom;
    const currentSnapGridSize = this.snapGridSize;
    const currentSelectedIds = this.selectedPlacementIds;

    const snapThreshold = 0.5 / currentZoom;
    const snapPoints: number[] = [];

    // Grid snap points
    const gridStart = Math.floor(position / currentSnapGridSize) * currentSnapGridSize;
    snapPoints.push(gridStart, gridStart + currentSnapGridSize);

    // Other placement edges
    for (const p of timeline.allPlacements) {
      if (currentSelectedIds.has(p.id)) continue;
      snapPoints.push(p.position);
      if (p.endPosition !== undefined) {
        snapPoints.push(p.endPosition);
      }
    }

    // Markers
    const markers = timeline.current.markers;
    for (const m of markers) {
      snapPoints.push(m.position);
    }

    // Cursor
    snapPoints.push(timeline.cursorPosition);

    // Find closest snap point
    let closest = position;
    let closestDist = snapThreshold;

    for (const point of snapPoints) {
      const dist = Math.abs(point - position);
      if (dist < closestDist) {
        closest = point;
        closestDist = dist;
      }
    }

    return closest;
  }

  // ============================================================================
  // Lock Operations
  // ============================================================================

  lockTrack(track: number): void {
    this.lockedTracks.add(track);
  }

  unlockTrack(track: number): void {
    this.lockedTracks.delete(track);
  }

  toggleTrackLock(track: number): void {
    if (this.lockedTracks.has(track)) {
      this.lockedTracks.delete(track);
    } else {
      this.lockedTracks.add(track);
    }
  }

  isTrackLocked(track: number): boolean {
    return this.lockedTracks.has(track);
  }

  lockPlacement(id: string): void {
    this.lockedPlacements.add(id);
  }

  unlockPlacement(id: string): void {
    this.lockedPlacements.delete(id);
  }

  togglePlacementLock(id: string): void {
    if (this.lockedPlacements.has(id)) {
      this.lockedPlacements.delete(id);
    } else {
      this.lockedPlacements.add(id);
    }
  }

  isPlacementLocked(id: string): boolean {
    if (this.lockedPlacements.has(id)) return true;
    const placement = timeline.getPlacement(id);
    if (placement && this.lockedTracks.has(placement.track)) return true;
    return false;
  }

  toggleLockSelected(): void {
    const currentSelectedIds = this.selectedPlacementIds;
    const anyUnlocked = Array.from(currentSelectedIds).some((id) => !this.lockedPlacements.has(id));

    for (const id of currentSelectedIds) {
      if (anyUnlocked) {
        this.lockedPlacements.add(id);
      } else {
        this.lockedPlacements.delete(id);
      }
    }
  }

  // ============================================================================
  // Group Operations
  // ============================================================================

  groupSelected(): string | null {
    if (this.selectedPlacementIds.size < 2) return null;

    const groupId = crypto.randomUUID();
    const memberIds = new Set(this.selectedPlacementIds);

    // Remove from existing groups
    for (const [gid, members] of this.groups) {
      for (const id of memberIds) {
        members.delete(id);
      }
      if (members.size === 0) {
        this.groups.delete(gid);
      }
    }

    this.groups.set(groupId, memberIds);
    return groupId;
  }

  ungroupSelected(): void {
    const toRemove: string[] = [];

    for (const [gid, members] of this.groups) {
      for (const id of this.selectedPlacementIds) {
        if (members.has(id)) {
          toRemove.push(gid);
          break;
        }
      }
    }

    for (const gid of toRemove) {
      this.groups.delete(gid);
    }
  }

  getGroupForPlacement(id: string): string | null {
    for (const [gid, members] of this.groups) {
      if (members.has(id)) return gid;
    }
    return null;
  }

  getGroupMembers(groupId: string): Set<string> {
    return this.groups.get(groupId) ?? new Set();
  }

  // ============================================================================
  // Clipboard Operations
  // ============================================================================

  copySelected(): void {
    this.clipboard = Array.from(this.selectedPlacementIds);
  }

  getClipboard(): string[] {
    return this.clipboard;
  }

  hasClipboard(): boolean {
    return this.clipboard.length > 0;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  getSnapshot(): TimelineEditorSnapshot {
    return {
      zoom: this.zoom,
      scrollOffset: this.scrollOffset,
      snapEnabled: this.snapEnabled,
      snapGridSize: this.snapGridSize,
      lockedTracks: Array.from(this.lockedTracks),
      lockedPlacements: Array.from(this.lockedPlacements),
      groups: Object.fromEntries(
        Array.from(this.groups.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
    };
  }

  restore(snapshot: TimelineEditorSnapshot): void {
    this.zoom = snapshot.zoom ?? 1.0;
    this.scrollOffset = snapshot.scrollOffset ?? 0;
    this.snapEnabled = snapshot.snapEnabled ?? true;
    this.snapGridSize = snapshot.snapGridSize ?? 1.0;
    this.lockedTracks = new Set(snapshot.lockedTracks ?? []);
    this.lockedPlacements = new Set(snapshot.lockedPlacements ?? []);
    this.groups = new Map(Object.entries(snapshot.groups ?? {}).map(([k, v]) => [k, new Set(v)]));
  }

  clear(): void {
    this.activeTool = 'select';
    this.movementMode = 'free';
    this.selectedPlacementIds = new Set();
    this.highlightedPlacementIds = new Set();
    this.dragState = { ...DEFAULT_DRAG_STATE };
    this.selectionBox = null;
    this.zoom = 1.0;
    this.scrollOffset = 0;
    this.snapEnabled = true;
    this.snapGridSize = 1.0;
    this.lockedTracks = new Set();
    this.lockedPlacements = new Set();
    this.groups = new Map();
    this.clipboard = [];
  }
}

export const timelineEditor = new TimelineEditorStore();
