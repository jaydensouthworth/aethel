/**
 * Timeline Editor State Store (v2 - single-track card model)
 * Uses Svelte 5 Runes for reactivity
 */

import { timeline } from './timeline.svelte';
import { ui } from './ui.svelte';

// ============================================================================
// Types
// ============================================================================

/** @deprecated Use v2 tools instead */
export type EditingTool = 'select' | 'razor' | 'slip' | 'slide';
export type MovementMode = 'free' | 'magnetic';

/**
 * v2 Drag state for single-track model
 */
export interface DragStateV2 {
  isDragging: boolean;
  type: 'reorder-card' | 'move-mutation' | 'attach-mutation' | null;
  sourceId: string | null;
  sourceType: 'card' | 'mutation' | null;
  targetIndex: number | null;
  targetObjectId: string | null; // For attach-mutation
}

/** @deprecated Use DragStateV2 */
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
  /** @deprecated */
  lockedTracks: number[];
  lockedPlacements: string[];
  groups: Record<string, string[]>;
  // v2 additions
  visibleThreadIds?: string[];
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

const DEFAULT_DRAG_STATE_V2: DragStateV2 = {
  isDragging: false,
  type: null,
  sourceId: null,
  sourceType: null,
  targetIndex: null,
  targetObjectId: null,
};

class TimelineEditorStore {
  // ============================================================================
  // v2 Core State (single-track model)
  // ============================================================================

  // Currently selected card (object ID)
  selectedCardId = $state<string | null>(null);

  // Selected mutation IDs
  selectedMutationIds = $state<Set<string>>(new Set());

  // v2 drag state
  dragStateV2 = $state<DragStateV2>({ ...DEFAULT_DRAG_STATE_V2 });

  // Thread visibility
  visibleThreadIds = $state<Set<string>>(new Set());

  // ============================================================================
  // Legacy Core State (kept for backwards compatibility)
  // ============================================================================

  /** @deprecated Use selectedCardId and selectedMutationIds */
  activeTool = $state<EditingTool>('select');
  movementMode = $state<MovementMode>('free');

  /** @deprecated Use selectedMutationIds */
  selectedPlacementIds = $state<Set<string>>(new Set());
  highlightedPlacementIds = $state<Set<string>>(new Set());
  _highlightTimeout: ReturnType<typeof setTimeout> | null = null;

  /** @deprecated Use dragStateV2 */
  dragState = $state<DragState>({ ...DEFAULT_DRAG_STATE });

  selectionBox = $state<SelectionBox | null>(null);

  zoom = $state<number>(1.0);
  scrollOffset = $state<number>(0);

  snapEnabled = $state<boolean>(true);
  snapGridSize = $state<number>(1.0);

  /** @deprecated Tracks removed in v2 */
  lockedTracks = $state<Set<number>>(new Set());
  lockedPlacements = $state<Set<string>>(new Set());

  groups = $state<Map<string, Set<string>>>(new Map());

  clipboard = $state<string[]>([]);

  // ============================================================================
  // v2 Derived State
  // ============================================================================

  // Has a card selected
  hasCardSelection = $derived(this.selectedCardId !== null);

  // Has any mutation selected
  hasMutationSelection = $derived(this.selectedMutationIds.size > 0);

  // Has any selection (card or mutation)
  hasAnySelection = $derived(this.hasCardSelection || this.hasMutationSelection);

  // Get the selected card
  get selectedCard() {
    if (!this.selectedCardId) return null;
    return timeline.cards.find((c) => c.object.id === this.selectedCardId) ?? null;
  }

  // Get selected mutations
  get selectedMutations() {
    return Array.from(this.selectedMutationIds)
      .map((id) => timeline.getPlacement(id))
      .filter((p) => p !== undefined && p.type === 'mutation');
  }

  // Visible card range based on scroll
  get visibleCardRange() {
    const totalCards = timeline.cardCount;
    const cardsPerView = Math.ceil(10 / this.zoom); // Approximate cards visible
    const startIndex = Math.floor(this.scrollOffset);
    const endIndex = Math.min(totalCards, startIndex + cardsPerView);
    return { startIndex, endIndex };
  }

