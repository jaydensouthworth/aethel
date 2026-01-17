import { createObject, createPlacement, createThread as createThreadType, createMilestone as createMilestoneType } from '$lib/types';
import type { AethelObject, TimelinePlacement, Thread, Milestone, MutationDisplay } from '$lib/types';
import { objects } from '$lib/stores/objects.svelte';
import { timeline } from '$lib/stores/timeline.svelte';
import { threads } from '$lib/stores/threads.svelte';
import { milestones } from '$lib/stores/milestones.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { timelineEditor } from '$lib/stores/timeline-editor.svelte';
import { timelineHistory } from '$lib/stores/timeline-history.svelte';
import {
	createAddPlacementCommand,
	createRemovePlacementCommand,
	createUpdatePlacementCommand,
	createMovePlacementCommand,
	createResizePlacementCommand,
	createAddObjectCommand,
	createDeleteObjectCommand,
	createUpdateObjectCommand,
	createObjectWithPlacementCommand,
	createDuplicatePlacementCommand,
	createMoveMultiplePlacementsCommand,
	createDeleteMultiplePlacementsCommand,
	createAddMarkerCommand,
	createRemoveMarkerCommand,
	// v2 commands
	createAddThreadCommand,
	createUpdateThreadCommand,
	createDeleteThreadCommand,
	createAddToThreadCommand,
	createRemoveFromThreadCommand,
	createAddMilestoneCommand,
	createUpdateMilestoneCommand,
	createDeleteMilestoneCommand,
	createMoveMilestoneCommand,
	createChangeMutationDisplayCommand,
	createReorderCardCommand,
	createToggleRenderedCommand,
} from './timeline-commands';

// ============================================================================
// Object + Placement Operations
// ============================================================================

/**
 * Create a new object and place it on the timeline
 */
export function createObjectWithPlacement(
	name: string,
	typeId: string,
	position: number,
	track: number = 0,
	options?: {
		parentId?: string | null;
		endPosition?: number;
		rendered?: boolean;
	}
): { object: AethelObject; placement: TimelinePlacement } {
	const object = createObject(name, typeId, options?.parentId ?? null);
	if (options?.rendered !== undefined) {
		object.rendered = options.rendered;
	}

	const placement = createPlacement(object.id, 'creation', position, track, {
		endPosition: options?.endPosition,
	});

	const command = createObjectWithPlacementCommand(object, placement);
	timelineHistory.execute(command);

	// Select the new object
	ui.select(object.id);
	timelineEditor.select(placement.id);

	return { object, placement };
}

/**
 * Add an existing object to the timeline (create a placement for it)
 */
export function addObjectToTimeline(
	objectId: string,
	position: number,
	track: number = 0,
	options?: {
		endPosition?: number;
		type?: 'creation' | 'mutation';
		mutation?: {
			label: string;
			changes: Record<string, { from: unknown; to: unknown }>;
		};
	}
): TimelinePlacement {
	const object = objects.get(objectId);
	if (!object) {
		throw new Error(`Object ${objectId} not found`);
	}

	const placement = createPlacement(
		objectId,
		options?.type ?? 'creation',
		position,
		track,
		{
			endPosition: options?.endPosition,
			mutation: options?.mutation,
		}
	);

	const command = createAddPlacementCommand(placement);
	timelineHistory.execute(command);

	// Select the placement
	timelineEditor.select(placement.id);

	return placement;
}

/**
 * Add a mutation for an object at a specific position
 */
export function addMutation(
	objectId: string,
	position: number,
	label: string,
	changes: Record<string, { from: unknown; to: unknown }> = {},
	track?: number
): TimelinePlacement {
	// Find the object's track if not specified
	const existingPlacement = timeline.allPlacements.find(
		(p) => p.objectId === objectId && p.type === 'creation'
	);
	const targetTrack = track ?? existingPlacement?.track ?? 0;

	return addObjectToTimeline(objectId, position, targetTrack, {
		type: 'mutation',
		mutation: { label, changes },
	});
}

// ============================================================================
// Placement Operations
// ============================================================================

/**
 * Move a placement to a new position/track
 */
