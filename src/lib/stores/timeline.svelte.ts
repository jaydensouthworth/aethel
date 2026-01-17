/**
 * Timeline store with single-track card-based model (v2)
 * Uses Svelte 5 Runes for reactivity
 *
 * The timeline is now a single ordered track of "cards" (rendered objects)
 * with mutations appearing either between cards or attached below cards.
 */

import type {
  AethelObject,
  Timeline,
  TimelineMarker,
  TimelinePlacement,
  MutationDisplay,
  Milestone,
} from '$lib/types';
import { createPlacement } from '$lib/types';
import { objects } from './objects.svelte';
import { milestones } from './milestones.svelte';

// ============================================================================
// Types (exported for external use)
// ============================================================================

export interface ComputedObjectState {
  objectId: string;
  cursorIndex: number;
  mutations: TimelinePlacement[]; // Mutations applied (index <= cursor)
  computedAttributes: Record<string, unknown>;
  futureMutations: TimelinePlacement[]; // Mutations not yet applied
}

/**
 * Represents a card on the single-track timeline
 */
export interface TimelineCard {
  index: number;
  object: AethelObject;
  placement: TimelinePlacement | null; // null if object has no creation placement
  mutationsBelow: TimelinePlacement[];
}

/**
 * Represents items in the timeline flow (cards, mutations between, milestones)
 * Now uses unified position model
 */
export type TimelineFlowItem =
  | { type: 'card'; index: number; object: AethelObject; placement: TimelinePlacement | null; position: number }
  | { type: 'mutation'; placement: TimelinePlacement; position: number }
  | { type: 'milestone'; milestone: Milestone; position: number };

/**
 * Unified timeline item for position-based sorting
 * All items (cards, milestones, mutations) are sorted together by position
 */
export type TimelineItem =
  | { type: 'card'; item: AethelObject; position: number }
  | { type: 'milestone'; item: Milestone; position: number }
  | { type: 'mutation'; item: TimelinePlacement; position: number };

// Position spacing constant
const POSITION_SPACING = 1000;

// ============================================================================
// Constants
// ============================================================================

const MIN_PANEL_HEIGHT = 80;
const MAX_PANEL_HEIGHT = 600;

class TimelineStore {
  // ============================================================================
  // Core State
  // ============================================================================

  current = $state<Timeline>({
    id: 'main',
    name: 'Main Timeline',
    markers: [],
  });

  allPlacements = $state<TimelinePlacement[]>([]);

  panelHeight = $state<number>(180);

  // v2: Cursor now indexes into rendered objects
  cursorIndex = $state<number>(0);

  // ============================================================================
  // v2 Single-Track Derived State
  // ============================================================================

  /**
   * Ordered rendered objects - the spine of the single-track timeline
   *
   * Timeline ordering uses the unified position model:
   * - All rendered objects are sorted globally by position
   * - Objects without position fall back to tree position * POSITION_SPACING
   * - This allows cards to be freely reordered regardless of parentId
   *
   * The tree structure (parentId) is preserved for the object panel,
   * but the timeline uses flat position-based ordering.
   */
  renderedObjects = $derived.by(() => {
    // First, get tree order for fallback positioning
    const treeOrder: AethelObject[] = [];
    const collectRendered = (parentId: string | null) => {
      const children = objects.byParent.get(parentId) ?? [];
      for (const child of children) {
        if (child.rendered) {
          treeOrder.push(child);
        }
        collectRendered(child.id);
      }
    };
    collectRendered(null);

    // If no positions have been set, return tree order
    const hasAnyPosition = treeOrder.some(obj => obj.position !== undefined);
    if (!hasAnyPosition) {
      return treeOrder;
    }

    // Create fallback positions based on tree order
    const treeFallback = new Map<string, number>();
    treeOrder.forEach((obj, i) => treeFallback.set(obj.id, (i + 1) * POSITION_SPACING));

    // Sort ALL rendered objects by position (global flat sort)
    // Objects without position use tree fallback
    return [...treeOrder].sort((a, b) => {
      const aPos = a.position ?? treeFallback.get(a.id)!;
      const bPos = b.position ?? treeFallback.get(b.id)!;
      return aPos - bPos;
    });
  });

