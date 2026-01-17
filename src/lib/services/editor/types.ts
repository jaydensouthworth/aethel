/**
 * Editor Types
 * Core type definitions for the unified editor model
 */

// ============================================================================
// Cursor & Selection
// ============================================================================

/** The cursor position on the timeline */
export interface CursorState {
	slot: number; // Current timeslot (0..N)
}

/** Currently selected items */
export interface SelectionState {
	cardIds: Set<string>; // Selected card IDs (rendered objects)
	mutationIds: Set<string>; // Selected mutation IDs
}

// ============================================================================
// View State
// ============================================================================

/** View/display state */
export interface ViewState {
	zoom: number; // 0.1 to 10.0
	scrollOffset: number; // Horizontal scroll in pixels
	snap: boolean; // Snap to grid
}

// ============================================================================
// Operations
// ============================================================================

/** Operation categories for organization in settings UI */
export type OperationCategory =
	| 'cursor'
	| 'selection'
	| 'edit'
	| 'view'
	| 'history'
	| 'object'
	| 'card'
	| 'mutation';

/** Context passed to operations for precondition checks and execution */
export interface OperationContext {
	// Cursor
	cursor: CursorState;

	// Active object
	activeObjectId: string | null;

	// Selection
	selection: SelectionState;
	hasCardSelection: boolean;
	hasMutationSelection: boolean;
	hasAnySelection: boolean;

	// View
	view: ViewState;

	// History
	canUndo: boolean;
	canRedo: boolean;

	// Clipboard
	hasClipboard: boolean;
}

/** Operation definition */
export interface Operation {
	/** Unique identifier (e.g., 'cursor.next', 'edit.delete') */
	id: string;

	/** Human-readable label for UI */
	label: string;

	/** Optional description for tooltips */
	description?: string;

	/** Category for organization in settings */
	category: OperationCategory;

	/** Default keyboard shortcut */
	defaultShortcut?: Shortcut;

	/** Precondition - when is this operation available? */
	precondition: (ctx: OperationContext) => boolean;

	/** Execute the operation */
	execute: (ctx: OperationContext, args?: Record<string, unknown>) => void;

	/** Is this operation undoable? */
	undoable?: boolean;
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

/** Keyboard shortcut configuration */
export interface Shortcut {
	key: string; // e.g., 'Delete', 'z', 'ArrowLeft'
	ctrl?: boolean; // Ctrl/Cmd modifier
	shift?: boolean; // Shift modifier
	alt?: boolean; // Alt/Option modifier
}

/** User shortcut override stored in localStorage */
export interface ShortcutOverride {
	operationId: string;
	shortcut: Shortcut | null; // null = disabled
}

/** Stored shortcuts schema */
export interface StoredShortcuts {
	version: 1;
	overrides: ShortcutOverride[];
}

// ============================================================================
// History (Undo/Redo)
// ============================================================================

/** A history entry for undo/redo */
export interface HistoryEntry {
	operationId: string;
	description: string;
	undo: () => void;
	redo: () => void;
	timestamp: number;
}

// ============================================================================
// Shortcut Binding Info (for Settings UI)
// ============================================================================

/** Full binding info for settings UI */
export interface ShortcutBinding {
	operation: Operation;
	shortcut: Shortcut | null;
	isCustom: boolean;
}
