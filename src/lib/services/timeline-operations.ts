/**
 * Timeline Operations (v3 - timeslot-based model)
 * High-level operations that use commands for undo/redo support.
 */

import { createObject, createPlacement, createMilestone as createMilestoneType } from '$lib/types';
import type { AethelObject, TimelinePlacement, Milestone } from '$lib/types';
import { objects } from '$lib/stores/objects.svelte';
import { timeline } from '$lib/stores/timeline.svelte';
import { milestones } from '$lib/stores/milestones.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { timelineEditor } from '$lib/stores/timeline-editor.svelte';
import { timelineHistory } from '$lib/stores/timeline-history.svelte';
import {
	createAddPlacementCommand,
	createRemovePlacementCommand,
	createUpdatePlacementCommand,
	createAddObjectCommand,
	createDeleteObjectCommand,
	createUpdateObjectCommand,
	// v2 commands
	createAddToThreadCommand,
	createRemoveFromThreadCommand,
	createAddMilestoneCommand,
	createUpdateMilestoneCommand,
	createDeleteMilestoneCommand,
	createMoveMilestoneCommand,
	createToggleRenderedCommand,
	createToggleThreadCommand,
	// v3 Drag-drop commands
	createReorderCardCommand,
	createMoveMutationCommand,
	createDuplicateMutationCommand,
	createSwapCardsCommand,
	createStackCardsCommand,
} from './timeline-commands';

// ============================================================================
// Object Operations
// ============================================================================

/**
 * Create a new object
 */
export function createNewObject(
	name: string,
	typeId: string,
	parentId: string | null = null,
	options?: {
		rendered?: boolean;
	}
): AethelObject {
	const object = createObject(name, typeId, parentId);
	if (options?.rendered !== undefined) {
		object.rendered = options.rendered;
	}

	const command = createAddObjectCommand(object);
	timelineHistory.execute(command);

	// Select the new object
	ui.select(object.id);

	return object;
}

/**
 * Delete an object and all its placements
 */
export function deleteObject(objectId: string): void {
	const command = createDeleteObjectCommand(objectId);
	timelineHistory.execute(command);

	// Clear selection if this object was selected
	if (ui.selectedObjectId === objectId) {
		ui.clearSelection();
	}
}

/**
 * Update an object's properties
 */
export function updateObject(
	objectId: string,
	updates: Partial<Omit<AethelObject, 'id' | 'createdAt'>>
): void {
	const command = createUpdateObjectCommand(objectId, updates);
	timelineHistory.execute(command);
}

/**
 * Toggle rendered status of an object
 */
export function toggleRendered(objectId: string): void {
	const object = objects.get(objectId);
	if (!object) return;

	const command = createUpdateObjectCommand(objectId, {
		rendered: !object.rendered,
	});
	timelineHistory.execute(command);
}

// ============================================================================
// Object Property Operations (for Properties Panel)
// ============================================================================

/**
 * Update object name with undo support
 */
export function updateObjectName(objectId: string, name: string): void {
	const command = createUpdateObjectCommand(objectId, { name });
	timelineHistory.execute(command);
}

/**
 * Update object color with undo support
 */
export function updateObjectColor(objectId: string, color: string | undefined): void {
	const command = createUpdateObjectCommand(objectId, { color });
	timelineHistory.execute(command);
}

/**
 * Update object icon with undo support
 */
export function updateObjectIcon(objectId: string, icon: string | undefined): void {
	const command = createUpdateObjectCommand(objectId, { icon });
	timelineHistory.execute(command);
}

/**
 * Toggle thread status with undo support
 */
export function toggleObjectThread(objectId: string): void {
	const command = createToggleThreadCommand(objectId);
	timelineHistory.execute(command);
}

/**
 * Update thread color with undo support
 */
export function updateThreadColor(objectId: string, color: string): void {
	const command = createUpdateObjectCommand(objectId, { threadColor: color });
	timelineHistory.execute(command);
}

/**
 * Add alias with undo support
 */
