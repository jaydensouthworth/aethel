/**
 * Editor Operations Registry
 * Manages all editor operations and their execution
 */

import type { Operation, OperationContext, OperationCategory, HistoryEntry } from './types';
import type { EditorState } from './state.svelte';
import type { History } from './history';

// ============================================================================
// Operations Registry Class
// ============================================================================

export class OperationsRegistry {
	/** All registered operations */
	private operations = new Map<string, Operation>();

	/** Operations indexed by category */
	private operationsByCategory = new Map<OperationCategory, Operation[]>();

	/** Reference to state for context building */
	private state: EditorState;

	/** Reference to history for undo/redo */
	private history: History;

	constructor(state: EditorState, history: History) {
		this.state = state;
		this.history = history;
	}

	// ============================================================================
	// Registration
	// ============================================================================

	/**
	 * Register a single operation
	 */
	register(operation: Operation): void {
		if (this.operations.has(operation.id)) {
			console.warn(`Operation "${operation.id}" already registered. Overwriting.`);
		}

		this.operations.set(operation.id, operation);

		// Index by category
		const categoryOps = this.operationsByCategory.get(operation.category) ?? [];
		const existingIndex = categoryOps.findIndex((op) => op.id === operation.id);
		if (existingIndex >= 0) {
			categoryOps[existingIndex] = operation;
		} else {
			categoryOps.push(operation);
		}
		this.operationsByCategory.set(operation.category, categoryOps);
	}

	/**
	 * Register multiple operations
	 */
	registerAll(operations: Operation[]): void {
		for (const op of operations) {
			this.register(op);
		}
	}

	// ============================================================================
	// Access
	// ============================================================================

	/**
	 * Get an operation by ID
	 */
	get(id: string): Operation | undefined {
		return this.operations.get(id);
	}

	/**
	 * Get all operations
	 */
	getAll(): Map<string, Operation> {
		return this.operations;
	}

	/**
	 * Get operations by category
	 */
	getByCategory(category: OperationCategory): Operation[] {
		return this.operationsByCategory.get(category) ?? [];
	}

	/**
	 * Get all categories with their operations
	 */
	getAllByCategory(): Map<OperationCategory, Operation[]> {
		return new Map(this.operationsByCategory);
	}

	// ============================================================================
	// Context Building
	// ============================================================================

	/**
	 * Build the current operation context from state
	 */
	buildContext(): OperationContext {
		return {
			cursor: this.state.cursor,
			activeObjectId: this.state.activeObjectId,
			selection: this.state.selection,
			hasCardSelection: this.state.hasCardSelection,
			hasMutationSelection: this.state.hasMutationSelection,
			hasAnySelection: this.state.hasAnySelection,
			view: this.state.view,
			canUndo: this.state.canUndo,
			canRedo: this.state.canRedo,
			hasClipboard: this.state.hasClipboard
		};
	}

	// ============================================================================
	// Execution
	// ============================================================================

	/**
	 * Execute an operation by ID
	 * Returns true if executed successfully
	 */
	execute(id: string, args?: Record<string, unknown>): boolean {
		const operation = this.operations.get(id);
		if (!operation) {
			console.warn(`Operation "${id}" not found`);
			return false;
		}

		const context = this.buildContext();

		// Check precondition
		if (!operation.precondition(context)) {
			return false;
		}

		// Execute
		try {
			operation.execute(context, args);
			return true;
		} catch (error) {
			console.error(`Error executing operation "${id}":`, error);
			return false;
		}
	}

	/**
	 * Execute an undoable operation
	 * Automatically creates history entry
	 */
	executeUndoable(
		id: string,
		args: Record<string, unknown> | undefined,
		undoFn: () => void,
		redoFn: () => void,
		description: string
	): boolean {
		const operation = this.operations.get(id);
		if (!operation) {
			console.warn(`Operation "${id}" not found`);
			return false;
		}

		const context = this.buildContext();

		// Check precondition
		if (!operation.precondition(context)) {
			return false;
		}

		// Execute
		try {
			operation.execute(context, args);

			// Record in history
			if (operation.undoable) {
				const entry: HistoryEntry = {
					operationId: id,
					description,
					undo: undoFn,
					redo: redoFn,
					timestamp: Date.now()
				};
				this.history.push(entry);
			}

			return true;
		} catch (error) {
			console.error(`Error executing operation "${id}":`, error);
			return false;
		}
	}

	/**
	 * Check if an operation can be executed
	 */
	canExecute(id: string): boolean {
		const operation = this.operations.get(id);
		if (!operation) return false;

		const context = this.buildContext();
		return operation.precondition(context);
	}

	/**
	 * Get all operations that can currently be executed
	 */
	getAvailableOperations(): Operation[] {
		const context = this.buildContext();
		return Array.from(this.operations.values()).filter((op) => op.precondition(context));
	}
}
