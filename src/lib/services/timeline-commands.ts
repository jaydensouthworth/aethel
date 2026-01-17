/**
 * Timeline Commands (v3 - timeslot-based model)
 * Command classes for undo/redo support.
 * Each command encapsulates an operation that can be executed and undone.
 */

import type { AethelObject, TimelinePlacement, Milestone } from '$lib/types';
import { objects } from '$lib/stores/objects.svelte';
import { timeline } from '$lib/stores/timeline.svelte';
import { milestones } from '$lib/stores/milestones.svelte';

// ============================================================================
// Base Interface
// ============================================================================

export interface TimelineCommand {
	id: string;
	type: string;
	description: string;
	execute: () => void;
	undo: () => void;
}

// ============================================================================
// Placement Commands
// ============================================================================

/**
 * Add a placement to the timeline
 */
export function createAddPlacementCommand(
	placement: TimelinePlacement
): TimelineCommand {
	return {
		id: crypto.randomUUID(),
		type: 'add-placement',
		description: `Add placement`,
		execute: () => {
			timeline.addPlacement(placement);
		},
		undo: () => {
			timeline.removePlacement(placement.id);
		},
	};
}

/**
 * Remove a placement from the timeline
 */
export function createRemovePlacementCommand(
	placementId: string
): TimelineCommand {
	const placement = timeline.getPlacement(placementId);
	if (!placement) {
		throw new Error(`Placement ${placementId} not found`);
	}

	// Store a copy for undo
	const placementCopy = { ...placement };

	return {
		id: crypto.randomUUID(),
		type: 'remove-placement',
		description: `Remove placement`,
		execute: () => {
			timeline.removePlacement(placementId);
		},
		undo: () => {
			timeline.addPlacement(placementCopy);
		},
	};
}

/**
 * Update a placement's properties
 */
export function createUpdatePlacementCommand(
	placementId: string,
	updates: Partial<Omit<TimelinePlacement, 'id' | 'createdAt'>>
): TimelineCommand {
	const placement = timeline.getPlacement(placementId);
	if (!placement) {
		throw new Error(`Placement ${placementId} not found`);
	}

	// Store original values for undo
	const originalValues: Record<string, unknown> = {};
	for (const key of Object.keys(updates)) {
		originalValues[key] = placement[key as keyof TimelinePlacement];
	}

	return {
		id: crypto.randomUUID(),
		type: 'update-placement',
		description: `Update placement`,
		execute: () => {
			timeline.updatePlacement(placementId, updates);
		},
		undo: () => {
			timeline.updatePlacement(
				placementId,
				originalValues as Partial<Omit<TimelinePlacement, 'id' | 'createdAt'>>
			);
		},
	};
}

// ============================================================================
// Object Commands
// ============================================================================

/**
 * Create a new object
 */
export function createAddObjectCommand(object: AethelObject): TimelineCommand {
	return {
		id: crypto.randomUUID(),
		type: 'add-object',
		description: `Create "${object.name}"`,
		execute: () => {
			objects.add(object);
		},
		undo: () => {
			objects.delete(object.id);
		},
	};
}

/**
 * Delete an object (and all its placements)
 */
export function createDeleteObjectCommand(objectId: string): TimelineCommand {
	const object = objects.get(objectId);
	if (!object) {
		throw new Error(`Object ${objectId} not found`);
	}

	// Store copies for undo
	const objectCopy = { ...object };
	const placementsCopy = timeline.getPlacementsForObject(objectId).map((p) => ({
		...p,
	}));

	return {
		id: crypto.randomUUID(),
		type: 'delete-object',
		description: `Delete "${object.name}"`,
		execute: () => {
			// Remove all placements first
			timeline.removeAllForObject(objectId);
			// Then remove the object
			objects.delete(objectId);
		},
		undo: () => {
			// Restore object first
			objects.add(objectCopy);
			// Then restore all placements
			for (const p of placementsCopy) {
				timeline.addPlacement(p);
			}
		},
	};
}

/**
 * Update an object's properties
 */
export function createUpdateObjectCommand(
	objectId: string,
	updates: Partial<Omit<AethelObject, 'id' | 'createdAt'>>
): TimelineCommand {
	const object = objects.get(objectId);
	if (!object) {
		throw new Error(`Object ${objectId} not found`);
	}

	// Store original values for undo
	const originalValues: Record<string, unknown> = {};
	for (const key of Object.keys(updates)) {
		originalValues[key] = object[key as keyof AethelObject];
	}

	return {
		id: crypto.randomUUID(),
		type: 'update-object',
		description: `Update "${object.name}"`,
		execute: () => {
			objects.update(objectId, updates);
		},
		undo: () => {
			objects.update(
				objectId,
				originalValues as Partial<Omit<AethelObject, 'id' | 'createdAt'>>
			);
		},
	};
}

// ============================================================================
// v2: Thread Commands (threads are now objects with isThread=true)
// Thread CRUD is handled through objects store; these commands manage
// the association between placements and thread objects via threadIds
// ============================================================================

/**
 * Add a placement to a thread (object with isThread=true)
 */