export function addObjectAlias(objectId: string, alias: string): void {
	const obj = objects.get(objectId);
	if (!obj) return;
	const newAliases = [...obj.aliases, alias];
	const command = createUpdateObjectCommand(objectId, { aliases: newAliases });
	timelineHistory.execute(command);
}

/**
 * Remove alias with undo support
 */
export function removeObjectAlias(objectId: string, index: number): void {
	const obj = objects.get(objectId);
	if (!obj) return;
	const newAliases = obj.aliases.filter((_, i) => i !== index);
	const command = createUpdateObjectCommand(objectId, { aliases: newAliases });
	timelineHistory.execute(command);
}

// ============================================================================
// Placement Operations
// ============================================================================

/**
 * Delete a placement
 */
export function deletePlacement(placementId: string): void {
	if (timelineEditor.isPlacementLocked(placementId)) {
		console.warn('Cannot delete locked placement');
		return;
	}

	const command = createRemovePlacementCommand(placementId);
	timelineHistory.execute(command);

	// Clear from selection
	if (timelineEditor.isSelected(placementId)) {
		timelineEditor.clearSelection();
	}
}

/**
 * Update a placement
 */
export function updatePlacement(
	placementId: string,
	updates: Partial<Omit<TimelinePlacement, 'id' | 'createdAt'>>
): void {
	const command = createUpdatePlacementCommand(placementId, updates);
	timelineHistory.execute(command);
}

// ============================================================================
// v2: Thread Operations (threads are now objects with isThread=true)
// ============================================================================

/**
 * Add a placement to a thread (object with isThread=true)
 */
export function addPlacementToThread(placementId: string, threadId: string): void {
	const command = createAddToThreadCommand(placementId, threadId);
	timelineHistory.execute(command);
}

/**
 * Remove a placement from a thread
 */
export function removePlacementFromThread(placementId: string, threadId: string): void {
	const command = createRemoveFromThreadCommand(placementId, threadId);
	timelineHistory.execute(command);
}

/**
 * Add multiple placements to a thread
 */
export function addPlacementsToThread(placementIds: string[], threadId: string): void {
	if (placementIds.length === 0) return;

	const batch = timelineHistory.beginBatch(`Add ${placementIds.length} to thread`);
	for (const id of placementIds) {
		batch.add(createAddToThreadCommand(id, threadId));
	}
	batch.commit();
}

// ============================================================================
// v3: Milestone Operations (timeslot-based)
// ============================================================================

/**
 * Create a new milestone before a specific timeslot
 */
export function createMilestone(
	name: string,
	beforeTimeslotId: string | null,
	options?: {
		color?: string;
		description?: string;
		exportAs?: 'part' | 'act' | 'section' | 'book';
		exportTitle?: string;
	}
): Milestone {
	const milestone = createMilestoneType(name, beforeTimeslotId, options);
	const command = createAddMilestoneCommand(milestone);
	timelineHistory.execute(command);
	return milestone;
}

/**
 * Update a milestone
 */
export function updateMilestone(
	milestoneId: string,
	updates: Partial<Omit<Milestone, 'id' | 'createdAt'>>
): void {
	const command = createUpdateMilestoneCommand(milestoneId, updates);
	timelineHistory.execute(command);
}

/**
 * Delete a milestone
 */
export function deleteMilestone(milestoneId: string): void {
	const command = createDeleteMilestoneCommand(milestoneId);
	timelineHistory.execute(command);
}

/**
 * Move a milestone to appear before a different timeslot
 */
export function moveMilestone(milestoneId: string, newTimeslotId: string | null): void {
	const command = createMoveMilestoneCommand(milestoneId, newTimeslotId);
	timelineHistory.execute(command);
}

// ============================================================================
// v3: Mutation Operations (timeslot-based)
// ============================================================================

/**
 * Add a mutation at the current timeslot (attached to a card)
 */
