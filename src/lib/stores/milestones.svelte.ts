/**
 * Milestone registry store
 * Manages timeline section groupings (acts, parts, sections, etc.)
 * Uses Svelte 5 Runes for reactivity
 *
 * Note: Milestones use timeslotId to indicate which timeslot they appear BEFORE.
 * A null timeslotId means the milestone appears at the very beginning.
 * Ordering is determined by the timeline's timeslotOrder.
 */

import type { Milestone } from '$lib/types';
import { createMilestone as createMilestoneFn } from '$lib/types';

class MilestonesStore {
  // ============================================================================
  // Core State
  // ============================================================================

  _milestonesById = $state<Record<string, Milestone>>({});

  // ============================================================================
  // Derived State
  // ============================================================================

  // All milestones as array (unsorted - ordering comes from timeline's timeslotOrder)
  all = $derived.by(() => {
    return Object.values(this._milestonesById);
  });

  // Get the raw map (for imperative access)
  get map(): Record<string, Milestone> {
    return this._milestonesById;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  add(milestone: Milestone): void {
    this._milestonesById[milestone.id] = milestone;
  }

  update(id: string, updates: Partial<Milestone>): void {
    if (!this._milestonesById[id]) return;
    this._milestonesById[id] = {
      ...this._milestonesById[id],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  delete(id: string): void {
    delete this._milestonesById[id];
  }

  get(id: string): Milestone | undefined {
    return this._milestonesById[id];
  }

  getByName(name: string): Milestone | undefined {
    const searchName = name.toLowerCase();
    return this.all.find((m) => m.name.toLowerCase() === searchName);
  }

  /**
   * Create and add a new milestone
   * @param name - The milestone name
   * @param beforeTimeslotId - The timeslot this milestone appears BEFORE (null = at the start)
   */
  create(
    name: string,
    beforeTimeslotId: string | null,
    options?: {
      color?: string;
      description?: string;
      exportAs?: 'part' | 'act' | 'section' | 'book';
      exportTitle?: string;
    }
  ): Milestone {
    const milestone = createMilestoneFn(name, beforeTimeslotId, options);
    this.add(milestone);
    return milestone;
  }

  // ============================================================================
  // Timeslot Operations
  // ============================================================================

  /**
   * Move a milestone to appear before a different timeslot
   */
  moveToTimeslot(id: string, beforeTimeslotId: string | null): void {
    this.update(id, { timeslotId: beforeTimeslotId });
  }

  /**
   * Get milestones that appear before a specific timeslot
   */
  getMilestonesBeforeTimeslot(timeslotId: string | null): Milestone[] {
    return this.all.filter((m) => m.timeslotId === timeslotId);
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  load(milestonesList: Milestone[]): void {
    const map: Record<string, Milestone> = {};
    for (const milestone of milestonesList) {
      map[milestone.id] = milestone;
    }
    this._milestonesById = map;
  }

  clear(): void {
    this._milestonesById = {};
  }
}

export const milestones = new MilestonesStore();