  // ============================================================================
  // Legacy Derived State
  // ============================================================================

  /** @deprecated Use hasAnySelection */
  hasSelection = $derived(this.selectedPlacementIds.size > 0);

  /** @deprecated */
  get selectedPlacements() {
    return Array.from(this.selectedPlacementIds)
      .map((id) => timeline.getPlacement(id))
      .filter((p) => p !== undefined);
  }

  /** @deprecated - v2 uses index-based cards */
  get visibleRange() {
    // In v2, use card count as the range
    const totalRange = timeline.cardCount || 10;
    const visibleWidth = totalRange / this.zoom;
    return {
      min: this.scrollOffset,
      max: this.scrollOffset + visibleWidth,
    };
  }

  // ============================================================================
  // v2 Card Selection Operations
  // ============================================================================

  /**
   * Select a card by object ID
   */
  selectCard(objectId: string): void {
    this.selectedCardId = objectId;
    this.selectedMutationIds = new Set(); // Clear mutation selection
    ui.select(objectId); // Sync with object selection
    timeline.moveCursorToObject(objectId); // Move cursor to card
  }

  /**
   * Clear card selection
   */
  clearCardSelection(): void {
    this.selectedCardId = null;
  }

  /**
   * Select a mutation
   */
  selectMutation(placementId: string, additive: boolean = false): void {
    if (!additive) {
      this.selectedMutationIds = new Set([placementId]);
      this.selectedCardId = null; // Clear card selection
    } else {
      this.selectedMutationIds.add(placementId);
    }

    // Sync with object selection
    const placement = timeline.getPlacement(placementId);
    if (placement) {
      ui.select(placement.objectId);
    }
  }

  /**
   * Toggle mutation selection
   */
  toggleMutationSelection(placementId: string): void {
    if (this.selectedMutationIds.has(placementId)) {
      this.selectedMutationIds.delete(placementId);
    } else {
      this.selectedMutationIds.add(placementId);
    }
  }

  /**
   * Clear mutation selection
   */
  clearMutationSelection(): void {
    this.selectedMutationIds = new Set();
  }

  /**
   * Clear all selection (cards and mutations)
   */
  clearAllSelection(): void {
    this.selectedCardId = null;
    this.selectedMutationIds = new Set();
  }

  /**
   * Select next card
   */
  selectNextCard(): void {
    const currentIndex = this.selectedCardId
      ? timeline.getCardIndex(this.selectedCardId)
      : -1;
    const nextIndex = Math.min(currentIndex + 1, timeline.cardCount - 1);
    const card = timeline.getCardAt(nextIndex);
    if (card) {
      this.selectCard(card.object.id);
    }
  }

  /**
   * Select previous card
   */
  selectPrevCard(): void {
    const currentIndex = this.selectedCardId
      ? timeline.getCardIndex(this.selectedCardId)
      : timeline.cardCount;
    const prevIndex = Math.max(currentIndex - 1, 0);
    const card = timeline.getCardAt(prevIndex);
    if (card) {
      this.selectCard(card.object.id);
    }
  }

  // ============================================================================
  // v2 Thread Visibility
  // ============================================================================

  /**
   * Show a thread
   * Note: We reassign the Set to ensure Svelte 5 reactivity triggers
   */
  showThread(threadId: string): void {
    this.visibleThreadIds = new Set([...this.visibleThreadIds, threadId]);
  }

  /**
   * Hide a thread
   * Note: We reassign the Set to ensure Svelte 5 reactivity triggers
   */
  hideThread(threadId: string): void {
    const newSet = new Set(this.visibleThreadIds);
    newSet.delete(threadId);
    this.visibleThreadIds = newSet;
  }

  /**
   * Toggle thread visibility
   */
  toggleThreadVisibility(threadId: string): void {
    if (this.visibleThreadIds.has(threadId)) {
      this.hideThread(threadId);
    } else {
      this.showThread(threadId);
    }
  }