export function addMutationAtCurrent(
	objectId: string,
	label: string,
	changes: Record<string, { from: unknown; to: unknown }> = {},
	attachedToCardId?: string,
	threadIds?: string[]
): TimelinePlacement | null {
	const currentTimeslotId = timeline.currentTimeslotId;
	if (!currentTimeslotId) return null;

	const placement = createPlacement(objectId, 'mutation', currentTimeslotId, {
		attachedToCardId,
		mutation: { label, changes },
		threadIds,
	});

	const command = createAddPlacementCommand(placement);
	timelineHistory.execute(command);

	timelineEditor.selectMutation(placement.id);

	return placement;
}

/**
 * Add a mutation at a specific timeslot
 */
export function addMutation(
	objectId: string,
	timeslotId: string,
	label: string,
	changes: Record<string, { from: unknown; to: unknown }> = {},
	options?: {
		attachedToCardId?: string;
		threadIds?: string[];
	}
): TimelinePlacement {
	const placement = createPlacement(objectId, 'mutation', timeslotId, {
		attachedToCardId: options?.attachedToCardId,
		mutation: { label, changes },
		threadIds: options?.threadIds,
	});

	const command = createAddPlacementCommand(placement);
	timelineHistory.execute(command);

	timelineEditor.selectMutation(placement.id);

	return placement;
}

/**
 * Add a mutation "between" cards (in the flow, at the current timeslot)
 * @deprecated Use addMutationAtCurrent instead
 */
export function addMutationBetweenV2(
	objectId: string,
	_position: number, // ignored in v3
	label: string,
	changes: Record<string, { from: unknown; to: unknown }> = {},
	threadIds?: string[]
): TimelinePlacement | null {
	return addMutationAtCurrent(objectId, label, changes, undefined, threadIds);
}

/**
 * Add a mutation "below" a card (attached to it)
 * @deprecated Use addMutationAtCurrent with attachedToCardId instead
 */
export function addMutationBelowV2(
	objectId: string,
	attachedToObjectId: string,
	label: string,
	changes: Record<string, { from: unknown; to: unknown }> = {},
	threadIds?: string[]
): TimelinePlacement | null {
	return addMutationAtCurrent(objectId, label, changes, attachedToObjectId, threadIds);
}

// ============================================================================
// v3: Card Operations (timeslot-based)
// ============================================================================

/**
 * Toggle whether an object is rendered (shown as a card)
 */
export function toggleCardRendered(objectId: string): void {
	const command = createToggleRenderedCommand(objectId);
	timelineHistory.execute(command);
}

/**
 * Add an object as a card to the timeline
 * Sets rendered: true and creates a creation placement at a new timeslot
 */
export function addObjectAsCard(objectId: string): void {
	const obj = objects.get(objectId);
	if (!obj) return;

	if (obj.rendered) {
		// Already a card
		return;
	}

	// Add creation via timeline store (handles timeslot creation)
	timeline.addCreation(objectId);

	// Select the new card
	timelineEditor.selectCard(objectId);
}

/**
 * Remove an object from the timeline (remove card)
 * Sets rendered: false
 */
export function removeObjectFromCards(objectId: string): void {
	const obj = objects.get(objectId);
	if (!obj) return;

	if (!obj.rendered) {
		// Not a card
		return;
	}

	const command = createToggleRenderedCommand(objectId);
	timelineHistory.execute(command);
}

// ============================================================================
// v3: Navigation Operations
// ============================================================================

/**
 * Navigate to a specific card by index
 */
export function navigateToCard(index: number): void {
	const card = timeline.getCardAt(index);
	if (card) {
		timelineEditor.selectCard(card.object.id);
		timeline.setCursorIndex(index);
	}
}

/**
 * Navigate to the next card
 */
export function navigateToNextCard(): void {
	timelineEditor.selectNextCard();
	timeline.cursorNext();
}

/**
 * Navigate to the previous card
 */
export function navigateToPrevCard(): void {
	timelineEditor.selectPrevCard();
	timeline.cursorPrev();
}

/**
 * Navigate to a card by object ID
 */
