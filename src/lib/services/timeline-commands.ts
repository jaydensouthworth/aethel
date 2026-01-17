/**
 * Timeline Commands
 * Command classes for undo/redo support.
 * Each command encapsulates an operation that can be executed and undone.
 */

import type { AethelObject, TimelinePlacement, Milestone, MutationDisplay } from '$lib/types';
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
// v2: Milestone Commands
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
 * Move a milestone to a new position
 */
export function createMoveMilestoneCommand(
	milestoneId: string,
	newAfterIndex: number
): TimelineCommand {
	const milestone = milestones.get(milestoneId);
	if (!milestone) {
		throw new Error(`Milestone ${milestoneId} not found`);
	}

	const originalAfterIndex = milestone.afterIndex;

	return {
		id: crypto.randomUUID(),
		type: 'move-milestone',
		description: `Move milestone "${milestone.name}"`,
		execute: () => {
			milestones.move(milestoneId, newAfterIndex);
		},
		undo: () => {
			milestones.move(milestoneId, originalAfterIndex);
		},
	};
}

// ============================================================================
// v2: Mutation Display Commands
// ============================================================================

/**
 * Change a mutation's display mode (between vs below)
 */
export function createChangeMutationDisplayCommand(
	placementId: string,
	display: MutationDisplay,
	options?: {
		attachedToObjectId?: string;
		afterRenderedIndex?: number;
	}
): TimelineCommand {
	const placement = timeline.getPlacement(placementId);
	if (!placement) {
		throw new Error(`Placement ${placementId} not found`);
	}

	const originalDisplay = placement.mutationDisplay;
	const originalAttachedTo = placement.attachedToObjectId;
	const originalAfterIndex = placement.afterRenderedIndex;

	return {
		id: crypto.randomUUID(),
		type: 'change-mutation-display',
		description: `Change mutation display to ${display}`,
		execute: () => {
			timeline.setMutationDisplay(placementId, display, options);
		},
		undo: () => {
			timeline.setMutationDisplay(placementId, originalDisplay ?? 'between', {
				attachedToObjectId: originalAttachedTo,
				afterRenderedIndex: originalAfterIndex,
			});
		},
	};
}

// ============================================================================
// v2: Card Commands
// ============================================================================

/**
 * Toggle an object's rendered status (adds/removes from timeline cards)
 */
export function createToggleRenderedCommand(objectId: string): TimelineCommand {
	const obj = objects.get(objectId);
	if (!obj) {
		throw new Error(`Object ${objectId} not found`);
	}

	const originalRendered = obj.rendered;

	return {
		id: crypto.randomUUID(),
		type: 'toggle-rendered',
		description: originalRendered ? `Remove "${obj.name}" from timeline` : `Add "${obj.name}" to timeline`,
		execute: () => {
			objects.update(objectId, { rendered: !originalRendered });
		},
		undo: () => {
			objects.update(objectId, { rendered: originalRendered });
		},
	};
}
