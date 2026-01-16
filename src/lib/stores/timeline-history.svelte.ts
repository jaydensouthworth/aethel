/**
 * Timeline History Store - Undo/Redo System
 * Uses Svelte 5 Runes for reactivity
 */

import type { TimelineCommand } from '$lib/services/timeline-commands';

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY = 100;

class TimelineHistoryStore {
  // ============================================================================
  // Core State
  // ============================================================================

  undoStack = $state<TimelineCommand[]>([]);
  redoStack = $state<TimelineCommand[]>([]);
  isExecuting = $state<boolean>(false);

  // ============================================================================
  // Derived State
  // ============================================================================

  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);

  undoDescription = $derived(
    this.undoStack.length > 0 
      ? this.undoStack[this.undoStack.length - 1].description 
      : null
  );

  redoDescription = $derived(
    this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1].description
      : null
  );

  // ============================================================================
  // Operations
  // ============================================================================

  /**
   * Execute a command and add it to the undo stack.
   * Clears the redo stack (branching history).
   */
  execute(command: TimelineCommand): void {
    if (this.isExecuting) {
      // If we're already executing a command, this is a nested call
      // Just execute without recording (the parent command handles it)
      command.execute();
      return;
    }

    this.isExecuting = true;
    try {
      command.execute();

      // Add to undo stack (with size limit)
      // Create a new array to ensure reactivity triggers properly if needed,
      // though push/splice on $state array works too.
      // Using array mutation:
      if (this.undoStack.length >= MAX_HISTORY) {
        this.undoStack.shift();
      }
      this.undoStack.push(command);

      // Clear redo stack (we've branched)
      this.redoStack = [];
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    if (this.undoStack.length === 0) return false;

    this.isExecuting = true;
    try {
      const command = this.undoStack.pop()!;
      command.undo();

      this.redoStack.push(command);

      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    if (this.redoStack.length === 0) return false;

    this.isExecuting = true;
    try {
      const command = this.redoStack.pop()!;
      command.execute();

      this.undoStack.push(command);

      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get the current history state (for debugging/display)
   */
  getState(): {
    undoCount: number;
    redoCount: number;
    undoDescriptions: string[];
    redoDescriptions: string[];
  } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      undoDescriptions: this.undoStack.map((c) => c.description),
      redoDescriptions: this.redoStack.map((c) => c.description),
    };
  }

  /**
   * Begin a batch operation - subsequent commands will be grouped
   */
  beginBatch(description: string): BatchBuilder {
    return new BatchBuilder(description);
  }
}

export const timelineHistory = new TimelineHistoryStore();

// ============================================================================
// Helper class for batch operations
// ============================================================================

export class BatchBuilder {
  private commands: TimelineCommand[] = [];
  private batchDescription: string;

  constructor(description: string) {
    this.batchDescription = description;
  }

  add(command: TimelineCommand): BatchBuilder {
    this.commands.push(command);
    return this;
  }

  /**
   * Execute all commands as a single undoable operation
   */
  commit(): void {
    if (this.commands.length === 0) return;

    if (this.commands.length === 1) {
      // Single command - just execute it directly
      timelineHistory.execute(this.commands[0]);
      return;
    }

    // Multiple commands - create a compound command
    const capturedCommands = [...this.commands];
    const compoundCommand: TimelineCommand = {
      id: crypto.randomUUID(),
      type: 'batch',
      description: this.batchDescription,
      execute: () => {
        for (const cmd of capturedCommands) {
          cmd.execute();
        }
      },
      undo: () => {
        // Undo in reverse order
        for (let i = capturedCommands.length - 1; i >= 0; i--) {
          capturedCommands[i].undo();
        }
      },
    };

    timelineHistory.execute(compoundCommand);
  }

  /**
   * Cancel the batch without executing
   */
  cancel(): void {
    this.commands = [];
  }
}