export function navigateToObject(objectId: string): void {
	const index = timeline.getCardIndex(objectId);
	if (index >= 0) {
		timelineEditor.selectCard(objectId);
		timeline.setCursorIndex(index);
	}
}

// ============================================================================
// v3: Drag and Drop Operations (timeslot-based)
// ============================================================================

/**
 * Reorder a card in the timeline by moving it to a different timeslot index.
 */
export function reorderCard(objectId: string, newTimeslotIndex: number): void {
	const obj = objects.get(objectId);
	if (!obj) return;

	const command = createReorderCardCommand(objectId, newTimeslotIndex);
	timelineHistory.execute(command);
}

/**
 * Move a mutation to a different timeslot
 */
export function moveMutation(
	placementId: string,
	options: {
		timeslotId?: string;
		attachedToCardId?: string;
	}
): void {
	const placement = timeline.getPlacement(placementId);
	if (!placement) return;

	const newTimeslotId = options.timeslotId ?? placement.timeslotId;
	const command = createMoveMutationCommand(placementId, newTimeslotId, options.attachedToCardId);
	timelineHistory.execute(command);
}

/**
 * Duplicate a mutation at a new timeslot
 */
export function duplicateMutation(
	sourcePlacementId: string,
	options: {
		timeslotId?: string;
		attachedToCardId?: string;
	}
): void {
	const source = timeline.getPlacement(sourcePlacementId);
	if (!source) return;

	const newTimeslotId = options.timeslotId ?? source.timeslotId;
	const command = createDuplicateMutationCommand(sourcePlacementId, newTimeslotId, options.attachedToCardId);
	timelineHistory.execute(command);
}

/**
 * Swap timeslots between two cards
 */
export function swapCards(objectId1: string, objectId2: string): void {
	const command = createSwapCardsCommand(objectId1, objectId2);
	timelineHistory.execute(command);
}

/**
 * Stack a card in the same timeslot as another card
 */
export function stackCards(draggedObjectId: string, targetObjectId: string): void {
	const command = createStackCardsCommand(draggedObjectId, targetObjectId);
	timelineHistory.execute(command);
}

// ============================================================================
// Legacy Stubs (for compatibility - to be removed or reimplemented)
// ============================================================================

/**
 * @deprecated Use createNewObject + addObjectAsCard instead
 */
export function createObjectWithPlacement(
	name: string,
	typeId: string,
	_position: number, // ignored in v3
	_track: number = 0, // ignored in v3
	parentId: string | null = null
): { object: AethelObject; placement: TimelinePlacement } {
	const object = createNewObject(name, typeId, parentId, { rendered: true });
	// Add to timeline at end
	timeline.addCreation(object.id);
	const placements = timeline.getPlacementsForObject(object.id);
	const placement = placements.find(p => p.type === 'creation');
	if (!placement) {
		throw new Error('Failed to create placement');
	}
	return { object, placement };
}

/**
 * @deprecated Split functionality not yet implemented in v3
 */
export function splitPlacement(_placementId: string, _splitPosition: number): { left: TimelinePlacement; right: TimelinePlacement } | null {
	console.warn('splitPlacement is not yet implemented in v3 timeslot model');
	return null;
}

/**
 * @deprecated Use duplicateMutation instead
 */
export function duplicateSelectedPlacements(): void {
	console.warn('duplicateSelectedPlacements is not yet implemented in v3 timeslot model');
}

/**
 * @deprecated Not applicable in v3 timeslot model
 */
export function moveSelectedPlacements(_deltaPosition: number, _deltaTrack: number): void {
	console.warn('moveSelectedPlacements is not applicable in v3 timeslot model');
}

/**
 * @deprecated Paste functionality not yet implemented in v3
 */
export function pasteAtCursor(): void {
	console.warn('pasteAtCursor is not yet implemented in v3 timeslot model');
}

/**
 * @deprecated Use addObjectAsCard instead
 */
export function addObjectToTimeline(objectId: string, _position: number, _track: number = 0): void {
	addObjectAsCard(objectId);
}