  /**
   * Show all threads
   */
  showAllThreads(threadIds: string[]): void {
    this.visibleThreadIds = new Set(threadIds);
  }

  /**
   * Hide all threads
   */
  hideAllThreads(): void {
    this.visibleThreadIds = new Set();
  }

  /**
   * Check if a thread is visible
   */
  isThreadVisible(threadId: string): boolean {
    return this.visibleThreadIds.has(threadId);
  }

  // ============================================================================
  // v2 Thread Expansion (for subthreads)
  // ============================================================================

  // Track which threads are expanded to show subthread lanes
  expandedThreadIds = $state<Set<string>>(new Set());

  /**
   * Expand a thread to show its subthread lanes
   */
  expandThread(threadId: string): void {
    this.expandedThreadIds = new Set([...this.expandedThreadIds, threadId]);
  }

  /**
   * Collapse a thread to hide its subthread lanes
   */
  collapseThread(threadId: string): void {
    const newSet = new Set(this.expandedThreadIds);
    newSet.delete(threadId);
    this.expandedThreadIds = newSet;
  }

  /**
   * Toggle thread expansion
   */
  toggleThreadExpanded(threadId: string): void {
    if (this.expandedThreadIds.has(threadId)) {
      this.collapseThread(threadId);
    } else {
      this.expandThread(threadId);
    }
  }

  /**
   * Check if a thread is expanded
   */
  isThreadExpanded(threadId: string): boolean {
    return this.expandedThreadIds.has(threadId);
  }

  // ============================================================================
  // v2 Drag Operations
  // ============================================================================

  /**
   * Start dragging a card for reordering
   */
  startCardDrag(objectId: string): void {
    this.dragStateV2 = {
      isDragging: true,
      type: 'reorder-card',
      sourceId: objectId,
      sourceType: 'card',
      targetIndex: null,
      targetObjectId: null,
    };
  }

  /**
   * Start dragging a mutation
   */
  startMutationDrag(placementId: string): void {
    this.dragStateV2 = {
      isDragging: true,
      type: 'move-mutation',
      sourceId: placementId,
      sourceType: 'mutation',
      targetIndex: null,
      targetObjectId: null,
    };
  }

  /**
   * Update drag target
   */
  updateDragTarget(targetIndex: number | null, targetObjectId: string | null = null): void {
    if (!this.dragStateV2.isDragging) return;
    this.dragStateV2 = {
      ...this.dragStateV2,
      targetIndex,
      targetObjectId,
    };
  }

  /**
   * End drag operation
   */
  endDragV2(): void {
    this.dragStateV2 = { ...DEFAULT_DRAG_STATE_V2 };
  }

  /**
   * Check if currently dragging
   */
  get isDraggingV2(): boolean {
    return this.dragStateV2.isDragging;
  }

  // ============================================================================
  // Legacy Tool and Mode
  // ============================================================================

  /** @deprecated */
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

    // In v2, use card count as the range
    const totalRange = timeline.cardCount || 10;

    const relativePos = centerPosition - currentScrollOffset;
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
      if (p.position !== undefined) {
        snapPoints.push(p.position);
      }
      if (p.endPosition !== undefined) {
        snapPoints.push(p.endPosition);
      }
    }

    // Markers
    const markers = timeline.current.markers;
    for (const m of markers) {
      snapPoints.push(m.position);
    }

    // Cursor index (v2 model uses index-based cursor)
    // In v2, snapping to cursor doesn't apply since we use card indices

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
    if (placement && placement.track !== undefined && this.lockedTracks.has(placement.track)) return true;
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
      // v2 additions
      visibleThreadIds: Array.from(this.visibleThreadIds),
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
    // v2 additions
    this.visibleThreadIds = new Set(snapshot.visibleThreadIds ?? []);
  }

  clear(): void {
    // v2 state
    this.selectedCardId = null;
    this.selectedMutationIds = new Set();
    this.dragStateV2 = { ...DEFAULT_DRAG_STATE_V2 };
    this.visibleThreadIds = new Set();

    // Legacy state
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
