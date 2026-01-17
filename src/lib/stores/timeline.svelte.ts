/**
 * Timeline store with timeslot-based model (v3)
 * Uses Svelte 5 Runes for reactivity
 *
 * The timeline is an ordered array of "timeslots". Everything in a timeslot
 * happens "at the same time". Items reference timeslots by ID.
 */

import type {
  AethelObject,
  Timeline,
  TimelineMarker,
  TimelinePlacement,
  Milestone,
  Timeslot,
  JSONContent,
} from '$lib/types';
import { createPlacement, createTimeslot } from '$lib/types';
import { objects } from './objects.svelte';
import { milestones } from './milestones.svelte';

// ============================================================================
// Types (exported for external use)
// ============================================================================

export interface ComputedObjectState {
  objectId: string;
  cursorIndex: number;
  mutations: TimelinePlacement[]; // Mutations applied (timeslot index <= cursor)
  computedAttributes: Record<string, unknown>;
  // Computed content at this cursor position (base content + all content mutations applied)
  computedContent: JSONContent | null;
  // Computed section contents at this cursor position (sectionId -> content)
  computedSections: Record<string, JSONContent | null>;
  futureMutations: TimelinePlacement[]; // Mutations not yet applied
}

/**
 * Represents a card on the timeline
 */
export interface TimelineCard {
  index: number;
  object: AethelObject;
  placement: TimelinePlacement | null; // null if object has no creation placement
  mutationsBelow: TimelinePlacement[];
}

/**
 * Represents a timeslot with all its contents
 */
