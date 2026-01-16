/**
 * Timeline store with multi-track placement support
 * Uses Svelte 5 Runes for reactivity
 */

import type { Timeline, TimelineMarker, TimelinePlacement, TimelineTrack } from '$lib/types';
import { createPlacement } from '$lib/types';
import { objects } from './objects.svelte';

// ============================================================================
// Types (exported for external use)
// ============================================================================

export interface ComputedObjectState {
  objectId: string;
  cursorPosition: number;
  mutations: TimelinePlacement[]; // Mutations applied (position <= cursor)
  computedAttributes: Record<string, unknown>;
  futureMutations: TimelinePlacement[]; // Mutations not yet applied
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

  tracks = $state<TimelineTrack[]>([{ id: 0, locked: false }]);

  allPlacements = $state<TimelinePlacement[]>([]);

  panelHeight = $state<number>(180);

  cursorPosition = $state<number>(0);

  // ============================================================================
  // Derived State
  // ============================================================================

  // Placements organized by track
  byTrack = $derived.by(() => {
    const byTrack = new Map<number, TimelinePlacement[]>();

    for (const p of this.allPlacements) {
      const existing = byTrack.get(p.track) ?? [];
      existing.push(p);
      byTrack.set(p.track, existing);
    }

    // Sort placements within each track by position
    for (const [track, trackPlacements] of byTrack) {
      byTrack.set(track, trackPlacements.sort((a, b) => a.position - b.position));
    }

    return byTrack;
  });

  // Track count
  trackCount = $derived(this.tracks.length);

  // Timeline bounds
  bounds = $derived.by(() => {
    if (this.allPlacements.length === 0) {
      return { min: 0, max: 10 };
    }

    const positions: number[] = [];
    for (const p of this.allPlacements) {
      positions.push(p.position);
      if (p.endPosition !== undefined) {
        positions.push(p.endPosition);
      }
    }

    return {
      min: Math.min(...positions),
      max: Math.max(...positions),
    };
  });

  // Markers from current timeline
  markers = $derived(this.current.markers);

  // All tracks (alias for consistency with old API imperative access)
  get allTracks(): TimelineTrack[] {
    return this.tracks;
  }

  // Min Panel Height
  get minPanelHeight(): number {
    return MIN_PANEL_HEIGHT;
  }

  // For book output (computed on-demand)
  // This accesses `objects` store which is also reactive
  get rendered() {
    const creationPlacements = this.allPlacements
      .filter((p) => p.type === 'creation')
      .sort((a, b) => a.position - b.position);

    return creationPlacements
      .map((p) => objects.get(p.objectId))
      .filter((obj) => obj && obj.rendered);
  }

  // ============================================================================
  // Helper functions
  // ============================================================================

  _clampPanelHeight(height: number): number {
    return Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, height));
  }

  _ensureTracksForPlacements(): void {
    if (this.allPlacements.length > 0) {
      const maxTrack = Math.max(...this.allPlacements.map((p) => p.track));
      if (this.tracks.length <= maxTrack) {
        // Direct mutation of array
        while (this.tracks.length <= maxTrack) {
          this.tracks.push({ id: this.tracks.length, locked: false });
        }
      }
    }
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
  // Convenience Methods
  // ============================================================================

  addCreation(
    objectId: string,
    position: number,
    track: number = 0,
    endPosition?: number
  ): TimelinePlacement {
    const placement = createPlacement(objectId, 'creation', position, track, { endPosition });
    return this.addPlacement(placement);
  }

  addMutation(
    objectId: string,
    position: number,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>,
    track: number = 0
  ): TimelinePlacement {
    const placement = createPlacement(objectId, 'mutation', position, track, {
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
  // Cursor Operations
  // ============================================================================

  setCursorPosition(pos: number): void {
    this.cursorPosition = pos;
  }

  moveCursorToPlacement(placementId: string): void {
    const placement = this.getPlacement(placementId);
    if (placement) {
      this.cursorPosition = placement.position;
    }
  }

  getObjectStateAtCursor(objectId: string): ComputedObjectState {
    const currentCursorPos = this.cursorPosition;
    const objectPlacements = this.getPlacementsForObject(objectId);
    const relevantMutations = objectPlacements
      .filter((p) => p.type === 'mutation' && p.position <= currentCursorPos)
      .sort((a, b) => a.position - b.position);

    const computedAttributes: Record<string, unknown> = {};
    for (const mutation of relevantMutations) {
      if (mutation.mutation?.changes) {
        for (const [key, change] of Object.entries(mutation.mutation.changes)) {
          computedAttributes[key] = change.to;
        }
      }
    }

    const futureMutations = objectPlacements
      .filter((p) => p.type === 'mutation' && p.position > currentCursorPos)
      .sort((a, b) => a.position - b.position);

    return {
      objectId,
      cursorPosition: currentCursorPos,
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
  // Bulk Operations
  // ============================================================================

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
    this.cursorPosition = 0;
    this.panelHeight = 180;
    this.tracks = [{ id: 0, locked: false }];
  }
}

export const timeline = new TimelineStore();
