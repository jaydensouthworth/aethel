/**
 * Timeline Keyboard Shortcuts (v2 - Single-track card model)
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
		action: () => timelineEditor.clearAllSelection(),
		description: 'Clear selection',
	},

	// Copy/Paste (v2 - just clipboard for now)
	{
		key: 'c',
		ctrl: true,
		action: () => timelineEditor.copySelected(),
		description: 'Copy selected',
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

	// v2 Navigation (card-based)
	{
		key: 'ArrowLeft',
		action: () => {
			timelineEditor.selectPrevCard();
			timeline.cursorPrev();
		},
		description: 'Previous card',
	},
	{
		key: 'ArrowRight',
		action: () => {
			timelineEditor.selectNextCard();
			timeline.cursorNext();
		},
		description: 'Next card',
	},
	{
		key: 'Home',
		action: () => {
			timeline.cursorFirst();
			const card = timeline.getCardAt(0);
			if (card) timelineEditor.selectCard(card.object.id);
		},
		description: 'Jump to first card',
	},
	{
		key: 'End',
		action: () => {
			timeline.cursorLast();
			const card = timeline.getCardAt(timeline.cardCount - 1);
			if (card) timelineEditor.selectCard(card.object.id);
		},
		description: 'Jump to last card',
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
