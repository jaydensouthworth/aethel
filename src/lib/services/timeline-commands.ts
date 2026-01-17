/**
 * Timeline Commands
 * Command classes for undo/redo support.
 * Each command encapsulates an operation that can be executed and undone.
 */

import type { AethelObject, TimelinePlacement, Thread, Milestone, MutationDisplay } from '$lib/types';
import { objects } from '$lib/stores/objects.svelte';
import { timeline } from '$lib/stores/timeline.svelte';
import { threads } from '$lib/stores/threads.svelte';
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

/**
 * Move a placement to a new position and/or track
 */
export function createMovePlacementCommand(
	placementId: string,
	newPosition: number,
	newTrack?: number
): TimelineCommand {
	const placement = timeline.getPlacement(placementId);
	if (!placement) {
		throw new Error(`Placement ${placementId} not found`);
	}

	const originalPosition = placement.position;
	const originalTrack = placement.track;
	const originalEndPosition = placement.endPosition;

	// Calculate delta for range placements
	const delta = newPosition - originalPosition;

	return {
		id: crypto.randomUUID(),
		type: 'move-placement',
		description: `Move placement`,
		execute: () => {
			const updates: Partial<TimelinePlacement> = {
				position: newPosition,
			};
			if (newTrack !== undefined) {
				updates.track = newTrack;
			}
			if (originalEndPosition !== undefined) {
				updates.endPosition = originalEndPosition + delta;
			}
			timeline.updatePlacement(placementId, updates);
		},
		undo: () => {
			timeline.updatePlacement(placementId, {
				position: originalPosition,
				track: originalTrack,
				endPosition: originalEndPosition,
			});
		},
	};
}

/**
 * Resize a placement (change start or end position)
 */
