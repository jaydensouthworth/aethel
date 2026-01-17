/**
 * The Editor Model
 * Single source of truth for all editor state and operations.
 * All UI is visualization of this model.
 */

import { EditorState } from './state.svelte';
import { History } from './history';
import { OperationsRegistry } from './operations';
import { Keyboard, formatShortcut } from './keyboard';
import type { Operation, Shortcut, ShortcutBinding, OperationContext } from './types';

// Import existing stores to delegate operations
import { timeline, timelineEditor, timelineHistory, ui, objects } from '$lib/stores';

// Re-export types
export type {
	Operation,
	Shortcut,
	ShortcutBinding,
	OperationContext,
	CursorState,
	SelectionState,
	ViewState,
	OperationCategory
} from './types';

export { formatShortcut } from './keyboard';

// ============================================================================
// Editor Class
// ============================================================================

class Editor {
	// ============================================================================
	// Public State (readable by UI)
	// ============================================================================

	readonly state: EditorState;

	// ============================================================================
	// Internal Components
	// ============================================================================

	private _history: History;
	private _registry: OperationsRegistry;
	private _keyboard: Keyboard;

	// ============================================================================
	// Constructor
	// ============================================================================

	constructor() {
		// Create state first
		this.state = new EditorState();

		// Create history (needs state)
		this._history = new History(this.state);

		// Create registry (needs state and history)
		this._registry = new OperationsRegistry(this.state, this._history);

		// Create keyboard (needs operations access)
		this._keyboard = new Keyboard(
			() => this._registry.getAll(),
			() => this._registry.buildContext(),
			(id, args) => this._registry.execute(id, args)
		);

		// Register all operations
		this.registerOperations();

		// Load custom shortcuts
		this._keyboard.loadCustomShortcuts();

		// Build shortcut map
		this._keyboard.rebuildShortcutMap();
	}

	// ============================================================================
	// Operations API
	// ============================================================================

	readonly ops = {
		// Cursor
		cursor: {
			next: () => this.execute('cursor.next'),
			prev: () => this.execute('cursor.prev'),
			moveTo: (slot: number) => this.execute('cursor.moveTo', { slot }),
			jumpToFirst: () => this.execute('cursor.first'),
			jumpToLast: () => this.execute('cursor.last'),
			goToMutation: (mutationId: string) => this.execute('cursor.goToMutation', { mutationId })
		},

		// Selection
		selection: {
			selectCard: (id: string, additive = false) =>
				this.execute('selection.card', { id, additive }),
			selectMutation: (id: string, additive = false) =>
				this.execute('selection.mutation', { id, additive }),
			selectAll: () => this.execute('selection.all'),
			clear: () => this.execute('selection.clear'),
			toggleCard: (id: string) => this.execute('selection.toggleCard', { id }),
			toggleMutation: (id: string) => this.execute('selection.toggleMutation', { id })
		},

		// Edit
		edit: {
			delete: () => this.execute('edit.delete'),
			copy: () => this.execute('edit.copy'),
			paste: () => this.execute('edit.paste'),
			duplicate: () => this.execute('edit.duplicate')
		},

		// View
		view: {
			zoomIn: () => this.execute('view.zoomIn'),
			zoomOut: () => this.execute('view.zoomOut'),
			resetZoom: () => this.execute('view.resetZoom'),
			toggleSnap: () => this.execute('view.toggleSnap'),
			setScrollOffset: (offset: number) => this.execute('view.setScrollOffset', { offset })
		},

		// History
		history: {
			undo: () => this.execute('history.undo'),
			redo: () => this.execute('history.redo'),
			clear: () => this.execute('history.clear')
		},

		// Object - cursor moves IF rendered, stays IF not
		object: {
			select: (id: string) => this.execute('object.select', { id }),
			create: (data: Record<string, unknown>) => this.execute('object.create', { data }),
			delete: (id: string) => this.execute('object.delete', { id }),
			update: (id: string, data: Record<string, unknown>) =>
				this.execute('object.update', { id, data })
		},

		// Card (render/unrender an object on timeline)
		card: {
			render: (objectId: string, slot: number) =>
				this.execute('card.render', { objectId, slot }),
			unrender: (objectId: string) => this.execute('card.unrender', { objectId })
		},

		// Mutation (property changes at timeslots - NOT cards)
		mutation: {
			goTo: (mutationId: string) => this.execute('mutation.goTo', { mutationId }),
			create: (objectId: string, slot: number, data: Record<string, unknown>) =>
				this.execute('mutation.create', { objectId, slot, data }),
			delete: (mutationId: string) => this.execute('mutation.delete', { mutationId }),
			update: (mutationId: string, data: Record<string, unknown>) =>
				this.execute('mutation.update', { mutationId, data })
		}
	};