export interface TimeslotContents {
  timeslotId: string;
  index: number;
  cards: AethelObject[];
  mutations: TimelinePlacement[];
  milestonesBefore: Milestone[]; // Milestones that appear BEFORE this timeslot
}

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

  // All placements (now reference timeslotId)
  allPlacements = $state<TimelinePlacement[]>([]);

  // v3: Ordered list of timeslot IDs (the source of truth for order)
  timeslotOrder = $state<string[]>([]);

  // v3: Timeslot entities (for ID stability)
  timeslots = $state<Map<string, Timeslot>>(new Map());

  panelHeight = $state<number>(180);

  // Cursor indexes into timeslotOrder
  cursorIndex = $state<number>(0);

  // Anchor: remembers where user came from before navigating to view object state
  // null means no anchor is set (cursor is at the "home" position)
  anchorIndex = $state<number | null>(null);

  // ============================================================================
  // Timeslot Derived State
  // ============================================================================

  /**
   * Cards grouped by timeslot ID
   */
  cardsByTimeslot = $derived.by(() => {
    const map = new Map<string, AethelObject[]>();
    for (const obj of objects.all) {
      if (obj.rendered && obj.timeslotId) {
        const list = map.get(obj.timeslotId) ?? [];
        list.push(obj);
        map.set(obj.timeslotId, list);
      }
    }
    return map;
  });

  /**
   * Mutations grouped by timeslot ID
   */
  mutationsByTimeslot = $derived.by(() => {
    const map = new Map<string, TimelinePlacement[]>();
    for (const p of this.allPlacements) {
      if (p.type === 'mutation') {
        const list = map.get(p.timeslotId) ?? [];
        list.push(p);
        map.set(p.timeslotId, list);
      }
    }
    return map;
  });

  /**
   * Mutations grouped by attached card (for "below" display)
   */
  mutationsByAttachment = $derived.by(() => {
    const map = new Map<string, TimelinePlacement[]>();
    for (const p of this.allPlacements) {
      if (p.type === 'mutation' && p.attachedToCardId) {
        const list = map.get(p.attachedToCardId) ?? [];
        list.push(p);
        map.set(p.attachedToCardId, list);
      }
    }
    return map;
  });

  /**
   * Milestones grouped by the timeslot they appear BEFORE
   * Key is timeslotId (or 'start' for milestones at the very beginning)
   */
  milestonesByTimeslot = $derived.by(() => {
    const map = new Map<string | null, Milestone[]>();
    for (const m of milestones.all) {
      const key = m.timeslotId;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  });

  /**
   * All rendered objects in timeline order (based on timeslot order)
   */
  renderedObjects = $derived.by(() => {
    const result: AethelObject[] = [];
    for (const tsId of this.timeslotOrder) {
      const cards = this.cardsByTimeslot.get(tsId) ?? [];
      result.push(...cards);
    }
    return result;
  });

  /**
   * Timeline contents by timeslot - the main data structure for rendering
   */
  orderedTimeslots = $derived.by((): TimeslotContents[] => {
    return this.timeslotOrder.map((tsId, index) => ({
      timeslotId: tsId,
      index,
      cards: this.cardsByTimeslot.get(tsId) ?? [],
      mutations: this.mutationsByTimeslot.get(tsId) ?? [],
      milestonesBefore: this.milestonesByTimeslot.get(tsId) ?? [],
    }));
  });

  /**
   * Milestones at the very start (before first timeslot)
   */
  milestonesAtStart = $derived(this.milestonesByTimeslot.get(null) ?? []);

  /**
   * Cards for the timeline - with their placements and attached mutations
   */
  cards = $derived.by(() => {
    const cardList: TimelineCard[] = [];
    let index = 0;

    for (const tsId of this.timeslotOrder) {
      const cardsInSlot = this.cardsByTimeslot.get(tsId) ?? [];

      for (const obj of cardsInSlot) {
        // Find creation placement for this object
        const placement = this.allPlacements.find(
          (p) => p.objectId === obj.id && p.type === 'creation'
        ) ?? null;

        // Find mutations attached below this card
        const mutationsBelow = this.mutationsByAttachment.get(obj.id) ?? [];

        cardList.push({
          index: index++,
          object: obj,
          placement,
          mutationsBelow,
        });
      }
    }

    return cardList;
  });

  /**
   * Current card at cursor position
   */
  currentCard = $derived(this.renderedObjects[this.cursorIndex] ?? null);

  /**
   * Total number of cards (rendered objects)
   */
  cardCount = $derived(this.renderedObjects.length);

  /**
   * Current timeslot ID at cursor
   */
  currentTimeslotId = $derived(this.timeslotOrder[this.cursorIndex] ?? null);

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

  /**
   * Get timeslot index for a given timeslot ID
   */
  getTimeslotIndex(timeslotId: string): number {
    return this.timeslotOrder.indexOf(timeslotId);
  }

  /**
   * Get timeslot ID for a given index
   */
  getTimeslotIdAt(index: number): string | undefined {
    return this.timeslotOrder[index];
  }

  // ============================================================================
  // Timeslot Operations
  // ============================================================================

  /**
   * Create a new timeslot and add it to the end of the timeline
   */
  createTimeslotAtEnd(): string {
    const ts = createTimeslot();
    this.timeslots.set(ts.id, ts);
    this.timeslotOrder = [...this.timeslotOrder, ts.id];
    return ts.id;
  }

  /**
   * Create a new timeslot and insert it after a specific index
   * Returns the new timeslot ID
   */
  createTimeslotAfter(afterIndex: number): string {
    const ts = createTimeslot();
    this.timeslots.set(ts.id, ts);

    const newOrder = [...this.timeslotOrder];
    newOrder.splice(afterIndex + 1, 0, ts.id);
    this.timeslotOrder = newOrder;

    return ts.id;
  }

  /**
   * Create a new timeslot and insert it before a specific index
   * Returns the new timeslot ID
   */
  createTimeslotBefore(beforeIndex: number): string {
    const ts = createTimeslot();
    this.timeslots.set(ts.id, ts);

    const newOrder = [...this.timeslotOrder];
    newOrder.splice(beforeIndex, 0, ts.id);
    this.timeslotOrder = newOrder;

    return ts.id;
  }

  /**
   * Remove a timeslot if it's empty (no cards, no mutations)
   */
  removeTimeslotIfEmpty(timeslotId: string): boolean {
    const cards = this.cardsByTimeslot.get(timeslotId);
    const mutations = this.mutationsByTimeslot.get(timeslotId);

    if ((cards?.length ?? 0) === 0 && (mutations?.length ?? 0) === 0) {
      this.timeslots.delete(timeslotId);
      this.timeslotOrder = this.timeslotOrder.filter(id => id !== timeslotId);
      return true;
    }
    return false;
  }

  /**
   * Move a timeslot to a new position
   */
  moveTimeslot(timeslotId: string, toIndex: number): void {
    const fromIndex = this.timeslotOrder.indexOf(timeslotId);
    if (fromIndex === -1 || fromIndex === toIndex) return;

    const newOrder = [...this.timeslotOrder];
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, timeslotId);
    this.timeslotOrder = newOrder;
  }

  // ============================================================================
  // Placement Operations
  // ============================================================================

  addPlacement(placement: TimelinePlacement): TimelinePlacement {
    this.allPlacements = [...this.allPlacements, placement];
    return placement;
  }

  updatePlacement(
    id: string,
    updates: Partial<Omit<TimelinePlacement, 'id' | 'createdAt'>>
  ): void {
    this.allPlacements = this.allPlacements.map((p) =>
      p.id === id
        ? { ...p, ...updates, updatedAt: new Date().toISOString() }
        : p
    );
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
  // Card/Mutation Convenience Methods (v3 - timeslot-based)
  // ============================================================================

  /**
   * Add a creation placement for an object
   * Creates a new timeslot for it if none specified
   */
  addCreation(objectId: string, timeslotId?: string): TimelinePlacement {
    const tsId = timeslotId ?? this.createTimeslotAtEnd();

    // Update the object's timeslotId
    objects.update(objectId, { timeslotId: tsId });

    const placement = createPlacement(objectId, 'creation', tsId);
    return this.addPlacement(placement);
  }

  /**
   * Add a mutation to a specific timeslot
   */
  addMutation(
    objectId: string,
    timeslotId: string,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>,
    options?: {
      attachedToCardId?: string;
      threadIds?: string[];
      contentChange?: { from: JSONContent | null; to: JSONContent | null };
      sectionChanges?: Record<string, { from: JSONContent | null; to: JSONContent | null }>;
    }
  ): TimelinePlacement {
    const placement = createPlacement(objectId, 'mutation', timeslotId, {
      attachedToCardId: options?.attachedToCardId,
      threadIds: options?.threadIds,
      mutation: {
        label,
        changes,
        contentChange: options?.contentChange,
        sectionChanges: options?.sectionChanges,
      },
    });
    return this.addPlacement(placement);
  }

  /**
   * Add a mutation in a new timeslot after the current cursor
   */
  addMutationAfterCursor(
    objectId: string,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>,
    options?: {
      attachedToCardId?: string;
      threadIds?: string[];
      contentChange?: { from: JSONContent | null; to: JSONContent | null };
    }
  ): TimelinePlacement {
    const tsId = this.createTimeslotAfter(this.cursorIndex);
    return this.addMutation(objectId, tsId, label, changes, options);
  }

  /**
   * Add a mutation to the same timeslot as a specific card
   */
  addMutationAtCard(
    objectId: string,
    cardObjectId: string,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>,
    threadIds?: string[],
    contentChange?: { from: JSONContent | null; to: JSONContent | null }
  ): TimelinePlacement {
    const cardObj = objects.get(cardObjectId);
    if (!cardObj?.timeslotId) {
      throw new Error(`Card ${cardObjectId} has no timeslot`);
    }

    return this.addMutation(objectId, cardObj.timeslotId, label, changes, {
      attachedToCardId: cardObjectId,
      threadIds,
      contentChange,
    });
  }

  /**
   * Update an existing mutation's content change
   */
  updateMutationContent(
    placementId: string,
    contentChange: { from: JSONContent | null; to: JSONContent | null }
  ): void {
    const placement = this.getPlacement(placementId);
    if (!placement?.mutation) return;

    this.updatePlacement(placementId, {
      mutation: {
        ...placement.mutation,
        contentChange,
      },
    });
  }

  /**
   * Update an existing mutation's section changes
   */
  updateMutationSectionChanges(
    placementId: string,
    sectionChanges: Record<string, { from: JSONContent | null; to: JSONContent | null }>
  ): void {
    const placement = this.getPlacement(placementId);
    if (!placement?.mutation) return;

    this.updatePlacement(placementId, {
      mutation: {
        ...placement.mutation,
        sectionChanges: {
          ...placement.mutation.sectionChanges,
          ...sectionChanges,
        },
      },
    });
  }

  // ============================================================================
  // Marker Operations (legacy support)
  // ============================================================================

  addMarker(marker: TimelineMarker): void {
    this.current.markers.push(marker);
  }

  removeMarker(id: string): void {
    this.current.markers = this.current.markers.filter((m) => m.id !== id);
  }

  getMarker(id: string): TimelineMarker | undefined {
    return this.current.markers.find((m) => m.id === id);
  }

  // ============================================================================
  // Panel Height Operations
  // ============================================================================

  setPanelHeight(height: number): void {
    this.panelHeight = this._clampPanelHeight(height);
  }

  // ============================================================================
  // Cursor Operations (index-based into timeslots)
  // ============================================================================

  /**
   * Set cursor to a specific index
   */
  setCursorIndex(index: number): void {
    const max = Math.max(0, this.timeslotOrder.length - 1);
    this.cursorIndex = Math.max(0, Math.min(index, max));
  }

  /**
   * Move cursor to the timeslot containing a specific object
   */
  moveCursorToObject(objectId: string): void {
    const obj = objects.get(objectId);
    if (obj?.timeslotId) {
      const index = this.getTimeslotIndex(obj.timeslotId);
      if (index >= 0) {
        this.setCursorIndex(index);
      }
    }
  }

  /**
   * Move cursor forward by one timeslot
   */
  cursorNext(): void {
    if (this.cursorIndex < this.timeslotOrder.length - 1) {
      this.cursorIndex++;
    }
  }

  /**
   * Move cursor backward by one timeslot
   */
  cursorPrev(): void {
    if (this.cursorIndex > 0) {
      this.cursorIndex--;
    }
  }

  /**
   * Move cursor to the first timeslot
   */
  cursorFirst(): void {
    this.cursorIndex = 0;
  }

  /**
   * Move cursor to the last timeslot
   */
  cursorLast(): void {
    this.cursorIndex = Math.max(0, this.timeslotOrder.length - 1);
  }

  // ============================================================================
  // Anchor Operations
  // ============================================================================

  /**
   * Check if there's an active anchor (we navigated away from a position)
   */
  get hasAnchor(): boolean {
    return this.anchorIndex !== null;
  }

  /**
   * Get the anchored timeslot ID
   */
  get anchoredTimeslotId(): string | null {
    if (this.anchorIndex === null) return null;
    return this.timeslotOrder[this.anchorIndex] ?? null;
  }

  /**
   * Set anchor to current cursor position before navigating away
   */
  setAnchor(): void {
    this.anchorIndex = this.cursorIndex;
  }

  /**
   * Return to anchor position and clear it
   */
  returnToAnchor(): void {
    if (this.anchorIndex !== null) {
      this.cursorIndex = this.anchorIndex;
      this.anchorIndex = null;
    }
  }

  /**
   * Clear anchor without returning to it
   */
  clearAnchor(): void {
    this.anchorIndex = null;
  }

  /**
   * Navigate to a position with anchor support
   */
  navigateWithAnchor(targetIndex: number): void {
    if (this.anchorIndex === null && this.cursorIndex !== targetIndex) {
      this.setAnchor();
    }
    this.cursorIndex = targetIndex;
  }

  // ============================================================================
  // Object State Computation (the core of the timeslot model!)
  // ============================================================================

  /**
   * Get mutations for an object at or before a given timeslot index
   * This is the key method that makes the timeslot model work correctly
   */
  getMutationsAtOrBefore(objectId: string, timeslotIndex: number): TimelinePlacement[] {
    // Get the set of valid timeslot IDs (all timeslots up to and including the index)
    const validTimeslots = new Set(this.timeslotOrder.slice(0, timeslotIndex + 1));

    return this.allPlacements
      .filter((p) =>
        p.objectId === objectId &&
        p.type === 'mutation' &&
        validTimeslots.has(p.timeslotId)
      )
      .sort((a, b) => {
        // Sort by timeslot order
        const aIndex = this.getTimeslotIndex(a.timeslotId);
        const bIndex = this.getTimeslotIndex(b.timeslotId);
        return aIndex - bIndex;
      });
  }

  /**
   * Get mutations for an object after a given timeslot index
   */
  getMutationsAfter(objectId: string, timeslotIndex: number): TimelinePlacement[] {
    const futureTimeslots = new Set(this.timeslotOrder.slice(timeslotIndex + 1));

    return this.allPlacements
      .filter((p) =>
        p.objectId === objectId &&
        p.type === 'mutation' &&
        futureTimeslots.has(p.timeslotId)
      )
      .sort((a, b) => {
        const aIndex = this.getTimeslotIndex(a.timeslotId);
        const bIndex = this.getTimeslotIndex(b.timeslotId);
        return aIndex - bIndex;
      });
  }

  /**
   * Get the computed state of an object at the current cursor position
   */
  getObjectStateAtCursor(objectId: string): ComputedObjectState {
    const currentIndex = this.cursorIndex;
    const obj = objects.get(objectId);

    const relevantMutations = this.getMutationsAtOrBefore(objectId, currentIndex);
    const futureMutations = this.getMutationsAfter(objectId, currentIndex);

    // Compute attributes by applying all mutations in order
    const computedAttributes: Record<string, unknown> = {};
    for (const mutation of relevantMutations) {
      if (mutation.mutation?.changes) {
        for (const [key, change] of Object.entries(mutation.mutation.changes)) {
          computedAttributes[key] = change.to;
        }
      }
    }

    // Compute content by applying all content mutations in order
    let computedContent: JSONContent | null = obj?.content ?? null;

    // Initialize computed sections from base object sections
    const computedSections: Record<string, JSONContent | null> = {};
    if (obj?.sections) {
      for (const section of obj.sections) {
        computedSections[section.id] = section.content;
      }
    }

    // Apply content mutations in order
    for (const mutation of relevantMutations) {
      if (mutation.mutation?.contentChange) {
        computedContent = mutation.mutation.contentChange.to;
      }
      if (mutation.mutation?.sectionChanges) {
        for (const [sectionId, change] of Object.entries(mutation.mutation.sectionChanges)) {
          computedSections[sectionId] = change.to;
        }
      }
    }

    return {
      objectId,
      cursorIndex: currentIndex,
      mutations: relevantMutations,
      computedAttributes,
      computedContent,
      computedSections,
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
      if (obj.rendered) {
        // Turning off - clear timeslotId
        objects.update(objectId, { rendered: false, timeslotId: undefined });
      } else {
        // Turning on - create new timeslot at end
        const tsId = this.createTimeslotAtEnd();
        objects.update(objectId, { rendered: true, timeslotId: tsId });
      }
    }
  }

  // ============================================================================
  // Thread Operations
  // ============================================================================

  addPlacementToThread(placementId: string, threadId: string): void {
    const placement = this.getPlacement(placementId);
    if (placement) {
      const threadIds = new Set(placement.threadIds ?? []);
      threadIds.add(threadId);
      this.updatePlacement(placementId, { threadIds: [...threadIds] });
    }
  }

  removePlacementFromThread(placementId: string, threadId: string): void {
    const placement = this.getPlacement(placementId);
    if (placement) {
      const threadIds = new Set(placement.threadIds ?? []);
      threadIds.delete(threadId);
      this.updatePlacement(placementId, { threadIds: [...threadIds] });
    }
  }

  getPlacementsInThread(threadId: string): TimelinePlacement[] {
    return this.allPlacements.filter((p) => p.threadIds?.includes(threadId));
  }

  getCardsInThread(threadId: string): AethelObject[] {
    const placementsInThread = this.getPlacementsInThread(threadId);
    const objectIds = new Set<string>();

    for (const p of placementsInThread) {
      if (p.attachedToCardId) {
        objectIds.add(p.attachedToCardId);
      }
      objectIds.add(p.objectId);
    }

    return this.renderedObjects.filter((obj) => objectIds.has(obj.id));
  }

  getCardsNotInThread(threadId: string): AethelObject[] {
    const inThreadIds = new Set(this.getCardsInThread(threadId).map((c) => c.id));
    return this.renderedObjects.filter((obj) => !inThreadIds.has(obj.id));
  }

  // ============================================================================
  // Subthread Operations
  // ============================================================================

  getPlacementsInSubthread(threadId: string, sectionId: string): TimelinePlacement[] {
    return this.allPlacements.filter((p) => {
      if (!p.threadIds?.includes(threadId)) return false;
      if (!p.subthreadIds || p.subthreadIds.length === 0) return true;
      return p.subthreadIds.includes(sectionId);
    });
  }

  addSubthreadToPlacement(placementId: string, sectionId: string): void {
    const p = this.getPlacement(placementId);
    if (!p) return;
    const currentSubthreads = p.subthreadIds ?? [];
    if (!currentSubthreads.includes(sectionId)) {
      this.updatePlacement(placementId, {
        subthreadIds: [...currentSubthreads, sectionId],
      });
    }
  }

  removeSubthreadFromPlacement(placementId: string, sectionId: string): void {
    const p = this.getPlacement(placementId);
    if (!p?.subthreadIds) return;
    const newSubthreads = p.subthreadIds.filter((id) => id !== sectionId);
    this.updatePlacement(placementId, {
      subthreadIds: newSubthreads.length > 0 ? newSubthreads : undefined,
    });
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Load timeline data (v3 format)
   */
  load(
    timelineData: Timeline,
    newPlacements: TimelinePlacement[],
    newTimeslotOrder: string[],
    newTimeslots: Timeslot[],
    newCursorIndex: number = 0,
    newPanelHeight: number = 180
  ): void {
    this.current = timelineData;
    this.allPlacements = newPlacements;
    this.timeslotOrder = newTimeslotOrder;
    this.timeslots = new Map(newTimeslots.map(ts => [ts.id, ts]));
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
    this.timeslotOrder = [];
    this.timeslots = new Map();
    this.cursorIndex = 0;
    this.panelHeight = 180;
    this.anchorIndex = null;
  }
}

export const timeline = new TimelineStore();
