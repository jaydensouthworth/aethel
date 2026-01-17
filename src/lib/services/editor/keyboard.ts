/**
 * Editor Keyboard Handler
 * Maps keyboard shortcuts to operations with user customization support
 */

import type { Shortcut, ShortcutBinding, StoredShortcuts, Operation, OperationContext } from './types';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'aethel_shortcuts';

// ============================================================================
// Keyboard Class
// ============================================================================

export class Keyboard {
	/** Maps shortcut hash -> operation ID */
	private shortcutMap = new Map<string, string>();

	/** User overrides (operationId -> shortcut or null) */
	private overrides = new Map<string, Shortcut | null>();

	/** Reference to operation registry for execution */
	private getOperations: () => Map<string, Operation>;
	private getContext: () => OperationContext;
	private executeOperation: (id: string, args?: Record<string, unknown>) => boolean;

	constructor(
		getOperations: () => Map<string, Operation>,
		getContext: () => OperationContext,
		executeOperation: (id: string, args?: Record<string, unknown>) => boolean
	) {
		this.getOperations = getOperations;
		this.getContext = getContext;
		this.executeOperation = executeOperation;
	}

	// ============================================================================
	// Initialization
	// ============================================================================

	/**
	 * Load custom shortcuts from localStorage
	 */
	loadCustomShortcuts(): void {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (!stored) return;

			const data: StoredShortcuts = JSON.parse(stored);
			if (data.version !== 1) return;

			this.overrides.clear();
			for (const override of data.overrides) {
				this.overrides.set(override.operationId, override.shortcut);
			}

			this.rebuildShortcutMap();
		} catch (e) {
			console.warn('Failed to load keyboard shortcuts:', e);
		}
	}

	/**
	 * Rebuild the shortcut map from operations and overrides
	 */
	rebuildShortcutMap(): void {
		this.shortcutMap.clear();

		for (const [opId, operation] of this.getOperations()) {
			const shortcut = this.getEffectiveShortcut(opId);
			if (shortcut) {
				const hash = this.hashShortcut(shortcut);
				this.shortcutMap.set(hash, opId);
			}
		}
	}

	// ============================================================================
	// Keyboard Event Handler
	// ============================================================================

	/**
	 * Handle a keydown event. Returns true if handled.
	 */
	handleKeyDown(e: KeyboardEvent): boolean {
		// Skip if in input field
		const target = e.target as HTMLElement;
		if (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable
		) {
			return false;
		}

		// Build shortcut from event
		const shortcut: Shortcut = {
			key: e.key,
			ctrl: e.ctrlKey || e.metaKey,
			shift: e.shiftKey,
			alt: e.altKey
		};

		const hash = this.hashShortcut(shortcut);
		const opId = this.shortcutMap.get(hash);

		if (!opId) {
			return false;
		}

		// Check precondition
		const operation = this.getOperations().get(opId);
		if (!operation) {
			return false;
		}

		const context = this.getContext();
		if (!operation.precondition(context)) {
			return false;
		}

		// Execute
		const executed = this.executeOperation(opId);
		if (executed) {
			e.preventDefault();
			e.stopPropagation();
		}

		return executed;
	}

	// ============================================================================
	// Shortcut Management
	// ============================================================================

	/**
	 * Get the effective shortcut for an operation (user override or default)
	 */
	getEffectiveShortcut(opId: string): Shortcut | null {
		if (this.overrides.has(opId)) {
			return this.overrides.get(opId) ?? null;
		}
		const operation = this.getOperations().get(opId);
		return operation?.defaultShortcut ?? null;
	}

	/**
	 * Get the shortcut for an operation (alias for getEffectiveShortcut)
	 */
	getShortcut(opId: string): Shortcut | null {
		return this.getEffectiveShortcut(opId);
	}

	/**
	 * Set a custom shortcut for an operation
	 */
	setShortcut(opId: string, shortcut: Shortcut | null): void {
		this.overrides.set(opId, shortcut);
		this.saveOverrides();
		this.rebuildShortcutMap();
	}

	/**
	 * Reset a shortcut to its default
	 */
	resetShortcut(opId: string): void {
		this.overrides.delete(opId);
		this.saveOverrides();
		this.rebuildShortcutMap();
	}

	/**
	 * Reset all shortcuts to defaults
	 */
	resetAll(): void {
		this.overrides.clear();
		this.saveOverrides();
		this.rebuildShortcutMap();
	}

	/**
	 * Check if an operation has a custom shortcut
	 */
	hasCustomShortcut(opId: string): boolean {
		return this.overrides.has(opId);
	}

	/**
	 * Check for shortcut conflicts
	 */
	checkConflict(shortcut: Shortcut, excludeOpId?: string): string | null {
		const hash = this.hashShortcut(shortcut);

		for (const [opId, operation] of this.getOperations()) {
			if (opId === excludeOpId) continue;

			const opShortcut = this.getEffectiveShortcut(opId);
			if (opShortcut && this.hashShortcut(opShortcut) === hash) {
				return opId;
			}
		}

		return null;
	}

	/**
	 * Get all shortcut bindings for settings UI
	 */
	getAllBindings(): ShortcutBinding[] {
		const bindings: ShortcutBinding[] = [];

		for (const [opId, operation] of this.getOperations()) {
			bindings.push({
				operation,
				shortcut: this.getEffectiveShortcut(opId),
				isCustom: this.hasCustomShortcut(opId)
			});
		}

		return bindings;
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	/**
	 * Create a hash string from a shortcut for map lookup
	 */
	private hashShortcut(shortcut: Shortcut): string {
		const parts: string[] = [];
		if (shortcut.ctrl) parts.push('ctrl');
		if (shortcut.shift) parts.push('shift');
		if (shortcut.alt) parts.push('alt');
		parts.push(shortcut.key.toLowerCase());
		return parts.join('+');
	}

	/**
	 * Save overrides to localStorage
	 */
	private saveOverrides(): void {
		try {
			const data: StoredShortcuts = {
				version: 1,
				overrides: Array.from(this.overrides.entries()).map(([operationId, shortcut]) => ({
					operationId,
					shortcut
				}))
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch (e) {
			console.warn('Failed to save keyboard shortcuts:', e);
		}
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: Shortcut | null): string {
	if (!shortcut) return '';

	const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
	const parts: string[] = [];

	if (shortcut.ctrl) parts.push(isMac ? '\u2318' : 'Ctrl');
	if (shortcut.shift) parts.push(isMac ? '\u21E7' : 'Shift');
	if (shortcut.alt) parts.push(isMac ? '\u2325' : 'Alt');

	// Format special keys
	let keyDisplay = shortcut.key;
	switch (shortcut.key.toLowerCase()) {
		case 'arrowleft':
			keyDisplay = '\u2190';
			break;
		case 'arrowright':
			keyDisplay = '\u2192';
			break;
		case 'arrowup':
			keyDisplay = '\u2191';
			break;
		case 'arrowdown':
			keyDisplay = '\u2193';
			break;
		case 'delete':
			keyDisplay = 'Del';
			break;
		case 'backspace':
			keyDisplay = '\u232B';
			break;
		case 'escape':
			keyDisplay = 'Esc';
			break;
		case 'enter':
			keyDisplay = '\u21B5';
			break;
		case ' ':
			keyDisplay = 'Space';
			break;
		default:
			keyDisplay = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
	}

	parts.push(keyDisplay);
	return parts.join(isMac ? '' : '+');
}