	// ============================================================================
	// Keyboard API
	// ============================================================================

	/**
	 * Handle a keyboard event. Returns true if handled.
	 */
	handleKeyDown(e: KeyboardEvent): boolean {
		return this._keyboard.handleKeyDown(e);
	}

	readonly shortcuts = {
		get: (opId: string) => this._keyboard.getShortcut(opId),
		set: (opId: string, shortcut: Shortcut | null) => this._keyboard.setShortcut(opId, shortcut),
		reset: (opId: string) => this._keyboard.resetShortcut(opId),
		resetAll: () => this._keyboard.resetAll(),
		getAll: () => this._keyboard.getAllBindings(),
		checkConflict: (shortcut: Shortcut, excludeOpId?: string) =>
			this._keyboard.checkConflict(shortcut, excludeOpId),
		format: formatShortcut
	};

	// ============================================================================
	// History Access (for UI display)
	// ============================================================================

	readonly history = {
		undo: () => this._history.undo(),
		redo: () => this._history.redo(),
		clear: () => this._history.clear(),
		get undoCount() {
			return editor._history.undoCount;
		},
		get redoCount() {
			return editor._history.redoCount;
		}
	};

	// ============================================================================
	// Operations Access (for advanced use)
	// ============================================================================

	/**
	 * Get an operation by ID
	 */
	getOperation(id: string): Operation | undefined {
		return this._registry.get(id);
	}

	/**
	 * Check if an operation can be executed
	 */
	canExecute(id: string): boolean {
		return this._registry.canExecute(id);
	}

	/**
	 * Get current operation context
	 */
	getContext(): OperationContext {
		return this._registry.buildContext();
	}

	// ============================================================================
	// Internal Methods
	// ============================================================================

	private execute(opId: string, args?: Record<string, unknown>): boolean {
		return this._registry.execute(opId, args);
	}

