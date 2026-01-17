/**
 * Thread registry store
 * Manages narrative threads (plot threads, character arcs, argument threads, etc.)
 * Uses Svelte 5 Runes for reactivity
 */

import type { Thread } from '$lib/types';
import { createThread as createThreadFn } from '$lib/types';

class ThreadsStore {
  // ============================================================================
  // Core State
  // ============================================================================

  _threadsById = $state<Record<string, Thread>>({});

  // ============================================================================
  // Derived State
  // ============================================================================

  // All threads as array, sorted by sortOrder
  all = $derived.by(() => {
    return Object.values(this._threadsById).sort((a, b) => {
      const aOrder = a.sortOrder ?? Infinity;
      const bOrder = b.sortOrder ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  });

  // Only threads visible on timeline
  visible = $derived(this.all.filter((t) => t.showOnTimeline));

  // Threads showing connecting lines
  withLines = $derived(this.all.filter((t) => t.showOnTimeline && t.showConnectingLines));

  // Get the raw map (for imperative access)
  get map(): Record<string, Thread> {
    return this._threadsById;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  add(thread: Thread): void {
    this._threadsById[thread.id] = thread;
  }

  update(id: string, updates: Partial<Thread>): void {
    if (!this._threadsById[id]) return;
    this._threadsById[id] = {
      ...this._threadsById[id],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  delete(id: string): void {
    delete this._threadsById[id];
  }

  get(id: string): Thread | undefined {
    return this._threadsById[id];
  }

  getByName(name: string): Thread | undefined {
    const searchName = name.toLowerCase();
    return this.all.find((t) => t.name.toLowerCase() === searchName);
  }

  /**
   * Create and add a new thread
   */
  create(
    name: string,
    color: string,
    options?: {
      description?: string;
      icon?: string;
      showOnTimeline?: boolean;
      showConnectingLines?: boolean;
    }
  ): Thread {
    const thread = createThreadFn(name, color, options);
    // Assign sort order to end
    thread.sortOrder = this.all.length > 0
      ? Math.max(...this.all.map((t) => t.sortOrder ?? 0)) + 1
      : 0;
    this.add(thread);
    return thread;
  }

  // ============================================================================
  // Visibility Operations
  // ============================================================================

  toggleVisibility(id: string): void {
    const thread = this._threadsById[id];
    if (thread) {
      this.update(id, { showOnTimeline: !thread.showOnTimeline });
    }
  }

  toggleConnectingLines(id: string): void {
    const thread = this._threadsById[id];
    if (thread) {
      this.update(id, { showConnectingLines: !thread.showConnectingLines });
    }
  }

  showAll(): void {
    for (const id of Object.keys(this._threadsById)) {
      this.update(id, { showOnTimeline: true });
    }
  }

  hideAll(): void {
    for (const id of Object.keys(this._threadsById)) {
      this.update(id, { showOnTimeline: false });
    }
  }

  // ============================================================================
  // Reorder Operations
  // ============================================================================

  reorder(threadId: string, newIndex: number): void {
    const thread = this._threadsById[threadId];
    if (!thread) return;

    const others = this.all.filter((t) => t.id !== threadId);
    if (newIndex < 0 || newIndex > others.length) return;

    let newSortOrder: number;
    if (others.length === 0) {
      newSortOrder = 0;
    } else if (newIndex === 0) {
      newSortOrder = (others[0].sortOrder ?? 0) - 1;
    } else if (newIndex >= others.length) {
      newSortOrder = (others[others.length - 1].sortOrder ?? 0) + 1;
    } else {
      const before = others[newIndex - 1];
      const after = others[newIndex];
      newSortOrder = ((before.sortOrder ?? 0) + (after.sortOrder ?? 0)) / 2;
    }

    this.update(threadId, { sortOrder: newSortOrder });
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  load(threadsList: Thread[]): void {
    const map: Record<string, Thread> = {};
    for (const thread of threadsList) {
      map[thread.id] = thread;
    }
    this._threadsById = map;
  }

  clear(): void {
    this._threadsById = {};
  }
}

export const threads = new ThreadsStore();