export function movePlacement(
	placementId: string,
	newPosition: number,
	newTrack?: number
): void {
	// Check if placement is locked
	if (timelineEditor.isPlacementLocked(placementId)) {
		console.warn('Cannot move locked placement');
		return;
	}

	// Apply snapping
	const snappedPosition = timelineEditor.snapPosition(newPosition);

	const command = createMovePlacementCommand(
		placementId,
		snappedPosition,
		newTrack
	);
	timelineHistory.execute(command);
}

/**
 * Move multiple selected placements
 */
export function moveSelectedPlacements(
	deltaPosition: number,
	deltaTrack: number = 0
): void {
	const selectedIds = Array.from(timelineEditor.selectedPlacementIds);

	// Filter out locked placements
	const movableIds = selectedIds.filter(
		(id) => !timelineEditor.isPlacementLocked(id)
	);

	if (movableIds.length === 0) {
		console.warn('All selected placements are locked');
		return;
	}

	const command = createMoveMultiplePlacementsCommand(
		movableIds,
		deltaPosition,
		deltaTrack
	);
	timelineHistory.execute(command);
}

/**
 * Nudge selected placements by a small amount
 */
export function nudgeSelectedPlacements(direction: 'left' | 'right'): void {
	const delta = direction === 'left' ? -0.5 : 0.5;
	moveSelectedPlacements(delta, 0);
}

/**
 * Move selected placements to a different track
 */
export function moveSelectedToTrack(track: number): void {
	const selectedIds = Array.from(timelineEditor.selectedPlacementIds);

	// Filter out locked placements
	const movableIds = selectedIds.filter(
		(id) => !timelineEditor.isPlacementLocked(id)
	);

	if (movableIds.length === 0) return;

	// Get current track of first placement to calculate delta
	const firstPlacement = timeline.getPlacement(movableIds[0]);
	if (!firstPlacement) return;

	const deltaTrack = track - firstPlacement.track;
	moveSelectedPlacements(0, deltaTrack);
}

/**
 * Resize a placement (adjust start or end position)
 */
export function resizePlacement(
	placementId: string,
	edge: 'start' | 'end',
	newValue: number
): void {
	if (timelineEditor.isPlacementLocked(placementId)) {
		console.warn('Cannot resize locked placement');
		return;
	}

	// Apply snapping
	const snappedValue = timelineEditor.snapPosition(newValue);

	const command = createResizePlacementCommand(placementId, edge, snappedValue);
	timelineHistory.execute(command);
}

/**
 * Duplicate selected placements
 */