	private registerOperations(): void {
		// Cursor operations - delegate to timeline store
		// IMPORTANT: Cursor is the single source of truth. Selection follows cursor.
		// We must NOT double-update by calling both cursor methods and selectCard
		// (which internally moves cursor again).
		this._registry.registerAll([
			{
				id: 'cursor.next',
				label: 'Next Slot',
				category: 'cursor',
				defaultShortcut: { key: 'ArrowRight' },
				precondition: () => timeline.cursorIndex < timeline.cardCount - 1,
				execute: () => {
					// Move cursor first
					timeline.cursorNext();
					// Then sync selection to cursor WITHOUT moving cursor again
					const card = timeline.getCardAt(timeline.cursorIndex);
					if (card) {
						// Update selection state directly without calling selectCard
						// (which would call moveCursorToObject and cause double-update)
						timelineEditor.selectedCardId = card.object.id;
						timelineEditor.selectedMutationIds = new Set();
						ui.select(card.object.id);
					}
				}
			},
			{
				id: 'cursor.prev',
				label: 'Previous Slot',
				category: 'cursor',
				defaultShortcut: { key: 'ArrowLeft' },
				precondition: () => timeline.cursorIndex > 0,
				execute: () => {
					// Move cursor first
					timeline.cursorPrev();
					// Then sync selection to cursor WITHOUT moving cursor again
					const card = timeline.getCardAt(timeline.cursorIndex);
					if (card) {
						timelineEditor.selectedCardId = card.object.id;
						timelineEditor.selectedMutationIds = new Set();
						ui.select(card.object.id);
					}
				}
			},
			{
				id: 'cursor.moveTo',
				label: 'Move to Slot',
				category: 'cursor',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.slot === 'number') {
						timeline.setCursorIndex(args.slot);
						// Sync selection
						const card = timeline.getCardAt(timeline.cursorIndex);
						if (card) {
							timelineEditor.selectedCardId = card.object.id;
							timelineEditor.selectedMutationIds = new Set();
							ui.select(card.object.id);
						}
					}
				}
			},
			{
				id: 'cursor.first',
				label: 'First Slot',
				category: 'cursor',
				defaultShortcut: { key: 'Home' },
				precondition: () => true,
				execute: () => {
					timeline.cursorFirst();
					const card = timeline.getCardAt(0);
					if (card) {
						timelineEditor.selectedCardId = card.object.id;
						timelineEditor.selectedMutationIds = new Set();
						ui.select(card.object.id);
					}
				}
			},
			{
				id: 'cursor.last',
				label: 'Last Slot',
				category: 'cursor',
				defaultShortcut: { key: 'End' },
				precondition: () => true,
				execute: () => {
					timeline.cursorLast();
					const card = timeline.getCardAt(timeline.cardCount - 1);
					if (card) {
						timelineEditor.selectedCardId = card.object.id;
						timelineEditor.selectedMutationIds = new Set();
						ui.select(card.object.id);
					}
				}
			},
			{
				id: 'cursor.goToMutation',
				label: 'Go to Mutation',
				category: 'cursor',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.mutationId === 'string') {
						const placement = timeline.getPlacement(args.mutationId);
						if (placement) {
							// Navigate to the timeslot containing this mutation
							const targetIndex = timeline.getTimeslotIndex(placement.timeslotId);
							if (targetIndex >= 0) {
								timeline.setCursorIndex(targetIndex);
								ui.setActiveMutation(args.mutationId);
							}
						}
					}
				}
			}
		]);

		// Selection operations - delegate to timelineEditor store
		this._registry.registerAll([
			{
				id: 'selection.card',
				label: 'Select Card',
				category: 'selection',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.id === 'string') {
						// For now, just use selectCard (toggle not implemented)
						timelineEditor.selectCard(args.id);
						// Also select the object in UI
						ui.select(args.id);
					}
				}
			},
			{
				id: 'selection.mutation',
				label: 'Select Mutation',
				category: 'selection',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.id === 'string') {
						if (args.additive) {
							timelineEditor.toggleMutationSelection(args.id);
						} else {
							timelineEditor.selectMutation(args.id);
						}
					}
				}
			},
			{
				id: 'selection.all',
				label: 'Select All',
				category: 'selection',
				defaultShortcut: { key: 'a', ctrl: true },
				precondition: () => true,
				execute: () => {
					timelineEditor.selectAll();
				}
			},
			{
				id: 'selection.clear',
				label: 'Clear Selection',
				category: 'selection',
				defaultShortcut: { key: 'Escape' },
				precondition: () => timelineEditor.hasAnySelection || timeline.hasAnchor,
				execute: () => {
					// If we have an anchor (navigated to view object state), return to it first
					if (timeline.hasAnchor) {
						timeline.returnToAnchor();
						ui.clearActiveMutation();
					}
					timelineEditor.clearAllSelection();
				}
			},
			{
				id: 'selection.toggleCard',
				label: 'Toggle Card Selection',
				category: 'selection',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.id === 'string') {
						// Toggle: if selected, clear; if not, select
						if (timelineEditor.selectedCardId === args.id) {
							timelineEditor.clearCardSelection();
						} else {
							timelineEditor.selectCard(args.id);
						}
					}
				}
			},
			{
				id: 'selection.toggleMutation',
				label: 'Toggle Mutation Selection',
				category: 'selection',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.id === 'string') {
						timelineEditor.toggleMutationSelection(args.id);
					}
				}
			}
		]);

		// Edit operations - delegate to timelineEditor/objects stores
		this._registry.registerAll([
			{
				id: 'edit.delete',
				label: 'Delete',
				category: 'edit',
				defaultShortcut: { key: 'Delete' },
				precondition: () => timelineEditor.hasAnySelection,
				undoable: true,
				execute: () => {
					// Delete selected placements
					const selectedIds = Array.from(timelineEditor.selectedPlacementIds);
					for (const id of selectedIds) {
						timeline.removePlacement(id);
					}
					// Delete selected mutations
					const mutationIds = Array.from(timelineEditor.selectedMutationIds);
					for (const id of mutationIds) {
						timeline.removePlacement(id);
					}
					timelineEditor.clearAllSelection();
				}
			},
			{
				id: 'edit.copy',
				label: 'Copy',
				category: 'edit',
				defaultShortcut: { key: 'c', ctrl: true },
				precondition: () => timelineEditor.hasAnySelection,
				execute: () => {
					timelineEditor.copySelected();
				}
			},
			{
				id: 'edit.paste',
				label: 'Paste',
				category: 'edit',
				defaultShortcut: { key: 'v', ctrl: true },
				precondition: () => false, // Not yet implemented
				undoable: true,
				execute: () => {
					// TODO: Implement paste functionality
				}
			},
			{
				id: 'edit.duplicate',
				label: 'Duplicate',
				category: 'edit',
				defaultShortcut: { key: 'd', ctrl: true },
				precondition: () => false, // Not yet implemented
				undoable: true,
				execute: () => {
					// TODO: Implement duplicate functionality
				}
			}
		]);

		// View operations - delegate to timelineEditor store
		this._registry.registerAll([
			{
				id: 'view.zoomIn',
				label: 'Zoom In',
				category: 'view',
				defaultShortcut: { key: '=', ctrl: true },
				precondition: () => true,
				execute: () => {
					timelineEditor.zoomIn();
				}
			},
			{
				id: 'view.zoomOut',
				label: 'Zoom Out',
				category: 'view',
				defaultShortcut: { key: '-', ctrl: true },
				precondition: () => true,
				execute: () => {
					timelineEditor.zoomOut();
				}
			},
			{
				id: 'view.resetZoom',
				label: 'Reset Zoom',
				category: 'view',
				defaultShortcut: { key: '0', ctrl: true },
				precondition: () => true,
				execute: () => {
					timelineEditor.resetZoom();
				}
			},
			{
				id: 'view.toggleSnap',
				label: 'Toggle Snap',
				category: 'view',
				defaultShortcut: { key: 'n' },
				precondition: () => true,
				execute: () => {
					timelineEditor.toggleSnap();
				}
			},
			{
				id: 'view.setScrollOffset',
				label: 'Set Scroll',
				category: 'view',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.offset === 'number') {
						timelineEditor.setScrollOffset(args.offset);
					}
				}
			}
		]);

		// History operations - delegate to timelineHistory store
		this._registry.registerAll([
			{
				id: 'history.undo',
				label: 'Undo',
				category: 'history',
				defaultShortcut: { key: 'z', ctrl: true },
				precondition: () => timelineHistory.canUndo,
				execute: () => {
					timelineHistory.undo();
				}
			},
			{
				id: 'history.redo',
				label: 'Redo',
				category: 'history',
				defaultShortcut: { key: 'z', ctrl: true, shift: true },
				precondition: () => timelineHistory.canRedo,
				execute: () => {
					timelineHistory.redo();
				}
			},
			{
				id: 'history.redoAlt',
				label: 'Redo (Ctrl+Y)',
				category: 'history',
				defaultShortcut: { key: 'y', ctrl: true },
				precondition: () => timelineHistory.canRedo,
				execute: () => {
					timelineHistory.redo();
				}
			},
			{
				id: 'history.clear',
				label: 'Clear History',
				category: 'history',
				precondition: () => true,
				execute: () => {
					timelineHistory.clear();
				}
			}
		]);

		// Object operations - delegate to objects/ui stores
		this._registry.registerAll([
			{
				id: 'object.select',
				label: 'Select Object',
				category: 'object',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.id === 'string') {
						const objectId = args.id;
						ui.select(objectId);

						const obj = objects.get(objectId);
						if (!obj) return;

						// Use anchor index if available (we're temporarily viewing something else)
						// Otherwise use current cursor index
						const referenceIndex = timeline.anchorIndex ?? timeline.cursorIndex;

						// Get mutations at or before the reference timeslot
						// This is trivial with the timeslot model!
						const relevantMutations = timeline.getMutationsAtOrBefore(objectId, referenceIndex);

						if (relevantMutations.length > 0) {
							// Get the most recent mutation (last in the sorted array)
							const mostRecentMutation = relevantMutations[relevantMutations.length - 1];

							// Navigate to that mutation's timeslot
							const targetIndex = timeline.getTimeslotIndex(mostRecentMutation.timeslotId);
							if (targetIndex >= 0) {
								// Navigate with anchor so user can return to previous position
								timeline.navigateWithAnchor(targetIndex);
								ui.setActiveMutation(mostRecentMutation.id);

								// Update selection state
								const card = timeline.getCardAt(targetIndex);
								if (card) {
									timelineEditor.selectedCardId = card.object.id;
									timelineEditor.selectedMutationIds = new Set();
								}
							}
						} else if (obj.rendered && obj.timeslotId) {
							// Object has no mutations but is rendered - move to its timeslot
							const cardIndex = timeline.getTimeslotIndex(obj.timeslotId);
							if (cardIndex >= 0) {
								// Object has no mutations - clicking on it makes it the new "home"
								timeline.clearAnchor();
								timeline.setCursorIndex(cardIndex);
								timelineEditor.selectedCardId = objectId;
								timelineEditor.selectedMutationIds = new Set();
							}
						}
						// If object is not rendered and has no mutations, just select it in UI
						// (cursor stays where it is - this is a non-timeline object)
					}
				}
			},
			{
				id: 'object.create',
				label: 'Create Object',
				category: 'object',
				precondition: () => true,
				undoable: true,
				execute: (_ctx, args) => {
					if (args && typeof args.name === 'string' && typeof args.typeId === 'string') {
						const obj = objects.create(args.name, args.typeId, args.parentId as string | undefined);
						ui.select(obj.id);
					}
				}
			},
			{
				id: 'object.delete',
				label: 'Delete Object',
				category: 'object',
				precondition: () => true,
				undoable: true,
				execute: (_ctx, args) => {
					if (args && typeof args.id === 'string') {
						objects.delete(args.id);
					}
				}
			},
			{
				id: 'object.update',
				label: 'Update Object',
				category: 'object',
				precondition: () => true,
				undoable: true,
				execute: (_ctx, args) => {
					if (args && typeof args.id === 'string' && args.data) {
						objects.update(args.id, args.data as Record<string, unknown>);
					}
				}
			}
		]);

		// Card operations - delegate to timeline/objects stores
		this._registry.registerAll([
			{
				id: 'card.render',
				label: 'Render Object',
				category: 'card',
				precondition: () => true,
				undoable: true,
				execute: (_ctx, args) => {
					if (args && typeof args.objectId === 'string') {
						// Mark object as rendered and add to timeline at the end
						objects.update(args.objectId, { rendered: true });
						timeline.addCreation(args.objectId);
					}
				}
			},
			{
				id: 'card.unrender',
				label: 'Unrender Object',
				category: 'card',
				precondition: () => true,
				undoable: true,
				execute: (_ctx, args) => {
					if (args && typeof args.objectId === 'string') {
						// Remove from timeline and mark as not rendered
						const placements = timeline.getPlacementsForObject(args.objectId);
						for (const p of placements) {
							if (p.type === 'creation') {
								timeline.removePlacement(p.id);
							}
						}
						objects.update(args.objectId, { rendered: false });
					}
				}
			}
		]);

		// Mutation operations - delegate to timeline/ui stores
		this._registry.registerAll([
			{
				id: 'mutation.goTo',
				label: 'Go to Mutation',
				category: 'mutation',
				precondition: () => true,
				execute: (_ctx, args) => {
					if (args && typeof args.mutationId === 'string') {
						const placement = timeline.getPlacement(args.mutationId);
						if (placement) {
							// Navigate to the timeslot containing this mutation
							const targetIndex = timeline.getTimeslotIndex(placement.timeslotId);
							if (targetIndex >= 0) {
								timeline.setCursorIndex(targetIndex);
								ui.setActiveMutation(args.mutationId);
							}
						}
					}
				}
			},
			{
				id: 'mutation.create',
				label: 'Create Mutation',
				category: 'mutation',
				precondition: () => true,
				undoable: true,
				execute: (_ctx, args) => {
					if (args && typeof args.objectId === 'string') {
						// Get the current timeslot or create one if needed
						const timeslotId = timeline.currentTimeslotId;
						if (!timeslotId) return;

						const label = typeof args.label === 'string' ? args.label : 'Property change';
						const changes = (args.changes as Record<string, { from: unknown; to: unknown }>) || {};
						timeline.addMutation(args.objectId, timeslotId, label, changes);
					}
				}
			},
			{
				id: 'mutation.delete',
				label: 'Delete Mutation',
				category: 'mutation',
				precondition: () => true,
				undoable: true,
				execute: (_ctx, args) => {
					if (args && typeof args.mutationId === 'string') {
						timeline.removePlacement(args.mutationId);
					}
				}
			},
			{
				id: 'mutation.update',
				label: 'Update Mutation',
				category: 'mutation',
				precondition: () => true,
				undoable: true,
				execute: (_ctx, args) => {
					if (args && typeof args.mutationId === 'string' && args.data) {
						const placement = timeline.getPlacement(args.mutationId);
						if (placement && placement.mutation) {
							// Update mutation properties
							timeline.updatePlacement(args.mutationId, {
								mutation: { ...placement.mutation, ...(args.data as Record<string, unknown>) }
							});
						}
					}
				}
			}
		]);

		// Also register + shortcut for zoom in
		this._registry.register({
			id: 'view.zoomInAlt',
			label: 'Zoom In (+)',
			category: 'view',
			defaultShortcut: { key: '+', ctrl: true },
			precondition: () => true,
			execute: () => {
				timelineEditor.zoomIn();
			}
		});

		// Lock toggle
		this._registry.register({
			id: 'edit.toggleLock',
			label: 'Toggle Lock',
			category: 'edit',
			defaultShortcut: { key: 'l', ctrl: true },
			precondition: () => timelineEditor.hasAnySelection,
			execute: () => {
				timelineEditor.toggleLockSelected();
			}
		});
	}
}

// ============================================================================
// Singleton Export
// ============================================================================

export const editor = new Editor();
