/**
 * Timeline Keyboard Shortcuts
 * Handles keyboard shortcuts for timeline editing operations.
 */

import { timeline, timelineEditor, timelineHistory } from '$lib/stores';
import * as ops from './timeline-operations';

interface ShortcutConfig {
	key: string;
	ctrl?: boolean;
	shift?: boolean;
	alt?: boolean;
	action: () => void;
	description: string;
}

const shortcuts: ShortcutConfig[] = [
	// Tools
	{
		key: 'v',
		action: () => timelineEditor.setTool('select'),
		description: 'Selection tool',
	},
	{
		key: 'b',
		action: () => timelineEditor.setTool('razor'),
		description: 'Razor tool',
	},
	{
		key: 's',
		action: () => timelineEditor.setTool('slip'),
		description: 'Slip tool',
	},
	{
		key: 'd',
		action: () => timelineEditor.setTool('slide'),
		description: 'Slide tool',
	},

	// Movement mode
	{
		key: 'm',
		action: () => timelineEditor.toggleMovementMode(),
		description: 'Toggle movement mode',
	},

	// Snap
	{
		key: 'n',
		action: () => timelineEditor.toggleSnap(),
		description: 'Toggle snap',
	},

	// Selection
	{
		key: 'a',
		ctrl: true,
		action: () => timelineEditor.selectAll(),
		description: 'Select all',
	},
	{
		key: 'Escape',
		action: () => timelineEditor.clearSelection(),
		description: 'Clear selection',
	},

	// Delete
	{
		key: 'Delete',
		action: () => ops.deleteSelectedPlacements(),
		description: 'Delete selected',
	},
	{
		key: 'Backspace',
		action: () => ops.deleteSelectedPlacements(),
		description: 'Delete selected',
	},

	// Duplicate
	{
		key: 'd',
		ctrl: true,
		action: () => ops.duplicateSelectedPlacements(),
		description: 'Duplicate selected',
	},

	// Copy/Paste
	{
		key: 'c',
		ctrl: true,
		action: () => timelineEditor.copySelected(),
		description: 'Copy selected',
	},
	{
		key: 'v',
		ctrl: true,
		action: () => ops.pasteAtCursor(),
		description: 'Paste at cursor',
	},

	// Grouping
	{
		key: 'g',
		ctrl: true,
		action: () => timelineEditor.groupSelected(),
		description: 'Group selected',
	},
	{
		key: 'g',
		ctrl: true,
		shift: true,
		action: () => timelineEditor.ungroupSelected(),
		description: 'Ungroup selected',
	},

	// Lock
	{
		key: 'l',
		ctrl: true,
		action: () => timelineEditor.toggleLockSelected(),
		description: 'Toggle lock',
	},

	// Undo/Redo
	{
		key: 'z',
		ctrl: true,
		action: () => timelineHistory.undo(),
		description: 'Undo',
	},
	{
		key: 'z',
		ctrl: true,
		shift: true,
		action: () => timelineHistory.redo(),
		description: 'Redo',
	},
	{
		key: 'y',
		ctrl: true,
		action: () => timelineHistory.redo(),
		description: 'Redo',
	},

	// Zoom
	{
		key: '=',
		ctrl: true,
		action: () => timelineEditor.zoomIn(),
		description: 'Zoom in',
	},
	{
		key: '+',
		ctrl: true,
		action: () => timelineEditor.zoomIn(),
		description: 'Zoom in',
	},
	{
		key: '-',
		ctrl: true,
		action: () => timelineEditor.zoomOut(),
		description: 'Zoom out',
	},
	{
		key: '0',
		ctrl: true,
		action: () => timelineEditor.resetZoom(),
		description: 'Reset zoom',
	},

	// Nudge
	{
		key: 'ArrowLeft',
		action: () => ops.nudgeSelectedPlacements('left'),
		description: 'Nudge left',
	},
	{
		key: 'ArrowRight',
		action: () => ops.nudgeSelectedPlacements('right'),
		description: 'Nudge right',
	},
	{
		key: 'ArrowUp',
		action: () => ops.moveSelectedPlacements(0, -1),
		description: 'Move to track above',
	},
	{
		key: 'ArrowDown',
		action: () => ops.moveSelectedPlacements(0, 1),
		description: 'Move to track below',
	},

	// Navigation
	{
		key: 'Home',
		action: () => timeline.setCursorPosition(timeline.bounds.min),
		description: 'Jump to start',
	},
	{
		key: 'End',
		action: () => timeline.setCursorPosition(timeline.bounds.max),
		description: 'Jump to end',
	},
];

/**
 * Handle a keydown event and execute matching shortcut
 * Returns true if a shortcut was handled
 */
export function handleKeyDown(e: KeyboardEvent): boolean {
	// Don't handle shortcuts when typing in input fields
	const target = e.target as HTMLElement;
	if (
		target.tagName === 'INPUT' ||
		target.tagName === 'TEXTAREA' ||
		target.isContentEditable
	) {
		return false;
	}

	// Find matching shortcut
	const match = shortcuts.find(
		(s) =>
			s.key.toLowerCase() === e.key.toLowerCase() &&
			!!s.ctrl === (e.ctrlKey || e.metaKey) &&
			!!s.shift === e.shiftKey &&
			!!s.alt === e.altKey
	);

	if (match) {
		e.preventDefault();
		match.action();
		return true;
	}

	return false;
}

/**
 * Get all shortcuts for display in help/settings
 */
export function getShortcuts(): ShortcutConfig[] {
	return shortcuts;
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
	const parts: string[] = [];

	if (shortcut.ctrl) parts.push('Ctrl');
	if (shortcut.shift) parts.push('Shift');
	if (shortcut.alt) parts.push('Alt');

	// Format special keys
	let keyDisplay = shortcut.key;
	switch (shortcut.key) {
		case 'ArrowLeft':
			keyDisplay = '←';
			break;
		case 'ArrowRight':
			keyDisplay = '→';
			break;
		case 'ArrowUp':
			keyDisplay = '↑';
			break;
		case 'ArrowDown':
			keyDisplay = '↓';
			break;
		case 'Delete':
			keyDisplay = 'Del';
			break;
		case 'Backspace':
			keyDisplay = '⌫';
			break;
		case 'Escape':
			keyDisplay = 'Esc';
			break;
		default:
			keyDisplay = shortcut.key.toUpperCase();
	}

	parts.push(keyDisplay);

	return parts.join('+');
}