export function duplicateSelectedPlacements(offset: number = 1): void {
	const selectedIds = Array.from(timelineEditor.selectedPlacementIds);

	if (selectedIds.length === 0) return;

	const batch = timelineHistory.beginBatch(
		`Duplicate ${selectedIds.length} placements`
	);

	const newIds: string[] = [];
	for (const id of selectedIds) {
		const placement = timeline.getPlacement(id);
		if (!placement) continue;

		const newPlacement: TimelinePlacement = {
			...placement,
			id: crypto.randomUUID(),
			position: placement.position + offset,
			endPosition: placement.endPosition
				? placement.endPosition + offset
				: undefined,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		batch.add(createAddPlacementCommand(newPlacement));
		newIds.push(newPlacement.id);
	}

	batch.commit();

	// Select the new placements
	timelineEditor.clearSelection();
	for (const id of newIds) {
		timelineEditor.select(id, true);
	}
}

/**
 * Delete a single placement (not the object)
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
 * Delete all selected placements
 */
export function deleteSelectedPlacements(): void {
	const selectedIds = Array.from(timelineEditor.selectedPlacementIds);

	// Filter out locked placements
	const deletableIds = selectedIds.filter(
		(id) => !timelineEditor.isPlacementLocked(id)
	);

	if (deletableIds.length === 0) {
		console.warn('All selected placements are locked');
		return;
	}

	const command = createDeleteMultiplePlacementsCommand(deletableIds);
	timelineHistory.execute(command);

	// Clear selection
	timelineEditor.clearSelection();
}

// ============================================================================
// Object Operations
// ============================================================================

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

	// Clear any placement selections for this object
	const selectedIds = Array.from(timelineEditor.selectedPlacementIds);
	const toDeselect = selectedIds.filter((id) => {
		const p = timeline.getPlacement(id);
		return p?.objectId === objectId;
	});
	if (toDeselect.length > 0) {
		timelineEditor.clearSelection();
	}
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
// Marker Operations
// ============================================================================

/**
 * Add a marker at a position
 */
export function addMarker(
	name: string,
	position: number,
	description?: string
): void {
	const marker = {
		id: crypto.randomUUID(),
		name,
		position,
		description,
	};

	const command = createAddMarkerCommand(marker);
	timelineHistory.execute(command);
}

/**
 * Remove a marker
 */
export function removeMarker(markerId: string): void {
	const command = createRemoveMarkerCommand(markerId);
	timelineHistory.execute(command);
}

// ============================================================================
// Navigation Operations
// ============================================================================

/**
 * Scroll timeline to show a specific object's placements
 */
export function showObjectInTimeline(objectId: string): void {
	const placements = timeline.getPlacementsForObject(objectId);
	if (placements.length === 0) return;

	// Find the first placement
	const firstPlacement = placements.sort((a, b) => a.position - b.position)[0];

	// Highlight all placements
	timelineEditor.highlightPlacements(objectId);

	// Scroll to show the first placement
	const bounds = timeline.bounds;
	const { min } = bounds;
	const totalRange = bounds.max - min || 10;
	const visibleWidth = totalRange / timelineEditor.zoom;

	// Center the placement in view
	const targetOffset = firstPlacement.position - min - visibleWidth / 2;
	timelineEditor.setScrollOffset(Math.max(0, targetOffset));
}

/**
 * Jump cursor to a placement
 */
export function jumpToPlacement(placementId: string): void {
	const placement = timeline.getPlacement(placementId);
	if (!placement) return;

	timeline.setCursorPosition(placement.position);
}

// ============================================================================
// Magnetic Mode Operations
// ============================================================================

/**
 * Move placement in magnetic mode (push/pull adjacent placements)
 */
export function movePlacementMagnetic(
	placementId: string,
	newPosition: number,
	newTrack?: number
): void {
	const placement = timeline.getPlacement(placementId);
	if (!placement) return;

	if (timelineEditor.isPlacementLocked(placementId)) {
		console.warn('Cannot move locked placement');
		return;
	}

	const track = newTrack ?? placement.track;
	const delta = newPosition - placement.position;

	if (delta === 0 && track === placement.track) return;

	// Get all placements on the target track
	const trackPlacements = (timeline.byTrack.get(track) ?? []).filter(
		(p) => p.id !== placementId && !timelineEditor.isPlacementLocked(p.id)
	);

	// Find placements that need to be pushed
	const placementsToMove: { id: string; delta: number }[] = [];

	if (delta > 0) {
		// Moving right - push placements after new position
		for (const p of trackPlacements) {
			if (p.position >= newPosition) {
				placementsToMove.push({ id: p.id, delta });
			}
		}
	} else {
		// Moving left - push placements before
		for (const p of trackPlacements) {
			const pEnd = p.endPosition ?? p.position;
			if (pEnd <= placement.position && p.position >= newPosition) {
				placementsToMove.push({ id: p.id, delta });
			}
		}
	}

	// Build batch command
	const batch = timelineHistory.beginBatch('Magnetic move');

	// Move the main placement
	batch.add(createMovePlacementCommand(placementId, newPosition, track));

	// Move affected placements
	for (const { id, delta: d } of placementsToMove) {
		const p = timeline.getPlacement(id);
		if (p) {
			batch.add(createMovePlacementCommand(id, p.position + d));
		}
	}

	batch.commit();
}

// ============================================================================
// Split/Merge Operations
// ============================================================================

/**
 * Split a placement at a specific position
 * For content-based splitting (like chapters), this creates two placements
 */
export function splitPlacement(
	placementId: string,
	splitPosition: number
): { before: TimelinePlacement; after: TimelinePlacement } | null {
	const placement = timeline.getPlacement(placementId);
	if (!placement) return null;

	if (timelineEditor.isPlacementLocked(placementId)) {
		console.warn('Cannot split locked placement');
		return null;
	}

	// Only makes sense for range placements
	if (placement.endPosition === undefined) {
		console.warn('Cannot split point placement');
		return null;
	}

	// Validate split position is within range
	if (splitPosition <= placement.position || splitPosition >= placement.endPosition) {
		console.warn('Split position must be within placement range');
		return null;
	}

	// Create new placement for the second part
	const afterPlacement = createPlacement(
		placement.objectId,
		placement.type,
		splitPosition,
		placement.track,
		{
			endPosition: placement.endPosition,
			mutation: placement.mutation,
		}
	);

	const batch = timelineHistory.beginBatch('Split placement');

	// Update original to end at split point
	batch.add(
		createUpdatePlacementCommand(placementId, { endPosition: splitPosition })
	);

	// Add new placement
	batch.add(createAddPlacementCommand(afterPlacement));

	batch.commit();

	// Select both parts
	timelineEditor.clearSelection();
	timelineEditor.select(placementId, true);
	timelineEditor.select(afterPlacement.id, true);

	return {
		before: { ...placement, endPosition: splitPosition },
		after: afterPlacement,
	};
}

/**
 * Merge two adjacent placements (must be same object)
 */
export function mergePlacements(
	placementId1: string,
	placementId2: string
): TimelinePlacement | null {
	const p1 = timeline.getPlacement(placementId1);
	const p2 = timeline.getPlacement(placementId2);

	if (!p1 || !p2) return null;

	// Must be same object
	if (p1.objectId !== p2.objectId) {
		console.warn('Cannot merge placements from different objects');
		return null;
	}

	// Check locks
	if (
		timelineEditor.isPlacementLocked(placementId1) ||
		timelineEditor.isPlacementLocked(placementId2)
	) {
		console.warn('Cannot merge locked placements');
		return null;
	}

	// Determine which is earlier
	const [earlier, later] =
		p1.position < p2.position ? [p1, p2] : [p2, p1];

	// Calculate merged range
	const start = earlier.position;
	const end = Math.max(
		earlier.endPosition ?? earlier.position,
		later.endPosition ?? later.position
	);

	const batch = timelineHistory.beginBatch('Merge placements');

	// Update earlier placement to span full range
	batch.add(createUpdatePlacementCommand(earlier.id, { endPosition: end }));

	// Remove later placement
	batch.add(createRemovePlacementCommand(later.id));

	batch.commit();

	return { ...earlier, endPosition: end };
}

// ============================================================================
// Copy/Paste Operations
// ============================================================================

/**
 * Paste copied placements at cursor position
 */
export function pasteAtCursor(): void {
	const clipboard = timelineEditor.getClipboard();
	if (clipboard.length === 0) return;

	// Get cursor position
	const cursorPos = timeline.cursorPosition;

	// Find the earliest position in clipboard
	let minPosition = Infinity;
	for (const id of clipboard) {
		const p = timeline.getPlacement(id);
		if (p && p.position < minPosition) {
			minPosition = p.position;
		}
	}

	// Calculate offset to move placements to cursor
	const offset = cursorPos - minPosition;

	// Create new placements
	const batch = timelineHistory.beginBatch(`Paste ${clipboard.length} placements`);
	const newIds: string[] = [];

	for (const id of clipboard) {
		const original = timeline.getPlacement(id);
		if (!original) continue;

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

		batch.add(createAddPlacementCommand(newPlacement));
		newIds.push(newPlacement.id);
	}

	batch.commit();

	// Select pasted placements
	timelineEditor.clearSelection();
	for (const id of newIds) {
		timelineEditor.select(id, true);
	}
}

// ============================================================================
// v2: Thread Operations
// ============================================================================

/**
 * Create a new thread
 */
export function createThread(
	name: string,
	color: string,
	options?: {
		description?: string;
		icon?: string;
		showOnTimeline?: boolean;
		showConnectingLines?: boolean;
	}
): Thread {
	const thread = createThreadType(name, color, options);
	const command = createAddThreadCommand(thread);
	timelineHistory.execute(command);

	// Show the thread on timeline
	timelineEditor.showThread(thread.id);

	return thread;
}

/**
 * Update a thread
 */
export function updateThread(
	threadId: string,
	updates: Partial<Omit<Thread, 'id' | 'createdAt'>>
): void {
	const command = createUpdateThreadCommand(threadId, updates);
	timelineHistory.execute(command);
}

/**
 * Delete a thread
 */
export function deleteThread(threadId: string): void {
	const command = createDeleteThreadCommand(threadId);
	timelineHistory.execute(command);

	// Hide from timeline
	timelineEditor.hideThread(threadId);
}

/**
 * Add a placement to a thread
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
 * Reorder a card to a new position in the timeline
 */
export function reorderCard(objectId: string, newIndex: number): void {
	const command = createReorderCardCommand(objectId, newIndex);
	timelineHistory.execute(command);
}

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