export function createAddToThreadCommand(
	placementId: string,
	threadId: string
): TimelineCommand {
	return {
		id: crypto.randomUUID(),
		type: 'add-to-thread',
		description: `Add to thread`,
		execute: () => {
			timeline.addPlacementToThread(placementId, threadId);
		},
		undo: () => {
			timeline.removePlacementFromThread(placementId, threadId);
		},
	};
}

/**
 * Remove a placement from a thread
 */
export function createRemoveFromThreadCommand(
	placementId: string,
	threadId: string
): TimelineCommand {
	return {
		id: crypto.randomUUID(),
		type: 'remove-from-thread',
		description: `Remove from thread`,
		execute: () => {
			timeline.removePlacementFromThread(placementId, threadId);
		},
		undo: () => {
			timeline.addPlacementToThread(placementId, threadId);
		},
	};
}

// ============================================================================
// v3: Milestone Commands (timeslot-based)
// ============================================================================

/**
 * Add a milestone
 */
export function createAddMilestoneCommand(milestone: Milestone): TimelineCommand {
	return {
		id: crypto.randomUUID(),
		type: 'add-milestone',
		description: `Add milestone "${milestone.name}"`,
		execute: () => {
			milestones.add(milestone);
		},
		undo: () => {
			milestones.delete(milestone.id);
		},
	};
}

/**
 * Update a milestone
 */
export function createUpdateMilestoneCommand(
	milestoneId: string,
	updates: Partial<Omit<Milestone, 'id' | 'createdAt'>>
): TimelineCommand {
	const milestone = milestones.get(milestoneId);
	if (!milestone) {
		throw new Error(`Milestone ${milestoneId} not found`);
	}

	const originalValues: Record<string, unknown> = {};
	for (const key of Object.keys(updates)) {
		originalValues[key] = milestone[key as keyof Milestone];
	}

	return {
		id: crypto.randomUUID(),
		type: 'update-milestone',
		description: `Update milestone "${milestone.name}"`,
		execute: () => {
			milestones.update(milestoneId, updates);
		},
		undo: () => {
			milestones.update(milestoneId, originalValues as Partial<Omit<Milestone, 'id' | 'createdAt'>>);
		},
	};
}

/**
 * Delete a milestone
 */
export function createDeleteMilestoneCommand(milestoneId: string): TimelineCommand {
	const milestone = milestones.get(milestoneId);
	if (!milestone) {
		throw new Error(`Milestone ${milestoneId} not found`);
	}

	const milestoneCopy = { ...milestone };

	return {
		id: crypto.randomUUID(),
		type: 'delete-milestone',
		description: `Delete milestone "${milestone.name}"`,
		execute: () => {
			milestones.delete(milestoneId);
		},
		undo: () => {
			milestones.add(milestoneCopy);
		},
	};
}

/**
 * Move a milestone to appear before a different timeslot
 */
export function createMoveMilestoneCommand(
	milestoneId: string,
	newTimeslotId: string | null
): TimelineCommand {
	const milestone = milestones.get(milestoneId);
	if (!milestone) {
		throw new Error(`Milestone ${milestoneId} not found`);
	}

	const originalTimeslotId = milestone.timeslotId;

	return {
		id: crypto.randomUUID(),
		type: 'move-milestone',
		description: `Move milestone "${milestone.name}"`,
		execute: () => {
			milestones.moveToTimeslot(milestoneId, newTimeslotId);
		},
		undo: () => {
			milestones.moveToTimeslot(milestoneId, originalTimeslotId);
		},
	};
}

// ============================================================================
// v3: Card Commands (timeslot-based)
// ============================================================================

/**
 * Toggle an object's thread status
 */
export function createToggleThreadCommand(objectId: string): TimelineCommand {
	const obj = objects.get(objectId);
	if (!obj) {
		throw new Error(`Object ${objectId} not found`);
	}

	const wasThread = obj.isThread ?? false;
	const originalThreadColor = obj.threadColor;

	return {
		id: crypto.randomUUID(),
		type: 'toggle-thread',
		description: wasThread ? `Remove "${obj.name}" as thread` : `Set "${obj.name}" as thread`,
		execute: () => {
			objects.update(objectId, { isThread: !wasThread });
		},
		undo: () => {
			objects.update(objectId, { isThread: wasThread, threadColor: originalThreadColor });
		},
	};
}

/**
 * Toggle an object's rendered status (adds/removes from timeline cards)
 */
export function createToggleRenderedCommand(objectId: string): TimelineCommand {
	const obj = objects.get(objectId);
	if (!obj) {
		throw new Error(`Object ${objectId} not found`);
	}

	const originalRendered = obj.rendered;
	const originalTimeslotId = obj.timeslotId;

	return {
		id: crypto.randomUUID(),
		type: 'toggle-rendered',
		description: originalRendered ? `Remove "${obj.name}" from timeline` : `Add "${obj.name}" to timeline`,
		execute: () => {
			if (originalRendered) {
				// Removing from timeline - clear timeslotId
				objects.update(objectId, { rendered: false, timeslotId: undefined });
			} else {
				// Adding to timeline - will need a timeslot assigned separately
				objects.update(objectId, { rendered: true });
			}
		},
		undo: () => {
			objects.update(objectId, { rendered: originalRendered, timeslotId: originalTimeslotId });
		},
	};
}

