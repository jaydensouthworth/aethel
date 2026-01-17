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
	createChangeMutationDisplayCommand,
	createToggleRenderedCommand,
	// Drag-drop commands
	createReorderCardCommand,
	createMoveMutationCommand,
	createDuplicateMutationCommand,
} from './timeline-commands';
import type { MutationDisplay } from '$lib/types';

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
// v2: Milestone Operations
// ============================================================================

/**
 * Create a new milestone
 */
export function createMilestone(
	name: string,
	afterIndex: number,
	options?: {
		color?: string;
		description?: string;
		exportAs?: 'part' | 'act' | 'section' | 'book';
		exportTitle?: string;
	}
): Milestone {
	const milestone = createMilestoneType(name, afterIndex, options);
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
 * Move a milestone to a new position
 */
export function moveMilestone(milestoneId: string, newAfterIndex: number): void {
	const command = createMoveMilestoneCommand(milestoneId, newAfterIndex);
	timelineHistory.execute(command);
}

// ============================================================================
// v2: Mutation Display Operations
// ============================================================================

/**
 * Set a mutation to display between cards (in the flow)
 */
export function setMutationDisplayBetween(placementId: string, afterIndex: number): void {
	const command = createChangeMutationDisplayCommand(placementId, 'between', {
		afterRenderedIndex: afterIndex,
	});
	timelineHistory.execute(command);
}

/**
 * Set a mutation to display below a card (attached)
 */
export function setMutationDisplayBelow(placementId: string, attachedToObjectId: string): void {
	const command = createChangeMutationDisplayCommand(placementId, 'below', {
		attachedToObjectId,
	});
	timelineHistory.execute(command);
}

/**
 * Add a mutation between cards (v2)
 */
export function addMutationBetweenV2(
	objectId: string,
	afterRenderedIndex: number,
	label: string,
	changes: Record<string, { from: unknown; to: unknown }> = {},
	threadIds?: string[]
): TimelinePlacement {
	const placement = createPlacement(objectId, 'mutation', {
		mutationDisplay: 'between',
		afterRenderedIndex,
		mutation: { label, changes },
		threadIds,
	});

	const command = createAddPlacementCommand(placement);
	timelineHistory.execute(command);

	timelineEditor.selectMutation(placement.id);

	return placement;
}

/**
 * Add a mutation below a card (v2)
 */
export function addMutationBelowV2(
	objectId: string,
	attachedToObjectId: string,
	label: string,
	changes: Record<string, { from: unknown; to: unknown }> = {},
	threadIds?: string[]
): TimelinePlacement {
	const placement = createPlacement(objectId, 'mutation', {
		mutationDisplay: 'below',
		attachedToObjectId,
		mutation: { label, changes },
		threadIds,
	});

	const command = createAddPlacementCommand(placement);
	timelineHistory.execute(command);

	timelineEditor.selectMutation(placement.id);

	return placement;
}

// ============================================================================
// v2: Card Operations
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
 * Sets rendered: true and optionally creates a creation placement
 */
export function addObjectAsCard(objectId: string): void {
	const obj = objects.get(objectId);
	if (!obj) return;

	if (obj.rendered) {
		// Already a card
		return;
	}

	const batch = timelineHistory.beginBatch(`Add "${obj.name}" to timeline`);

	// Set rendered to true
	batch.add(createToggleRenderedCommand(objectId));

	// Create a creation placement
	const placement = createPlacement(objectId, 'creation', {});
	batch.add(createAddPlacementCommand(placement));

	batch.commit();

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
// v2: Navigation Operations
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
// v2: Drag and Drop Operations
// ============================================================================

/**
 * Reorder a card in the timeline by changing its sortOrder
 * targetIndex is the position to insert at (0-indexed)
 */
export function reorderCard(objectId: string, targetIndex: number): void {
	const obj = objects.get(objectId);
	if (!obj) return;

	// Calculate new sortOrder based on target position
	const renderedObjects = timeline.renderedObjects;
	let newSortOrder: number;

	if (targetIndex <= 0) {
		// Move to beginning
		const first = renderedObjects[0];
		newSortOrder = (first?.sortOrder ?? 0) - 1;
	} else if (targetIndex >= renderedObjects.length) {
		// Move to end
		const last = renderedObjects[renderedObjects.length - 1];
		newSortOrder = (last?.sortOrder ?? 0) + 1;
	} else {
		// Insert between two cards
		const before = renderedObjects[targetIndex - 1];
		const after = renderedObjects[targetIndex];
		newSortOrder = ((before?.sortOrder ?? 0) + (after?.sortOrder ?? 0)) / 2;
	}

	const command = createReorderCardCommand(objectId, newSortOrder);
	timelineHistory.execute(command);
}

/**
 * Move a mutation to a new position
 */
export function moveMutation(
	placementId: string,
	newPosition: {
		display: MutationDisplay;
		attachedToObjectId?: string;
		afterRenderedIndex?: number;
	}
): void {
	const command = createMoveMutationCommand(placementId, newPosition);
	timelineHistory.execute(command);
}

/**
 * Duplicate a mutation at a new position
 */
export function duplicateMutation(
	sourcePlacementId: string,
	newPosition: {
		display: MutationDisplay;
		attachedToObjectId?: string;
		afterRenderedIndex?: number;
	}
): void {
	const command = createDuplicateMutationCommand(sourcePlacementId, newPosition);
	timelineHistory.execute(command);
}