  /**
   * Get all timeline items (cards, milestones, mutations) sorted by position
   * This is the unified view of the timeline for rendering
   */
  getAllItemsSorted = $derived.by((): TimelineItem[] => {
    const items: TimelineItem[] = [];

    // Collect cards (rendered objects with position)
    for (const obj of this.renderedObjects) {
      // Cards get their position or a fallback based on index
      const idx = this.renderedObjects.indexOf(obj);
      const position = obj.position ?? (idx + 1) * POSITION_SPACING;
      items.push({ type: 'card', item: obj, position });
    }

    // Collect milestones
    for (const milestone of milestones.all) {
      items.push({ type: 'milestone', item: milestone, position: milestone.position });
    }

    // Collect mutations with display='between' and a position
    for (const placement of this.allPlacements) {
      if (
        placement.type === 'mutation' &&
        placement.mutationDisplay === 'between' &&
        placement.position !== undefined
      ) {
        items.push({ type: 'mutation', item: placement, position: placement.position });
      }
    }

    // Sort by position
    return items.sort((a, b) => a.position - b.position);
  });

  /**
   * Cards for the timeline - rendered objects with their placements and attached mutations
   */
  cards = $derived.by(() => {
    const cardList: TimelineCard[] = [];

    for (let i = 0; i < this.renderedObjects.length; i++) {
      const obj = this.renderedObjects[i];

      // Find creation placement for this object
      const placement = this.allPlacements.find(
        (p) => p.objectId === obj.id && p.type === 'creation'
      ) ?? null;

      // Find mutations attached below this card
      const mutationsBelow = this.allPlacements.filter(
        (p) =>
          p.type === 'mutation' &&
          p.mutationDisplay === 'below' &&
          p.attachedToObjectId === obj.id
      );

      cardList.push({
        index: i,
        object: obj,
        placement,
        mutationsBelow,
      });
    }

    return cardList;
  });

