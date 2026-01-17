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
  TimelineTrack,
  MutationDisplay,
} from '$lib/types';
import { createPlacement } from '$lib/types';
import { objects } from './objects.svelte';

// ============================================================================
// Types (exported for external use)
// ============================================================================

export interface ComputedObjectState {
  objectId: string;
  cursorIndex: number;
  /** @deprecated Use cursorIndex */
  cursorPosition?: number;
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
 */
export type TimelineFlowItem =
  | { type: 'card'; index: number; object: AethelObject; placement: TimelinePlacement | null }
  | { type: 'mutation'; placement: TimelinePlacement; afterIndex: number }
  | { type: 'milestone'; milestoneId: string; afterIndex: number };

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

  /** @deprecated Use single-track model instead */
  tracks = $state<TimelineTrack[]>([{ id: 0, locked: false }]);

  allPlacements = $state<TimelinePlacement[]>([]);

  panelHeight = $state<number>(180);

  // v2: Cursor now indexes into rendered objects
  cursorIndex = $state<number>(0);

  /** @deprecated Use cursorIndex instead */
  cursorPosition = $state<number>(0);

  // ============================================================================
  // v2 Single-Track Derived State
  // ============================================================================

  /**
   * Ordered rendered objects - the spine of the single-track timeline
   * Sorted by: tree hierarchy (depth-first) then sortOrder
   */
  renderedObjects = $derived.by(() => {
    const rendered: AethelObject[] = [];

    // Helper: recursively collect rendered objects in tree order
    const collectRendered = (parentId: string | null) => {
      const children = objects.byParent.get(parentId) ?? [];
      for (const child of children) {
        if (child.rendered) {
          rendered.push(child);
        }
        // Continue into children regardless of parent's rendered status
        collectRendered(child.id);
      }
    };

    collectRendered(null);
    return rendered;
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
   * Sorted by afterRenderedIndex
   */
  mutationsBetween = $derived.by(() => {
    return this.allPlacements
      .filter(
        (p) =>
          p.type === 'mutation' &&
          p.mutationDisplay === 'between' &&
          p.afterRenderedIndex !== undefined
      )
      .sort((a, b) => (a.afterRenderedIndex ?? 0) - (b.afterRenderedIndex ?? 0));
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

  // ============================================================================
  // Legacy Derived State (kept for backwards compatibility)
  // ============================================================================

  /** @deprecated Use cards instead */
  byTrack = $derived.by(() => {
    const byTrack = new Map<number, TimelinePlacement[]>();

    for (const p of this.allPlacements) {
      const track = p.track ?? 0;
      const existing = byTrack.get(track) ?? [];
      existing.push(p);
      byTrack.set(track, existing);
    }

    for (const [track, trackPlacements] of byTrack) {
      byTrack.set(track, trackPlacements.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
    }

    return byTrack;
  });

  /** @deprecated */
  trackCount = $derived(this.tracks.length);

  /** @deprecated */
  bounds = $derived.by(() => {
    if (this.allPlacements.length === 0) {
      return { min: 0, max: 10 };
    }

    const positions: number[] = [];
    for (const p of this.allPlacements) {
      if (p.position !== undefined) {
        positions.push(p.position);
      }
      if (p.endPosition !== undefined) {
        positions.push(p.endPosition);
      }
    }

    if (positions.length === 0) {
      return { min: 0, max: this.cardCount };
    }

    return {
      min: Math.min(...positions),
      max: Math.max(...positions),
    };
  });

  // Markers from current timeline
  markers = $derived(this.current.markers);

  /** @deprecated */
  get allTracks(): TimelineTrack[] {
    return this.tracks;
  }

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

  /** @deprecated */
  _ensureTracksForPlacements(): void {
    if (this.allPlacements.length > 0) {
      const trackNumbers = this.allPlacements
        .map((p) => p.track)
        .filter((t): t is number => t !== undefined);
      if (trackNumbers.length > 0) {
        const maxTrack = Math.max(...trackNumbers);
        while (this.tracks.length <= maxTrack) {
          this.tracks.push({ id: this.tracks.length, locked: false });
        }
      }
    }
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
  // Placement Operations
  // ============================================================================

  addPlacement(placement: TimelinePlacement): TimelinePlacement {
    this.allPlacements.push(placement);
    this._ensureTracksForPlacements();
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
   * Add a mutation that appears between cards (v2)
   */
  addMutationBetween(
    objectId: string,
    afterRenderedIndex: number,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>,
    threadIds?: string[]
  ): TimelinePlacement {
    const placement = createPlacement(objectId, 'mutation', {
      mutationDisplay: 'between',
      afterRenderedIndex,
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
      afterRenderedIndex?: number;
    }
  ): void {
    this.updatePlacement(placementId, {
      mutationDisplay: display,
      attachedToObjectId: display === 'below' ? options?.attachedToObjectId : undefined,
      afterRenderedIndex: display === 'between' ? options?.afterRenderedIndex : undefined,
    });
  }

  /**
   * Get mutations between two card indices
   */
  getMutationsBetweenIndices(startIndex: number, endIndex: number): TimelinePlacement[] {
    return this.mutationsBetween.filter((p) => {
      const idx = p.afterRenderedIndex ?? -1;
      return idx >= startIndex && idx < endIndex;
    });
  }

  // ============================================================================
  // Legacy Convenience Methods (kept for backwards compatibility)
  // ============================================================================

  /** @deprecated Use addCreationV2 instead */
  addCreation(
    objectId: string,
    position: number,
    track: number = 0,
    endPosition?: number
  ): TimelinePlacement {
    const placement = createPlacement(objectId, 'creation', {
      position,
      track,
    });
    if (endPosition !== undefined) {
      placement.endPosition = endPosition;
    }
    return this.addPlacement(placement);
  }

  /** @deprecated Use addMutationBetween or addMutationBelow instead */
  addMutation(
    objectId: string,
    position: number,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>,
    track: number = 0
  ): TimelinePlacement {
    const placement = createPlacement(objectId, 'mutation', {
      position,
      track,
      mutation: { label, changes },
    });
    return this.addPlacement(placement);
  }

  hasPlacement(objectId: string): boolean {
    return this.allPlacements.some((p) => p.objectId === objectId);
  }

  removeAllForObject(objectId: string): void {
    this.allPlacements = this.allPlacements.filter((p) => p.objectId !== objectId);
  }

  // ============================================================================
  // Track Operations
  // ============================================================================

  getTrack(index: number): TimelineTrack | undefined {
    return this.tracks[index];
  }

  updateTrack(index: number, updates: Partial<Omit<TimelineTrack, 'id'>>): void {
    if (index >= 0 && index < this.tracks.length) {
      this.tracks[index] = { ...this.tracks[index], ...updates };
    }
  }

  insertTrack(index: number, config: Partial<Omit<TimelineTrack, 'id'>> = {}): void {
    const newTrack: TimelineTrack = {
      id: this.tracks.length,
      locked: false,
      ...config,
    };

    // Insert at index
    this.tracks.splice(index, 0, newTrack);

    // Reindex track IDs
    this.tracks.forEach((t, i) => { t.id = i; });

    // Shift placements
    for (const p of this.allPlacements) {
      if (p.track >= index) {
        // Modifying placement in place since it's an object in the array
        // However, to trigger fine-grained updates on the placement itself if it were a state object, we'd assign.
        // Here `p` is a plain object inside the `$state` array. Mutating it works if it's a proxy.
        // `$state` array elements are proxies.
        p.track = p.track + 1;
      }
    }
  }

  removeTrack(index: number): void {
    if (this.tracks.length <= 1) return;
    if (index < 0 || index >= this.tracks.length) return;

    // Remove placements on this track
    this.allPlacements = this.allPlacements.filter((p) => p.track !== index);

    // Shift placements on tracks > index
    for (const p of this.allPlacements) {
      if (p.track > index) {
        p.track = p.track - 1;
      }
    }

    // Remove the track
    this.tracks.splice(index, 1);
    
    // Reindex
    this.tracks.forEach((t, i) => { t.id = i; });
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

  /** @deprecated Use setCursorIndex instead */
  setCursorPosition(pos: number): void {
    this.cursorPosition = pos;
  }

  /** @deprecated Use moveCursorToObject instead */
  moveCursorToPlacement(placementId: string): void {
    const placement = this.getPlacement(placementId);
    if (placement) {
      this.cursorPosition = placement.position ?? 0;
      // Also try to set cursorIndex for v2 compatibility
      const index = this.getCardIndex(placement.objectId);
      if (index >= 0) {
        this.cursorIndex = index;
      }
    }
  }

  /**
   * Get the computed state of an object at the current cursor position
   * In v2, this considers mutations up to and including the current card index
   */
  getObjectStateAtCursor(objectId: string): ComputedObjectState {
    const currentIndex = this.cursorIndex;
    const objectPlacements = this.getPlacementsForObject(objectId);

    // For v2 model: filter mutations based on their position relative to cursor index
    const relevantMutations = objectPlacements
      .filter((p) => {
        if (p.type !== 'mutation') return false;

        // v2 model: check afterRenderedIndex or attachedToObjectId
        if (p.afterRenderedIndex !== undefined) {
          return p.afterRenderedIndex < currentIndex;
        }
        if (p.attachedToObjectId) {
          const attachedIndex = this.getCardIndex(p.attachedToObjectId);
          return attachedIndex >= 0 && attachedIndex <= currentIndex;
        }

        // Legacy: fall back to position-based
        if (p.position !== undefined) {
          return p.position <= this.cursorPosition;
        }

        return false;
      })
      .sort((a, b) => {
        // Sort by afterRenderedIndex or position
        const aIdx = a.afterRenderedIndex ?? a.position ?? 0;
        const bIdx = b.afterRenderedIndex ?? b.position ?? 0;
        return aIdx - bIdx;
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

        if (p.afterRenderedIndex !== undefined) {
          return p.afterRenderedIndex >= currentIndex;
        }
        if (p.attachedToObjectId) {
          const attachedIndex = this.getCardIndex(p.attachedToObjectId);
          return attachedIndex > currentIndex;
        }

        if (p.position !== undefined) {
          return p.position > this.cursorPosition;
        }

        return false;
      })
      .sort((a, b) => {
        const aIdx = a.afterRenderedIndex ?? a.position ?? 0;
        const bIdx = b.afterRenderedIndex ?? b.position ?? 0;
        return aIdx - bIdx;
      });

    return {
      objectId,
      cursorIndex: currentIndex,
      cursorPosition: this.cursorPosition,
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

  /** @deprecated Use loadV2 for new code */
  load(
    timelineData: Timeline,
    newPlacements: TimelinePlacement[],
    newCursorPosition: number = 0,
    newPanelHeight: number = 180,
    newTracks?: TimelineTrack[]
  ): void {
    this.current = timelineData;
    this.allPlacements = newPlacements;
    this.cursorPosition = newCursorPosition;
    this.cursorIndex = 0; // Will need migration to set properly
    this.panelHeight = this._clampPanelHeight(newPanelHeight);

    if (newTracks && newTracks.length > 0) {
      this.tracks = newTracks;
    }
    this._ensureTracksForPlacements();
  }

  clear(): void {
    this.current = {
      id: 'main',
      name: 'Main Timeline',
      markers: [],
    };
    this.allPlacements = [];
    this.cursorIndex = 0;
    this.cursorPosition = 0;
    this.panelHeight = 180;
    this.tracks = [{ id: 0, locked: false }];
  }
}

export const timeline = new TimelineStore();
