/**
 * Editor History
 * Undo/redo system for the editor
 */

import type { HistoryEntry } from './types';
import type { EditorState } from './state.svelte';

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY = 100;

// ============================================================================
// History Class
// ============================================================================

export class History {
	private undoStack: HistoryEntry[] = [];
	private redoStack: HistoryEntry[] = [];
	private isExecuting = false;
	private state: EditorState;

	constructor(state: EditorState) {
		this.state = state;
		this.updateStateFlags();
	}

	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Push a history entry onto the undo stack.
	 * Clears the redo stack (branching history).
	 */
	push(entry: HistoryEntry): void {
		if (this.isExecuting) {
			// If we're already executing (nested call), skip recording
			return;
		}

		// Add to undo stack with size limit
		if (this.undoStack.length >= MAX_HISTORY) {
			this.undoStack.shift();
		}
		this.undoStack.push(entry);

		// Clear redo stack (we've branched)
		this.redoStack = [];

		this.updateStateFlags();
	}

	/**
	 * Undo the last operation
	 */
	undo(): boolean {
		if (this.undoStack.length === 0) return false;

		this.isExecuting = true;
		try {
			const entry = this.undoStack.pop()!;
			entry.undo();
			this.redoStack.push(entry);
			this.updateStateFlags();
			return true;
		} finally {
			this.isExecuting = false;
		}
	}

	/**
	 * Redo the last undone operation
	 */
	redo(): boolean {
		if (this.redoStack.length === 0) return false;

		this.isExecuting = true;
		try {
			const entry = this.redoStack.pop()!;
			entry.redo();
			this.undoStack.push(entry);
			this.updateStateFlags();
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
		this.updateStateFlags();
	}

	/**
	 * Get undo stack length
	 */
	get undoCount(): number {
		return this.undoStack.length;
	}

	/**
	 * Get redo stack length
	 */
	get redoCount(): number {
		return this.redoStack.length;
	}

	/**
	 * Check if currently executing (to prevent nested recording)
	 */
	get executing(): boolean {
		return this.isExecuting;
	}

	// ============================================================================
	// Batch Operations
	// ============================================================================

	/**
	 * Begin a batch of operations that will be undone as a single unit.
	 * Returns a BatchBuilder to collect operations.
	 */
	beginBatch(description: string): BatchBuilder {
		return new BatchBuilder(this, description);
	}

	/**
	 * Execute an operation without recording it (for internal use during undo/redo)
	 */
	executeWithoutRecording(fn: () => void): void {
		const wasExecuting = this.isExecuting;
		this.isExecuting = true;
		try {
			fn();
		} finally {
			this.isExecuting = wasExecuting;
		}
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private updateStateFlags(): void {
		const canUndo = this.undoStack.length > 0;
		const canRedo = this.redoStack.length > 0;
		const undoDesc = canUndo ? this.undoStack[this.undoStack.length - 1].description : '';
		const redoDesc = canRedo ? this.redoStack[this.redoStack.length - 1].description : '';

		this.state.setHistoryState(canUndo, canRedo, undoDesc, redoDesc);
	}
}

// ============================================================================
// Batch Builder
// ============================================================================

/**
 * Builder for batch operations that are undone as a single unit
 */
export class BatchBuilder {
	private history: History;
	private description: string;
	private undoFns: (() => void)[] = [];
	private redoFns: (() => void)[] = [];

	constructor(history: History, description: string) {
		this.history = history;
		this.description = description;
	}

	/**
	 * Add an operation to the batch
	 */
	add(undo: () => void, redo: () => void): this {
		this.undoFns.push(undo);
		this.redoFns.push(redo);
		return this;
	}

	/**
	 * Commit the batch as a single history entry
	 */
	commit(): void {
		if (this.undoFns.length === 0) return;

		const undoFns = [...this.undoFns];
		const redoFns = [...this.redoFns];

		this.history.push({
			operationId: 'batch',
			description: this.description,
			undo: () => {
				// Undo in reverse order
				for (let i = undoFns.length - 1; i >= 0; i--) {
					undoFns[i]();
				}
			},
			redo: () => {
				// Redo in forward order
				for (const fn of redoFns) {
					fn();
				}
			},
			timestamp: Date.now()
		});
	}
}