  /**
   * Mutations that appear between cards (in the flow)
   * Sorted by position
   */
  mutationsBetween = $derived.by(() => {
    return this.allPlacements
      .filter(
        (p) =>
          p.type === 'mutation' &&
          p.mutationDisplay === 'between' &&
          p.position !== undefined
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  });

  /**
   * All mutations organized by the object they're attached to (for 'below' display)
   */
  mutationsByAttachment = $derived.by(() => {
    const byObject = new Map<string, TimelinePlacement[]>();
    for (const p of this.allPlacements) {
      if (p.type === 'mutation' && p.mutationDisplay === 'below' && p.attachedToObjectId) {
        const list = byObject.get(p.attachedToObjectId) ?? [];
        list.push(p);
        byObject.set(p.attachedToObjectId, list);
      }
    }
    return byObject;
  });

  /**
   * Current card at cursor position
   */
  currentCard = $derived(this.renderedObjects[this.cursorIndex] ?? null);

  /**
   * Total number of cards (rendered objects)
   */
  cardCount = $derived(this.renderedObjects.length);

  // Legacy derived (kept for marker support)
  markers = $derived(this.current.markers);

  get minPanelHeight(): number {
    return MIN_PANEL_HEIGHT;
  }

  /**
   * For book output - rendered objects in order
   */
  get rendered() {
    return this.renderedObjects;
  }

  // ============================================================================
  // Helper functions
  // ============================================================================

  _clampPanelHeight(height: number): number {
    return Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, height));
  }

  /**
   * Get the index of a rendered object by its ID
   */
  getCardIndex(objectId: string): number {
    return this.renderedObjects.findIndex((obj) => obj.id === objectId);
  }

  /**
   * Get the card at a specific index
   */
  getCardAt(index: number): TimelineCard | undefined {
    return this.cards[index];
  }

  // ============================================================================
  // Position Helpers
  // ============================================================================

  /**
   * Calculate a position between two values (midpoint)
   * Used for inserting items between existing items
   */
  getPositionBetween(before: number | null, after: number | null): number {
    if (before === null && after === null) return POSITION_SPACING;
    if (before === null) return after! - POSITION_SPACING;
    if (after === null) return before + POSITION_SPACING;
    return (before + after) / 2;
  }

  /**
   * Get the position for a card by its object ID
   */
  getCardPosition(objectId: string): number | undefined {
    const obj = objects.get(objectId);
    if (!obj) return undefined;
    if (obj.position !== undefined) return obj.position;
    // Fallback to index-based position
    const idx = this.getCardIndex(objectId);
    return idx >= 0 ? (idx + 1) * POSITION_SPACING : undefined;
  }

  /**
   * Get the effective position for an item at a given index
   * Used when items don't have explicit positions yet
   */
  getPositionForIndex(index: number): number {
    const obj = this.renderedObjects[index];
    if (obj?.position !== undefined) return obj.position;
    return (index + 1) * POSITION_SPACING;
  }

  /**
   * Rebalance all positions to ensure clean spacing
   * Called when positions get too close (gap < 1)
   */
  rebalancePositions(): Map<string, number> {
    const newPositions = new Map<string, number>();
    const items = this.getAllItemsSorted;

    items.forEach((item, idx) => {
      const newPos = (idx + 1) * POSITION_SPACING;
      if (item.type === 'card') {
        newPositions.set(item.item.id, newPos);
      } else if (item.type === 'milestone') {
        newPositions.set(item.item.id, newPos);
      } else if (item.type === 'mutation') {
        newPositions.set(item.item.id, newPos);
      }
    });

    return newPositions;
  }

  // ============================================================================
  // Placement Operations
  // ============================================================================

  addPlacement(placement: TimelinePlacement): TimelinePlacement {
    this.allPlacements.push(placement);
    return placement;
  }

  updatePlacement(
    id: string,
    updates: Partial<Omit<TimelinePlacement, 'id' | 'createdAt'>>
  ): void {
    const index = this.allPlacements.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.allPlacements[index] = {
        ...this.allPlacements[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  removePlacement(id: string): void {
    this.allPlacements = this.allPlacements.filter((p) => p.id !== id);
  }

  getPlacement(id: string): TimelinePlacement | undefined {
    return this.allPlacements.find((p) => p.id === id);
  }

  getPlacementsForObject(objectId: string): TimelinePlacement[] {
    return this.allPlacements.filter((p) => p.objectId === objectId);
  }

  hasPlacement(objectId: string): boolean {
    return this.allPlacements.some((p) => p.objectId === objectId);
  }

  removeAllForObject(objectId: string): void {
    this.allPlacements = this.allPlacements.filter((p) => p.objectId !== objectId);
  }

  // ============================================================================
  // v2 Card/Mutation Convenience Methods
  // ============================================================================

  /**
   * Add a creation placement for an object (v2)
   * The object's position in the timeline is determined by its rendered status and tree order
   */
  addCreationV2(objectId: string): TimelinePlacement {
    const placement = createPlacement(objectId, 'creation', {});
    return this.addPlacement(placement);
  }

  /**
   * Add a mutation that appears between cards (v2 - position-based)
   */
  addMutationBetween(
    objectId: string,
    position: number,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>,
    threadIds?: string[]
  ): TimelinePlacement {
    const placement = createPlacement(objectId, 'mutation', {
      mutationDisplay: 'between',
      position,
      mutation: { label, changes },
      threadIds,
    });
    return this.addPlacement(placement);
  }

  /**
   * Add a mutation that appears below a card (v2)
   */
  addMutationBelow(
    objectId: string,
    attachedToObjectId: string,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>,
    threadIds?: string[]
  ): TimelinePlacement {
    const placement = createPlacement(objectId, 'mutation', {
      mutationDisplay: 'below',
      attachedToObjectId,
      mutation: { label, changes },
      threadIds,
    });
    return this.addPlacement(placement);
  }

  /**
   * Change a mutation's display mode
   */
  setMutationDisplay(
    placementId: string,
    display: MutationDisplay,
    options?: {
      attachedToObjectId?: string;
      position?: number;
    }
  ): void {
    this.updatePlacement(placementId, {
      mutationDisplay: display,
      attachedToObjectId: display === 'below' ? options?.attachedToObjectId : undefined,
      position: display === 'between' ? options?.position : undefined,
    });
  }

  /**
   * Get mutations between two positions
   */
  getMutationsBetweenPositions(startPosition: number, endPosition: number): TimelinePlacement[] {
    return this.mutationsBetween.filter((p) => {
      const pos = p.position ?? -1;
      return pos >= startPosition && pos < endPosition;
    });
  }

  // ============================================================================
  // Marker Operations
  // ============================================================================

  addMarker(marker: TimelineMarker): void {
    this.current.markers.push(marker);
    this.current.markers.sort((a, b) => a.position - b.position);
  }

  removeMarker(id: string): void {
    this.current.markers = this.current.markers.filter((m) => m.id !== id);
  }

  getMarker(id: string): TimelineMarker | undefined {
    return this.current.markers.find((m) => m.id === id);
  }

  getMarkerByName(name: string): TimelineMarker | undefined {
    const lower = name.toLowerCase();
    return this.current.markers.find((m) => m.name?.toLowerCase() === lower);
  }

  // ============================================================================
  // Panel Height Operations
  // ============================================================================

  setPanelHeight(height: number): void {
    this.panelHeight = this._clampPanelHeight(height);
  }

  // ============================================================================
  // Cursor Operations (v2 - index-based)
  // ============================================================================

  /**
   * Set cursor to a specific card index
   */
  setCursorIndex(index: number): void {
    this.cursorIndex = Math.max(0, Math.min(index, this.cardCount - 1));
  }

  /**
   * Move cursor to the card for a specific object
   */
  moveCursorToObject(objectId: string): void {
    const index = this.getCardIndex(objectId);
    if (index >= 0) {
      this.setCursorIndex(index);
    }
  }

  /**
   * Move cursor forward by one card
   */
  cursorNext(): void {
    if (this.cursorIndex < this.cardCount - 1) {
      this.cursorIndex++;
    }
  }

  /**
   * Move cursor backward by one card
   */
  cursorPrev(): void {
    if (this.cursorIndex > 0) {
      this.cursorIndex--;
    }
  }

  /**
   * Move cursor to the first card
   */
  cursorFirst(): void {
    this.cursorIndex = 0;
  }

  /**
   * Move cursor to the last card
   */
  cursorLast(): void {
    this.cursorIndex = Math.max(0, this.cardCount - 1);
  }

  /**
   * Get the computed state of an object at the current cursor position
   * In v2, this considers mutations up to and including the current cursor position
   */
  getObjectStateAtCursor(objectId: string): ComputedObjectState {
    const currentIndex = this.cursorIndex;
    const currentPosition = this.getPositionForIndex(currentIndex);
    const objectPlacements = this.getPlacementsForObject(objectId);

    // For v2 model: filter mutations based on their position relative to cursor
    const relevantMutations = objectPlacements
      .filter((p) => {
        if (p.type !== 'mutation') return false;

        // v2 model: check position or attachedToObjectId
        if (p.position !== undefined) {
          return p.position < currentPosition;
        }
        if (p.attachedToObjectId) {
          const attachedPosition = this.getCardPosition(p.attachedToObjectId);
          return attachedPosition !== undefined && attachedPosition <= currentPosition;
        }

        return false;
      })
      .sort((a, b) => {
        // Sort by position
        const aPos = a.position ?? 0;
        const bPos = b.position ?? 0;
        return aPos - bPos;
      });

    const computedAttributes: Record<string, unknown> = {};
    for (const mutation of relevantMutations) {
      if (mutation.mutation?.changes) {
        for (const [key, change] of Object.entries(mutation.mutation.changes)) {
          computedAttributes[key] = change.to;
        }
      }
    }

    const futureMutations = objectPlacements
      .filter((p) => {
        if (p.type !== 'mutation') return false;

        if (p.position !== undefined) {
          return p.position >= currentPosition;
        }
        if (p.attachedToObjectId) {
          const attachedPosition = this.getCardPosition(p.attachedToObjectId);
          return attachedPosition !== undefined && attachedPosition > currentPosition;
        }

        return false;
      })
      .sort((a, b) => {
        const aPos = a.position ?? 0;
        const bPos = b.position ?? 0;
        return aPos - bPos;
      });

    return {
      objectId,
      cursorIndex: currentIndex,
      mutations: relevantMutations,
      computedAttributes,
      futureMutations,
    };
  }

  getObjectMutations(objectId: string): {
    past: TimelinePlacement[];
    future: TimelinePlacement[];
  } {
    const state = this.getObjectStateAtCursor(objectId);
    return {
      past: state.mutations,
      future: state.futureMutations,
    };
  }

  // ============================================================================
  // Rendered toggle
  // ============================================================================

  toggleRendered(objectId: string): void {
    const obj = objects.get(objectId);
    if (obj) {
      objects.update(objectId, {
        rendered: !obj.rendered,
      });
    }
  }

  // ============================================================================
  // Thread Operations (delegated to placements)
  // ============================================================================

  /**
   * Add a placement to a thread
   */
  addPlacementToThread(placementId: string, threadId: string): void {
    const placement = this.getPlacement(placementId);
    if (placement) {
      const threadIds = new Set(placement.threadIds ?? []);
      threadIds.add(threadId);
      this.updatePlacement(placementId, { threadIds: [...threadIds] });
    }
  }

  /**
   * Remove a placement from a thread
   */
  removePlacementFromThread(placementId: string, threadId: string): void {
    const placement = this.getPlacement(placementId);
    if (placement) {
      const threadIds = new Set(placement.threadIds ?? []);
      threadIds.delete(threadId);
      this.updatePlacement(placementId, { threadIds: [...threadIds] });
    }
  }

  /**
   * Get all placements in a specific thread
   */
  getPlacementsInThread(threadId: string): TimelinePlacement[] {
    return this.allPlacements.filter((p) => p.threadIds?.includes(threadId));
  }

  /**
   * Get threads for a specific placement
   */
  getThreadsForPlacement(placementId: string): string[] {
    return this.getPlacement(placementId)?.threadIds ?? [];
  }

  /**
   * Get rendered cards that have any placements in a thread
   * Used for showing "In Thread" section in properties panel
   */
  getCardsInThread(threadId: string): AethelObject[] {
    const placementsInThread = this.getPlacementsInThread(threadId);
    const objectIds = new Set<string>();

    for (const p of placementsInThread) {
      // For 'below' mutations, include the card they're attached to
      if (p.mutationDisplay === 'below' && p.attachedToObjectId) {
        objectIds.add(p.attachedToObjectId);
      }
      // Also include the object the placement belongs to
      objectIds.add(p.objectId);
    }

    return this.renderedObjects.filter((obj) => objectIds.has(obj.id));
  }

  /**
   * Get rendered cards that are NOT in a thread
   * Used for showing "Available to Add" section in properties panel
   */
  getCardsNotInThread(threadId: string): AethelObject[] {
    const inThreadIds = new Set(this.getCardsInThread(threadId).map((c) => c.id));
    return this.renderedObjects.filter((obj) => !inThreadIds.has(obj.id));
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Load timeline data (v2 format)
   */
  loadV2(
    timelineData: Timeline,
    newPlacements: TimelinePlacement[],
    newCursorIndex: number = 0,
    newPanelHeight: number = 180
  ): void {
    this.current = timelineData;
    this.allPlacements = newPlacements;
    this.cursorIndex = newCursorIndex;
    this.panelHeight = this._clampPanelHeight(newPanelHeight);
  }

  clear(): void {
    this.current = {
      id: 'main',
      name: 'Main Timeline',
      markers: [],
    };
    this.allPlacements = [];
    this.cursorIndex = 0;
    this.panelHeight = 180;
  }
}

export const timeline = new TimelineStore();
