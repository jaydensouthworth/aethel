/**
 * Editor State
 * Reactive state for the editor model using Svelte 5 runes
 */

import type { CursorState, SelectionState, ViewState } from './types';

// ============================================================================
// Constants
// ============================================================================

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10.0;
const ZOOM_STEP = 0.1;

// ============================================================================
// Editor State Class
// ============================================================================

export class EditorState {
	// ============================================================================
	// Core State
	// ============================================================================

	/** Current cursor position (timeslot) */
	cursor = $state<CursorState>({ slot: 0 });

	/** Currently active/open object ID */
	activeObjectId = $state<string | null>(null);

	/** Current selection */
	selection = $state<SelectionState>({
		cardIds: new Set<string>(),
		mutationIds: new Set<string>()
	});

	/** View state (zoom, scroll, snap) */
	view = $state<ViewState>({
		zoom: 1,
		scrollOffset: 0,
		snap: true
	});

	/** Clipboard for copy/paste */
	clipboard = $state<{
		type: 'card' | 'mutation' | null;
		ids: string[];
	}>({ type: null, ids: [] });

	// ============================================================================
	// History State (set by History class)
	// ============================================================================

	private _canUndo = $state(false);
	private _canRedo = $state(false);
	private _undoDescription = $state('');
	private _redoDescription = $state('');

	// ============================================================================
	// Derived State
	// ============================================================================

	canUndo = $derived(this._canUndo);
	canRedo = $derived(this._canRedo);
	undoDescription = $derived(this._undoDescription);
	redoDescription = $derived(this._redoDescription);

	hasCardSelection = $derived(this.selection.cardIds.size > 0);
	hasMutationSelection = $derived(this.selection.mutationIds.size > 0);
	hasAnySelection = $derived(this.hasCardSelection || this.hasMutationSelection);
	hasClipboard = $derived(this.clipboard.type !== null && this.clipboard.ids.length > 0);

	// ============================================================================
	// History State Updates (called by History)
	// ============================================================================

	setHistoryState(canUndo: boolean, canRedo: boolean, undoDesc: string, redoDesc: string): void {
		this._canUndo = canUndo;
		this._canRedo = canRedo;
		this._undoDescription = undoDesc;
		this._redoDescription = redoDesc;
	}

	// ============================================================================
	// Cursor Methods
	// ============================================================================

	setCursor(slot: number): void {
		this.cursor = { slot: Math.max(0, slot) };
	}

	moveCursorNext(): void {
		this.cursor = { slot: this.cursor.slot + 1 };
	}

	moveCursorPrev(): void {
		this.cursor = { slot: Math.max(0, this.cursor.slot - 1) };
	}

	// ============================================================================
	// Selection Methods
	// ============================================================================

	selectCard(cardId: string, additive = false): void {
		if (additive) {
			const newSet = new Set(this.selection.cardIds);
			newSet.add(cardId);
			this.selection = { ...this.selection, cardIds: newSet };
		} else {
			this.selection = {
				cardIds: new Set([cardId]),
				mutationIds: new Set()
			};
		}
	}

	selectMutation(mutationId: string, additive = false): void {
		if (additive) {
			const newSet = new Set(this.selection.mutationIds);
			newSet.add(mutationId);
			this.selection = { ...this.selection, mutationIds: newSet };
		} else {
			this.selection = {
				cardIds: new Set(),
				mutationIds: new Set([mutationId])
			};
		}
	}

	clearSelection(): void {
		this.selection = {
			cardIds: new Set(),
			mutationIds: new Set()
		};
	}

	toggleCardSelection(cardId: string): void {
		const newSet = new Set(this.selection.cardIds);
		if (newSet.has(cardId)) {
			newSet.delete(cardId);
		} else {
			newSet.add(cardId);
		}
		this.selection = { ...this.selection, cardIds: newSet };
	}

	toggleMutationSelection(mutationId: string): void {
		const newSet = new Set(this.selection.mutationIds);
		if (newSet.has(mutationId)) {
			newSet.delete(mutationId);
		} else {
			newSet.add(mutationId);
		}
		this.selection = { ...this.selection, mutationIds: newSet };
	}

	// ============================================================================
	// View Methods
	// ============================================================================

	zoomIn(): void {
		this.view = {
			...this.view,
			zoom: Math.min(MAX_ZOOM, this.view.zoom + ZOOM_STEP)
		};
	}

	zoomOut(): void {
		this.view = {
			...this.view,
			zoom: Math.max(MIN_ZOOM, this.view.zoom - ZOOM_STEP)
		};
	}

	resetZoom(): void {
		this.view = { ...this.view, zoom: 1 };
	}

	setZoom(zoom: number): void {
		this.view = {
			...this.view,
			zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
		};
	}

	toggleSnap(): void {
		this.view = { ...this.view, snap: !this.view.snap };
	}

	setScrollOffset(offset: number): void {
		this.view = { ...this.view, scrollOffset: Math.max(0, offset) };
	}

	// ============================================================================
	// Clipboard Methods
	// ============================================================================

	copyToClipboard(type: 'card' | 'mutation', ids: string[]): void {
		this.clipboard = { type, ids: [...ids] };
	}

	clearClipboard(): void {
		this.clipboard = { type: null, ids: [] };
	}

	// ============================================================================
	// Active Object Methods
	// ============================================================================

	setActiveObject(objectId: string | null): void {
		this.activeObjectId = objectId;
	}
}
