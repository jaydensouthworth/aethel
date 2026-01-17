/**
 * Milestone registry store
 * Manages timeline section groupings (acts, parts, sections, etc.)
 * Uses Svelte 5 Runes for reactivity
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

  // All milestones as array, sorted by afterIndex
  all = $derived.by(() => {
    return Object.values(this._milestonesById).sort((a, b) => a.afterIndex - b.afterIndex);
  });

  // Milestones grouped by the index they appear after
  byAfterIndex = $derived.by(() => {
    const map = new Map<number, Milestone>();
    for (const milestone of this.all) {
      map.set(milestone.afterIndex, milestone);
    }
    return map;
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
   * Get milestone that appears after a specific rendered index
   */
  getMilestoneAfterIndex(index: number): Milestone | undefined {
    return this.byAfterIndex.get(index);
  }

  /**
   * Check if there's a milestone after a given index
   */
  hasMilestoneAfterIndex(index: number): boolean {
    return this.byAfterIndex.has(index);
  }

  /**
   * Create and add a new milestone
   */
  create(
    name: string,
    afterIndex: number,
    options?: {
      color?: string;
      description?: string;
      exportAs?: 'part' | 'act' | 'section' | 'book';
      exportTitle?: string;
    }
  ): Milestone {
    const milestone = createMilestoneFn(name, afterIndex, options);
    this.add(milestone);
    return milestone;
  }

  // ============================================================================
  // Position Operations
  // ============================================================================

  /**
   * Move a milestone to a new position
   */
  move(id: string, newAfterIndex: number): void {
    this.update(id, { afterIndex: newAfterIndex });
  }

  /**
   * Shift all milestones at or after a given index by a delta
   * Useful when cards are inserted/removed
   */
  shiftAfter(startIndex: number, delta: number): void {
    for (const milestone of this.all) {
      if (milestone.afterIndex >= startIndex) {
        this.update(milestone.id, {
          afterIndex: Math.max(0, milestone.afterIndex + delta),
        });
      }
    }
  }

  /**
   * Get the section name for a given card index
   * Returns the most recent milestone name before or at this index
   */
  getSectionForIndex(index: number): Milestone | undefined {
    let currentSection: Milestone | undefined;
    for (const milestone of this.all) {
      if (milestone.afterIndex < index) {
        currentSection = milestone;
      } else {
        break;
      }
    }
    return currentSection;
  }

  /**
   * Get all card indices that belong to a milestone's section
   * Returns [startIndex, endIndex) range
   */
  getSectionRange(milestoneId: string, totalCards: number): [number, number] | undefined {
    const milestone = this._milestonesById[milestoneId];
    if (!milestone) return undefined;

    const startIndex = milestone.afterIndex + 1;

    // Find next milestone
    const sortedMilestones = this.all;
    const currentIdx = sortedMilestones.findIndex((m) => m.id === milestoneId);

    let endIndex: number;
    if (currentIdx < sortedMilestones.length - 1) {
      endIndex = sortedMilestones[currentIdx + 1].afterIndex + 1;
    } else {
      endIndex = totalCards;
    }

    return [startIndex, endIndex];
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