// ============================================================================
// v3: Timeslot-based Drag and Drop Commands
// ============================================================================

/**
 * Reorder a card in the timeline by moving it to a different timeslot index.
 */
export function createReorderCardCommand(
	objectId: string,
	newTimeslotIndex: number
): TimelineCommand {
	const obj = objects.get(objectId);
	if (!obj) {
		throw new Error(`Object ${objectId} not found`);
	}

	const originalTimeslotId = obj.timeslotId;
	// Get or create the target timeslot
	const targetTimeslotId = timeline.getTimeslotIdAt(newTimeslotIndex);

	return {
		id: crypto.randomUUID(),
		type: 'reorder-card',
		description: `Reorder "${obj.name}"`,
		execute: () => {
			if (targetTimeslotId) {
				objects.update(objectId, { timeslotId: targetTimeslotId });
			}
		},
		undo: () => {
			objects.update(objectId, { timeslotId: originalTimeslotId });
		},
	};
}

/**
 * Move a mutation to a different timeslot
 */
export function createMoveMutationCommand(
	placementId: string,
	newTimeslotId: string,
	newAttachedToCardId?: string
): TimelineCommand {
	const placement = timeline.getPlacement(placementId);
	if (!placement) {
		throw new Error(`Placement ${placementId} not found`);
	}

	const originalTimeslotId = placement.timeslotId;
	const originalAttachedToCardId = placement.attachedToCardId;

	return {
		id: crypto.randomUUID(),
		type: 'move-mutation',
		description: `Move mutation`,
		execute: () => {
			timeline.updatePlacement(placementId, {
				timeslotId: newTimeslotId,
				attachedToCardId: newAttachedToCardId,
			});
		},
		undo: () => {
			timeline.updatePlacement(placementId, {
				timeslotId: originalTimeslotId,
				attachedToCardId: originalAttachedToCardId,
			});
		},
	};
}

/**
 * Duplicate a mutation at a new timeslot
 */
export function createDuplicateMutationCommand(
	sourcePlacementId: string,
	newTimeslotId: string,
	newAttachedToCardId?: string
): TimelineCommand {
	const source = timeline.getPlacement(sourcePlacementId);
	if (!source) {
		throw new Error(`Placement ${sourcePlacementId} not found`);
	}

	const sourceObj = objects.get(source.objectId);

	// Create new placement with same mutation data
	const newPlacement: TimelinePlacement = {
		id: crypto.randomUUID(),
		objectId: source.objectId,
		type: 'mutation',
		timeslotId: newTimeslotId,
		attachedToCardId: newAttachedToCardId,
		mutation: source.mutation ? { ...source.mutation } : undefined,
		threadIds: source.threadIds ? [...source.threadIds] : undefined,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	return {
		id: crypto.randomUUID(),
		type: 'duplicate-mutation',
		description: `Duplicate mutation for "${sourceObj?.name ?? 'unknown'}"`,
		execute: () => {
			timeline.addPlacement(newPlacement);
		},
		undo: () => {
			timeline.removePlacement(newPlacement.id);
		},
	};
}

/**
 * Swap timeslots between two cards
 */
export function createSwapCardsCommand(
	objectId1: string,
	objectId2: string
): TimelineCommand {
	const obj1 = objects.get(objectId1);
	const obj2 = objects.get(objectId2);
	if (!obj1 || !obj2) {
		throw new Error(`Objects not found for swap`);
	}

	const originalTimeslotId1 = obj1.timeslotId;
	const originalTimeslotId2 = obj2.timeslotId;

	return {
		id: crypto.randomUUID(),
		type: 'swap-cards',
		description: `Swap "${obj1.name}" with "${obj2.name}"`,
		execute: () => {
			objects.update(objectId1, { timeslotId: originalTimeslotId2 });
			objects.update(objectId2, { timeslotId: originalTimeslotId1 });
		},
		undo: () => {
			objects.update(objectId1, { timeslotId: originalTimeslotId1 });
			objects.update(objectId2, { timeslotId: originalTimeslotId2 });
		},
	};
}

/**
 * Stack a card in the same timeslot as another card
 */
export function createStackCardsCommand(
	draggedObjectId: string,
	targetObjectId: string
): TimelineCommand {
	const draggedObj = objects.get(draggedObjectId);
	const targetObj = objects.get(targetObjectId);
	if (!draggedObj || !targetObj) {
		throw new Error(`Objects not found for stacking`);
	}

	const originalTimeslotId = draggedObj.timeslotId;
	const targetTimeslotId = targetObj.timeslotId;

	return {
		id: crypto.randomUUID(),
		type: 'stack-cards',
		description: `Stack "${draggedObj.name}" with "${targetObj.name}"`,
		execute: () => {
			// Move dragged card to same timeslot as target
			if (targetTimeslotId) {
				objects.update(draggedObjectId, { timeslotId: targetTimeslotId });
			}
		},
		undo: () => {
			objects.update(draggedObjectId, { timeslotId: originalTimeslotId });
		},
	};
}
