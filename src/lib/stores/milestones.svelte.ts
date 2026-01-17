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

  // All milestones as array, sorted by position
  all = $derived.by(() => {
    return Object.values(this._milestonesById).sort((a, b) => a.position - b.position);
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
   */
  create(
    name: string,
    position: number,
    options?: {
      color?: string;
      description?: string;
      exportAs?: 'part' | 'act' | 'section' | 'book';
      exportTitle?: string;
    }
  ): Milestone {
    const milestone = createMilestoneFn(name, position, options);
    this.add(milestone);
    return milestone;
  }

  // ============================================================================
  // Position Operations
  // ============================================================================

  /**
   * Move a milestone to a new position
   */
  move(id: string, newPosition: number): void {
    this.update(id, { position: newPosition });
  }

  /**
   * Get the milestone at or before a given position
   * Returns the most recent milestone before this position
   */
  getMilestoneForPosition(position: number): Milestone | undefined {
    let currentSection: Milestone | undefined;
    for (const milestone of this.all) {
      if (milestone.position < position) {
        currentSection = milestone;
      } else {
        break;
      }
    }
    return currentSection;
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