export function createResizePlacementCommand(
	placementId: string,
	edge: 'start' | 'end',
	newValue: number
): TimelineCommand {
	const placement = timeline.getPlacement(placementId);
	if (!placement) {
		throw new Error(`Placement ${placementId} not found`);
	}

	const originalPosition = placement.position;
	const originalEndPosition = placement.endPosition;

	return {
		id: crypto.randomUUID(),
		type: 'resize-placement',
		description: `Resize placement`,
		execute: () => {
			if (edge === 'start') {
				timeline.updatePlacement(placementId, { position: newValue });
			} else {
				timeline.updatePlacement(placementId, { endPosition: newValue });
			}
		},
		undo: () => {
			timeline.updatePlacement(placementId, {
				position: originalPosition,
				endPosition: originalEndPosition,
			});
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
// Compound Commands
// ============================================================================

/**
 * Create an object AND its placement in one operation
 */
export function createObjectWithPlacementCommand(
	object: AethelObject,
	placement: TimelinePlacement
): TimelineCommand {
	return {
		id: crypto.randomUUID(),
		type: 'create-object-with-placement',
		description: `Create "${object.name}" on timeline`,
		execute: () => {
			objects.add(object);
			timeline.addPlacement(placement);
		},
		undo: () => {
			timeline.removePlacement(placement.id);
			objects.delete(object.id);
		},
	};
}

/**
 * Duplicate a placement (not the object, just create another placement for same object)
 */
export function createDuplicatePlacementCommand(
	placementId: string,
	offset: number = 1
): TimelineCommand {
	const original = timeline.getPlacement(placementId);
	if (!original) {
		throw new Error(`Placement ${placementId} not found`);
	}

	const newPlacement: TimelinePlacement = {
		...original,
		id: crypto.randomUUID(),
		position: original.position + offset,
		endPosition: original.endPosition
			? original.endPosition + offset
			: undefined,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	return {
		id: crypto.randomUUID(),
		type: 'duplicate-placement',
		description: `Duplicate placement`,
		execute: () => {
			timeline.addPlacement(newPlacement);
		},
		undo: () => {
			timeline.removePlacement(newPlacement.id);
		},
	};
}

/**
 * Move multiple placements at once (for multi-select)
 */
export function createMoveMultiplePlacementsCommand(
	placementIds: string[],
	deltaPosition: number,
	deltaTrack: number = 0
): TimelineCommand {
	// Store original positions for all placements
	const originalStates = placementIds.map((id) => {
		const p = timeline.getPlacement(id);
		if (!p) throw new Error(`Placement ${id} not found`);
		return {
			id,
			position: p.position,
			endPosition: p.endPosition,
			track: p.track,
		};
	});

	return {
		id: crypto.randomUUID(),
		type: 'move-multiple-placements',
		description: `Move ${placementIds.length} placements`,
		execute: () => {
			for (const original of originalStates) {
				timeline.updatePlacement(original.id, {
					position: original.position + deltaPosition,
					endPosition: original.endPosition
						? original.endPosition + deltaPosition
						: undefined,
					track: Math.max(0, original.track + deltaTrack),
				});
			}
		},
		undo: () => {
			for (const original of originalStates) {
				timeline.updatePlacement(original.id, {
					position: original.position,
					endPosition: original.endPosition,
					track: original.track,
				});
			}
		},
	};
}

/**
 * Delete multiple placements at once
 */
export function createDeleteMultiplePlacementsCommand(
	placementIds: string[]
): TimelineCommand {
	// Store copies for undo
	const placementsCopy = placementIds
		.map((id) => timeline.getPlacement(id))
		.filter((p): p is TimelinePlacement => p !== undefined)
		.map((p) => ({ ...p }));

	return {
		id: crypto.randomUUID(),
		type: 'delete-multiple-placements',
		description: `Delete ${placementIds.length} placements`,
		execute: () => {
			for (const id of placementIds) {
				timeline.removePlacement(id);
			}
		},
		undo: () => {
			for (const p of placementsCopy) {
				timeline.addPlacement(p);
			}
		},
	};
}

// ============================================================================
// Track Commands
// ============================================================================

/**
 * Move all placements from one track to another
 */
export function createMoveTrackCommand(
	fromTrack: number,
	toTrack: number
): TimelineCommand {
	const affectedPlacements = timeline.allPlacements
		.filter((p) => p.track === fromTrack)
		.map((p) => p.id);

	return {
		id: crypto.randomUUID(),
		type: 'move-track',
		description: `Move track ${fromTrack} to ${toTrack}`,
		execute: () => {
			for (const id of affectedPlacements) {
				timeline.updatePlacement(id, { track: toTrack });
			}
		},
		undo: () => {
			for (const id of affectedPlacements) {
				timeline.updatePlacement(id, { track: fromTrack });
			}
		},
	};
}

// ============================================================================
// Marker Commands
// ============================================================================

/**
 * Add a marker to the timeline
 */
export function createAddMarkerCommand(marker: {
	id: string;
	name: string;
	position: number;
	description?: string;
}): TimelineCommand {
	return {
		id: crypto.randomUUID(),
		type: 'add-marker',
		description: `Add marker "${marker.name}"`,
		execute: () => {
			timeline.addMarker(marker);
		},
		undo: () => {
			timeline.removeMarker(marker.id);
		},
	};
}

/**
 * Remove a marker from the timeline
 */
export function createRemoveMarkerCommand(markerId: string): TimelineCommand {
	const marker = timeline.getMarker(markerId);
	if (!marker) {
		throw new Error(`Marker ${markerId} not found`);
	}

	const markerCopy = { ...marker };

	return {
		id: crypto.randomUUID(),
		type: 'remove-marker',
		description: `Remove marker "${marker.name}"`,
		execute: () => {
			timeline.removeMarker(markerId);
		},
		undo: () => {
			timeline.addMarker(markerCopy);
		},
	};
}

// ============================================================================
// v2: Thread Commands
// ============================================================================

/**
 * Add a thread
 */
export function createAddThreadCommand(thread: Thread): TimelineCommand {
	return {
		id: crypto.randomUUID(),
		type: 'add-thread',
		description: `Add thread "${thread.name}"`,
		execute: () => {
			threads.add(thread);
		},
		undo: () => {
			threads.delete(thread.id);
		},
	};
}

/**
 * Update a thread
 */
export function createUpdateThreadCommand(
	threadId: string,
	updates: Partial<Omit<Thread, 'id' | 'createdAt'>>
): TimelineCommand {
	const thread = threads.get(threadId);
	if (!thread) {
		throw new Error(`Thread ${threadId} not found`);
	}

	const originalValues: Record<string, unknown> = {};
	for (const key of Object.keys(updates)) {
		originalValues[key] = thread[key as keyof Thread];
	}

	return {
		id: crypto.randomUUID(),
		type: 'update-thread',
		description: `Update thread "${thread.name}"`,
		execute: () => {
			threads.update(threadId, updates);
		},
		undo: () => {
			threads.update(threadId, originalValues as Partial<Omit<Thread, 'id' | 'createdAt'>>);
		},
	};
}

/**
 * Delete a thread
 */
export function createDeleteThreadCommand(threadId: string): TimelineCommand {
	const thread = threads.get(threadId);
	if (!thread) {
		throw new Error(`Thread ${threadId} not found`);
	}

	const threadCopy = { ...thread };
	// Also store which placements were in this thread
	const placementsInThread = timeline.getPlacementsInThread(threadId).map(p => p.id);

	return {
		id: crypto.randomUUID(),
		type: 'delete-thread',
		description: `Delete thread "${thread.name}"`,
		execute: () => {
			// Remove thread from all placements
			for (const placementId of placementsInThread) {
				timeline.removePlacementFromThread(placementId, threadId);
			}
			threads.delete(threadId);
		},
		undo: () => {
			threads.add(threadCopy);
			// Restore thread to placements
			for (const placementId of placementsInThread) {
				timeline.addPlacementToThread(placementId, threadId);
			}
		},
	};
}

/**
 * Add a placement to a thread
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
// v2: Card Reorder Commands
// ============================================================================

/**
 * Reorder a card (change object's position in rendered order)
 * This changes the object's sortOrder to move it to a new position
 */
export function createReorderCardCommand(
	objectId: string,
	newIndex: number
): TimelineCommand {
	const obj = objects.get(objectId);
	if (!obj) {
		throw new Error(`Object ${objectId} not found`);
	}

	const originalSortOrder = obj.sortOrder;
	const currentIndex = timeline.getCardIndex(objectId);

	return {
		id: crypto.randomUUID(),
		type: 'reorder-card',
		description: `Reorder "${obj.name}"`,
		execute: () => {
			objects.reorder(objectId, newIndex);
		},
		undo: () => {
			// Restore original sort order
			objects.update(objectId, { sortOrder: originalSortOrder });
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
