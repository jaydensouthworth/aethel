<script lang="ts">
  import { timeline, timelineEditor, milestones, objects, ui } from '$lib/stores';
  import { getObjectType } from '$lib/types';
  import type { TimelinePlacement, Milestone, AethelObject } from '$lib/types';
  import type { TimelineCard, TimeslotContents } from '$lib/stores/timeline.svelte';
  import { deleteMilestone, deletePlacement, toggleCardRendered, reorderCard, moveMutation, duplicateMutation, moveMilestone, swapCards, stackCards } from '$lib/services/timeline-operations';
  import { MilestoneDialog, AddMutationDialog, AddExistingObjectDialog, CreateNewObjectDialog, MutationDropDialog, CardDropDialog } from './dialogs';
  import TimelineHeader from './TimelineHeader.svelte';

  interface Props {
    collapsed?: boolean;
  }

  let { collapsed = false }: Props = $props();

  // Timeline data (v3 - timeslot-based)
  const cards = $derived(timeline.cards);
  const orderedTimeslots = $derived(timeline.orderedTimeslots);
  const milestonesAtStart = $derived(timeline.milestonesAtStart);
  const allMilestones = $derived(milestones.all);
  const cursorIndex = $derived(timeline.cursorIndex);
  const cardCount = $derived(timeline.cardCount);

  // Dialog state - now uses timeslot index
  let milestoneDialogOpen = $state(false);
  let milestoneDialogTimeslotIndex = $state(0);
  let milestoneDialogEditId = $state<string | null>(null);

  let mutationDialogOpen = $state(false);
  let mutationDialogTimeslotIndex = $state(0);

  let addExistingObjectDialogOpen = $state(false);
  let addExistingObjectTimeslotIndex = $state(0);

  let createNewObjectDialogOpen = $state(false);
  let createNewObjectTimeslotIndex = $state(0);

  // Drag-drop state
  let dragType = $state<'card' | 'mutation' | 'milestone' | null>(null);
  let draggedId = $state<string | null>(null);
  let dropTargetConnectorKey = $state<string | null>(null);
  let dropTargetObjectId = $state<string | null>(null);

  // Mutation drop dialog state - now uses timeslotId
  let mutationDropDialogOpen = $state(false);
  let droppedMutationId = $state<string | null>(null);
  let mutationDropTarget = $state<{ type: 'between' | 'below'; timeslotId?: string | null; attachedToCardId?: string } | null>(null);

  // Card drop dialog state
  let cardDropDialogOpen = $state(false);
  let droppedCardId = $state<string | null>(null);
  let cardDropTargetId = $state<string | null>(null);

  // ============================================================================
  // v3: Timeslot-based Flow Items
  // Each timeslot contains cards and mutations. Connectors between timeslots
  // serve as drop zones. Order comes from timeline.orderedTimeslots.
  // ============================================================================

  type FlowItem =
    | { type: 'connector'; key: string; dropIndex: number }
    | { type: 'timeslot'; key: string; timeslot: TimeslotContents }
    | { type: 'milestone'; key: string; milestone: Milestone };

  const flowItems = $derived.by(() => {
    const items: FlowItem[] = [];

    // Milestones at the very start (before first timeslot)
    for (const m of milestonesAtStart) {
      items.push({
        type: 'milestone',
        key: `ms-${m.id}`,
        milestone: m,
      });
    }

    // Connector before first timeslot (drop index 0)
    items.push({
      type: 'connector',
      key: 'conn-start',
      dropIndex: 0,
    });

    // Iterate over timeslots
    for (let i = 0; i < orderedTimeslots.length; i++) {
      const ts = orderedTimeslots[i];

      // Milestones that appear before this timeslot
      for (const m of ts.milestonesBefore) {
        items.push({
          type: 'milestone',
          key: `ms-${m.id}`,
          milestone: m,
        });
      }

      // The timeslot itself (contains cards and mutations)
      if (ts.cards.length > 0 || ts.mutations.length > 0) {
        items.push({
          type: 'timeslot',
          key: `ts-${ts.timeslotId}`,
          timeslot: ts,
        });
      }

      // Connector after this timeslot (drop index i+1)
      items.push({
        type: 'connector',
        key: `conn-${ts.timeslotId}`,
        dropIndex: i + 1,
      });
    }

    return items;
  });

  // Helper to get cards in a timeslot as TimelineCard objects
  function getCardsForTimeslot(ts: TimeslotContents): TimelineCard[] {
    return cards.filter(c => c.object.timeslotId === ts.timeslotId);
  }

  // Get mutations in a timeslot that are NOT attached to a specific card (shown "between")
  function getUnattachedMutations(ts: TimeslotContents): TimelinePlacement[] {
    return ts.mutations.filter(m => !m.attachedToCardId);
  }

  // ============================================================================
  // Reset component state when data changes drastically (e.g., New Project)
  // ============================================================================

  // Track previous object count to detect major changes
  let prevObjectCount = $state(0);

  $effect(() => {
    const currentCount = objects.all.length;
    // Detect if stores were cleared and repopulated (or just cleared)
    if (prevObjectCount > 0 && currentCount === 0) {
      // Stores are being cleared - reset local state
      cardGroupEls = new Map();
      expandedConnectorKey = null;
      draggedId = null;
      dragType = null;
      dropTargetConnectorKey = null;
      dropTargetObjectId = null;
      mutationDropDialogOpen = false;
      cardDropDialogOpen = false;
      milestoneDialogOpen = false;
      mutationDialogOpen = false;
      addExistingObjectDialogOpen = false;
      createNewObjectDialogOpen = false;
    }
    prevObjectCount = currentCount;
  });

  // ============================================================================
  // Thread Measurement - Position threads via DOM measurements
  // ============================================================================

  // Element refs for DOM measurement
  let flowContainerEl: HTMLDivElement | undefined = $state();
  let cardGroupEls = $state<Map<string, HTMLDivElement>>(new Map());

  // Thread rows expanded/collapsed state
  let threadRowsExpanded = $state(true);

  // Which slot IDs have threads (for determining if we need thread rows)
  // Also tracks subthread membership: key format "threadId:sectionId" for specific subthreads
  const threadSlotMap = $derived.by(() => {
    // Read allPlacements directly to ensure we always have fresh placement data
    // This is critical for reactivity - reading from cached card.placement may be stale
    const allPlacements = timeline.allPlacements;

    // Helper to get fresh placement data
    const getPlacement = (objectId: string, type: 'creation' | 'mutation' = 'creation') =>
      allPlacements.find(p => p.objectId === objectId && p.type === type);

    // Get mutations attached to a specific card
    const getMutationsBelow = (attachedToCardId: string) =>
      allPlacements.filter(p => p.type === 'mutation' && p.attachedToCardId === attachedToCardId);

    const map = new Map<string, Set<string>>(); // slotId -> Set of threadIds
    const subthreadMap = new Map<string, Set<string>>(); // slotId -> Set of "threadId:sectionId"

    for (const group of orderedTimeslots) {
      const threadIds = new Set<string>();
      const subthreadKeys = new Set<string>();
      // Track which threadIds have subthread targeting defined on the card's creation placement
      // For these, we should NOT also check mutations (card's targeting takes precedence)
      const threadsWithCardTargeting = new Set<string>();

      for (const card of group.cards) {
        // Get FRESH placement data directly from allPlacements
        // Note: group.cards is AethelObject[], so card is the object itself
        const placement = getPlacement(card.id, 'creation');
        const mutationsBelow = getMutationsBelow(card.id);

        // Check the card's own placement (creation/reference) for thread membership
        if (placement?.threadIds) {
          for (const threadId of placement.threadIds) {
            if (timelineEditor.isThreadVisible(threadId)) {
              threadIds.add(threadId);
              // Card has direct thread membership - its subthread targeting takes precedence
              threadsWithCardTargeting.add(threadId);

              // Track subthread membership based on card's targeting
              const threadObj = objects.get(threadId);
              const sections = threadObj ? objects.getSections(threadId) : [];
              const placementSubthreads = placement.subthreadIds ?? [];

              if (sections.length > 0) {
                if (placementSubthreads.length === 0) {
                  // "Full thread" - card belongs to ALL subthreads
                  for (const section of sections) {
                    subthreadKeys.add(`${threadId}:${section.id}`);
                  }
                } else {
                  // Specific subthreads only
                  for (const sectionId of placementSubthreads) {
                    subthreadKeys.add(`${threadId}:${sectionId}`);
                  }
                }
              }
            }
          }
        }

        // Also check mutations below the card for thread membership
        // But for SUBTHREAD targeting, only use mutations if the card doesn't have
        // direct targeting for this thread (card's targeting takes precedence)
        for (const mutation of mutationsBelow) {
          for (const threadId of mutation.threadIds ?? []) {
            if (timelineEditor.isThreadVisible(threadId)) {
              threadIds.add(threadId);

              // Only use mutation's subthread targeting if card doesn't have direct targeting for this thread
              if (!threadsWithCardTargeting.has(threadId)) {
                const threadObj = objects.get(threadId);
                const sections = threadObj ? objects.getSections(threadId) : [];
                const mutationSubthreads = mutation.subthreadIds ?? [];

                if (sections.length > 0) {
                  if (mutationSubthreads.length === 0) {
                    // "Full thread" - belongs to ALL subthreads
                    for (const section of sections) {
                      subthreadKeys.add(`${threadId}:${section.id}`);
                    }
                  } else {
                    // Specific subthreads only
                    for (const sectionId of mutationSubthreads) {
                      subthreadKeys.add(`${threadId}:${sectionId}`);
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (threadIds.size > 0) {
        map.set(group.timeslotId, threadIds);
      }
      if (subthreadKeys.size > 0) {
        subthreadMap.set(group.timeslotId, subthreadKeys);
      }
    }
    return { threads: map, subthreads: subthreadMap };
  });

  // Visible thread info (for rendering thread rows)
  interface SubthreadInfo {
    sectionId: string;
    name: string;
    slotIds: string[]; // Which slot groups this subthread spans
  }

  interface ThreadInfo {
    threadId: string;
    color: string;
    name: string;
    slotIds: string[]; // Which slot groups this thread spans
    hasSubthreads: boolean;
    subthreads: SubthreadInfo[];
  }

  const visibleThreads = $derived.by(() => {
    const threads: ThreadInfo[] = [];
    const { threads: threadMap, subthreads: subthreadMap } = threadSlotMap;

    for (const threadId of timelineEditor.visibleThreadIds) {
      const threadObj = objects.get(threadId);
      if (!threadObj?.isThread) continue;

      const slotIds: string[] = [];
      for (const [slotId, threadIds] of threadMap) {
        if (threadIds.has(threadId)) {
          slotIds.push(slotId);
        }
      }

      // Check if thread object has sections (subthreads)
      const sections = objects.getSections(threadId);
      const hasSubthreads = sections.length > 0;

      // Build subthread info for each section with its own slot coverage
      const subthreads: SubthreadInfo[] = sections.map(section => {
        const subthreadKey = `${threadId}:${section.id}`;
        const subthreadSlotIds: string[] = [];

        // Find slots where this specific subthread has cards
        for (const [slotId, subthreadKeys] of subthreadMap) {
          if (subthreadKeys.has(subthreadKey)) {
            subthreadSlotIds.push(slotId);
          }
        }

        return {
          sectionId: section.id,
          name: section.name,
          slotIds: subthreadSlotIds,
        };
      });

      // Include thread even if no slots - it will show as inactive
      threads.push({
        threadId,
        color: objects.getEffectiveThreadColor(threadId),
        name: threadObj.name,
        slotIds,
        hasSubthreads,
        subthreads,
      });
    }
    return threads;
  });

  // Measured thread positions (updated via $effect)
  interface MeasuredThread {
    threadId: string;
    color: string;
    name: string;
    activeLeftPx: number;  // Where the colored portion starts
    activeWidthPx: number; // Width of the colored portion
    hasActiveSpan: boolean; // Whether there's an active colored portion
  }

  interface MeasuredSubthread {
    threadId: string;
    sectionId: string;
    activeLeftPx: number;
    activeWidthPx: number;
    hasActiveSpan: boolean;
  }

  let measuredThreads = $state<MeasuredThread[]>([]);
  let measuredSubthreads = $state<MeasuredSubthread[]>([]);
  let totalFlowWidth = $state(0);

  // Cursor highlight position (measured from DOM)
  interface CursorHighlight {
    leftPx: number;
    widthPx: number;
    hasPosition: boolean;
  }
  let cursorHighlight = $state<CursorHighlight>({ leftPx: 0, widthPx: 0, hasPosition: false });

  // Track inline mutation elements for highlighting
  let inlineMutationEls = $state<Map<string, HTMLDivElement>>(new Map());

  function measureSpanFromSlotIds(slotIds: string[], containerRect: DOMRect, scrollLeft: number): { left: number; width: number; hasSpan: boolean } {
    if (slotIds.length === 0) {
      return { left: 0, width: 0, hasSpan: false };
    }

    // Get first and last card group elements
    const firstEl = cardGroupEls.get(slotIds[0]);
    const lastEl = cardGroupEls.get(slotIds[slotIds.length - 1]);
    if (!firstEl || !lastEl) {
      return { left: 0, width: 0, hasSpan: false };
    }

    const firstRect = firstEl.getBoundingClientRect();
    const lastRect = lastEl.getBoundingClientRect();

    return {
      left: firstRect.left - containerRect.left + scrollLeft,
      width: lastRect.right - firstRect.left,
      hasSpan: true,
    };
  }

  function measureCursorPosition() {
    if (!flowContainerEl) {
      cursorHighlight = { leftPx: 0, widthPx: 0, hasPosition: false };
      return;
    }

    const containerRect = flowContainerEl.getBoundingClientRect();
    const scrollLeft = flowContainerEl.scrollLeft;
    const overhang = 8;

    // Check if there's an active inline mutation to highlight
    const activeMutId = ui.activeMutationId;
    if (activeMutId) {
      const inlineMutEl = inlineMutationEls.get(activeMutId);
      if (inlineMutEl) {
        const mutRect = inlineMutEl.getBoundingClientRect();
        cursorHighlight = {
          leftPx: mutRect.left - containerRect.left + scrollLeft - overhang,
          widthPx: mutRect.width + overhang * 2,
          hasPosition: true,
        };
        return;
      }
    }

    // Fall back to card-based cursor
    const currentCard = cards[cursorIndex];
    if (!currentCard) {
      cursorHighlight = { leftPx: 0, widthPx: 0, hasPosition: false };
      return;
    }

    // Find which timeslot contains the current card
    // Note: ts.cards is AethelObject[], currentCard is TimelineCard
    const timeslot = orderedTimeslots.find(ts => ts.cards.some(c => c.id === currentCard.object.id));
    if (!timeslot) {
      cursorHighlight = { leftPx: 0, widthPx: 0, hasPosition: false };
      return;
    }

    const cardGroupEl = cardGroupEls.get(timeslot.timeslotId);
    if (!cardGroupEl) {
      cursorHighlight = { leftPx: 0, widthPx: 0, hasPosition: false };
      return;
    }

    const cardRect = cardGroupEl.getBoundingClientRect();
    cursorHighlight = {
      leftPx: cardRect.left - containerRect.left + scrollLeft - overhang,
      widthPx: cardRect.width + overhang * 2,
      hasPosition: true,
    };
  }

  function measureThreadPositions() {
    if (!flowContainerEl) return;

    const threads: MeasuredThread[] = [];
    const subthreads: MeasuredSubthread[] = [];
    const containerRect = flowContainerEl.getBoundingClientRect();
    const scrollLeft = flowContainerEl.scrollLeft;
    totalFlowWidth = flowContainerEl.scrollWidth;

    for (const thread of visibleThreads) {
      // Measure parent thread span
      const threadSpan = measureSpanFromSlotIds(thread.slotIds, containerRect, scrollLeft);
      threads.push({
        threadId: thread.threadId,
        color: thread.color,
        name: thread.name,
        activeLeftPx: threadSpan.left,
        activeWidthPx: threadSpan.width,
        hasActiveSpan: threadSpan.hasSpan,
      });

      // Measure each subthread span independently
      for (const sub of thread.subthreads) {
        const subSpan = measureSpanFromSlotIds(sub.slotIds, containerRect, scrollLeft);
        subthreads.push({
          threadId: thread.threadId,
          sectionId: sub.sectionId,
          activeLeftPx: subSpan.left,
          activeWidthPx: subSpan.width,
          hasActiveSpan: subSpan.hasSpan,
        });
      }
    }

    measuredThreads = threads;
    measuredSubthreads = subthreads;

    // Also measure cursor position
    measureCursorPosition();
  }

  // Recalculate thread positions when layout changes
  $effect(() => {
    // Dependencies: trigger recalc when these change
    // Must actually access properties to ensure Svelte tracks the dependency
    const _threadCount = visibleThreads.length;
    const _flowCount = flowItems.length;
    // Also track subthread slot changes by accessing the subthreads array
    const _subthreadSlotCount = visibleThreads.reduce(
      (acc, t) => acc + t.subthreads.reduce((a, s) => a + s.slotIds.length, 0),
      0
    );
    // Track cursor changes
    const _cursorIdx = cursorIndex;
    // Track active mutation changes (for inline mutation highlighting)
    const _activeMut = ui.activeMutationId;
    // Delay to allow DOM update
    requestAnimationFrame(() => measureThreadPositions());
  });

  // Thread row count for CSS variable (includes expanded subthreads)
  const threadRowCount = $derived.by(() => {
    let count = 0;
    for (const thread of visibleThreads) {
      count++; // Parent thread row
      if (thread.hasSubthreads && timelineEditor.isThreadExpanded(thread.threadId)) {
        count += thread.subthreads.length; // Subthread rows
      }
    }
    return count;
  });

  // Svelte action to register card group elements for measurement
  function registerCardGroup(node: HTMLDivElement, slotId: string) {
    cardGroupEls.set(slotId, node);
    // Trigger measurement after registration
    requestAnimationFrame(() => measureThreadPositions());

    return {
      destroy() {
        cardGroupEls.delete(slotId);
      }
    };
  }

  // Svelte action to register inline mutation elements for highlighting
  function registerInlineMutation(node: HTMLDivElement, mutationId: string) {
    inlineMutationEls.set(mutationId, node);
    // Trigger measurement after registration if this is the active mutation
    if (ui.activeMutationId === mutationId) {
      requestAnimationFrame(() => measureCursorPosition());
    }

    return {
      destroy() {
        inlineMutationEls.delete(mutationId);
      }
    };
  }

  function toggleThreadRows() {
    threadRowsExpanded = !threadRowsExpanded;
  }

  // ============================================================================
  // Thread stripes for cards
  // ============================================================================

  function getCardThreadStripes(card: TimelineCard): Array<{ id: string; color: string; name: string }> {
    const stripes: Array<{ id: string; color: string; name: string }> = [];
    const seenThreads = new Set<string>();

    // Helper to add thread stripe
    const addThread = (threadId: string) => {
      if (!seenThreads.has(threadId)) {
        seenThreads.add(threadId);
        const threadObj = objects.get(threadId);
        if (threadObj?.isThread && timelineEditor.isThreadVisible(threadId)) {
          stripes.push({
            id: threadId,
            color: objects.getEffectiveThreadColor(threadId),
            name: threadObj.name,
          });
        }
      }
    };

    // Check the card's own placement (creation/reference)
    if (card.placement?.threadIds) {
      for (const threadId of card.placement.threadIds) {
        addThread(threadId);
      }
    }

    // Also check mutations below
    for (const mutation of card.mutationsBelow) {
      for (const threadId of mutation.threadIds ?? []) {
        addThread(threadId);
      }
    }

    return stripes;
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  function handleKeyDown(e: KeyboardEvent) {
    if (collapsed) return;
    // Arrow keys, Home, End are handled by the global editor keyboard handler
    // We only handle Enter here for selecting the current card
    switch (e.key) {
      case 'Enter':
        if (timeline.currentCard) {
          ui.select(timeline.currentCard.id);
        }
        break;
    }
  }

  function handleCardClick(e: MouseEvent, objectId: string, index: number) {
    e.stopPropagation();
    // Set cursor first, then sync selection (selectCard also moves cursor, so this is belt-and-suspenders)
    timeline.setCursorIndex(index);
    // Use direct state updates to avoid double cursor movement
    timelineEditor.selectedCardId = objectId;
    timelineEditor.selectedMutationIds = new Set();
    ui.select(objectId);
  }

  function handleCardDoubleClick(objectId: string) {
    ui.select(objectId);
  }

  function handleMutationClick(e: MouseEvent, mutation: TimelinePlacement, cardIndex?: number, isInline?: boolean) {
    e.stopPropagation();
    // Select the object this mutation belongs to
    ui.select(mutation.objectId);
    // Set this mutation as the active mutation for editing
    ui.setActiveMutation(mutation.id);

    // For inline mutations (between cards), set anchor and navigate to mutation's timeslot
    if (isInline) {
      // Find the card index for this mutation's timeslot
      const timeslotIndex = timeline.getTimeslotIndex(mutation.timeslotId);
      const targetIndex = Math.max(0, timeslotIndex);
      // Navigate with anchor so user can return to previous position
      timeline.navigateWithAnchor(targetIndex);
      // Update selection state
      const card = timeline.getCardAt(targetIndex);
      if (card) {
        timelineEditor.selectedCardId = card.object.id;
        timelineEditor.selectedMutationIds = new Set();
      }
      requestAnimationFrame(() => measureCursorPosition());
      return;
    }

    // Move cursor to the card this mutation is attached to (with anchor)
    if (cardIndex !== undefined) {
      timeline.navigateWithAnchor(cardIndex);
      const card = timeline.getCardAt(cardIndex);
      if (card) {
        timelineEditor.selectedCardId = card.object.id;
        timelineEditor.selectedMutationIds = new Set();
      }
    } else if (mutation.attachedToCardId) {
      const idx = timeline.getCardIndex(mutation.attachedToCardId);
      if (idx >= 0) {
        timeline.navigateWithAnchor(idx);
        timelineEditor.selectedCardId = mutation.attachedToCardId;
        timelineEditor.selectedMutationIds = new Set();
      }
    }
  }

  let expandedConnectorKey = $state<string | null>(null);
  let expandedTimeslotId = $state<string | null>(null);

  function handleConnectorClick(e: MouseEvent, connectorKey: string) {
    e.stopPropagation();
    expandedConnectorKey = expandedConnectorKey === connectorKey ? null : connectorKey;
    expandedTimeslotId = null;
  }

  function handleTimeslotAddClick(e: MouseEvent, timeslotId: string, timeslotIndex: number) {
    e.stopPropagation();
    expandedTimeslotId = expandedTimeslotId === timeslotId ? null : timeslotId;
    expandedConnectorKey = null;
  }

  function openMilestoneDialog(dropIndex: number, editId: string | null = null) {
    milestoneDialogTimeslotIndex = dropIndex;
    milestoneDialogEditId = editId;
    milestoneDialogOpen = true;
    expandedConnectorKey = null;
  }

  function openMilestoneDialogForEdit(milestoneId: string) {
    // For editing, find the timeslot index
    const m = milestones.get(milestoneId);
    const tsIndex = m?.timeslotId ? timeline.getTimeslotIndex(m.timeslotId) : 0;
    milestoneDialogTimeslotIndex = tsIndex >= 0 ? tsIndex : 0;
    milestoneDialogEditId = milestoneId;
    milestoneDialogOpen = true;
    expandedConnectorKey = null;
  }

  function openMutationDialog(dropIndex: number) {
    mutationDialogTimeslotIndex = dropIndex;
    mutationDialogOpen = true;
    expandedConnectorKey = null;
  }

  function openAddExistingObjectDialog(dropIndex: number) {
    addExistingObjectTimeslotIndex = dropIndex;
    addExistingObjectDialogOpen = true;
    expandedConnectorKey = null;
  }

  function openCreateNewObjectDialog(dropIndex: number) {
    createNewObjectTimeslotIndex = dropIndex;
    createNewObjectDialogOpen = true;
    expandedConnectorKey = null;
  }

  // Functions for adding to existing timeslots (via the + button on timeslot)
  function openMutationDialogForTimeslot(timeslotId: string) {
    const index = timeline.getTimeslotIndex(timeslotId);
    if (index >= 0) {
      mutationDialogTimeslotIndex = index;
      mutationDialogOpen = true;
    }
    expandedTimeslotId = null;
  }

  function openAddExistingObjectDialogForTimeslot(timeslotId: string) {
    const index = timeline.getTimeslotIndex(timeslotId);
    if (index >= 0) {
      addExistingObjectTimeslotIndex = index;
      addExistingObjectDialogOpen = true;
    }
    expandedTimeslotId = null;
  }

  function openCreateNewObjectDialogForTimeslot(timeslotId: string) {
    const index = timeline.getTimeslotIndex(timeslotId);
    if (index >= 0) {
      createNewObjectTimeslotIndex = index;
      createNewObjectDialogOpen = true;
    }
    expandedTimeslotId = null;
  }

  function handleRemoveMilestone(milestoneId: string) {
    deleteMilestone(milestoneId);
  }

  function handleRemoveMutation(placementId: string) {
    deletePlacement(placementId);
  }

  function handleRemoveCard(objectId: string) {
    toggleCardRendered(objectId);
  }

  let scrollContainer: HTMLDivElement | undefined = $state();
  let scrollLeft = $state(0);

  $effect(() => {
    if (scrollContainer && cursorIndex >= 0 && !collapsed) {
      const cardEl = scrollContainer.querySelector(`[data-card-index="${cursorIndex}"]`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });

  function handleTimelineClick() {
    expandedConnectorKey = null;
    expandedTimeslotId = null;
  }

  // ============================================================================
  // Drag-Drop Handlers
  // ============================================================================

  function handleCardDragStart(e: DragEvent, objectId: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', objectId);
    e.dataTransfer.setData('application/x-aethel-card', objectId);
    e.dataTransfer.effectAllowed = 'move';
    dragType = 'card';
    draggedId = objectId;
  }

  function handleCardDragEnd() {
    dragType = null;
    draggedId = null;
    dropTargetConnectorKey = null;
    dropTargetObjectId = null;
  }

  function handleMutationDragStart(e: DragEvent, placementId: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', placementId);
    e.dataTransfer.setData('application/x-aethel-mutation', placementId);
    e.dataTransfer.effectAllowed = 'move';
    dragType = 'mutation';
    draggedId = placementId;
  }

  function handleMutationDragEnd() {
    dragType = null;
    draggedId = null;
    dropTargetConnectorKey = null;
    dropTargetObjectId = null;
  }

  function handleMilestoneDragStart(e: DragEvent, milestoneId: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', milestoneId);
    e.dataTransfer.setData('application/x-aethel-milestone', milestoneId);
    e.dataTransfer.effectAllowed = 'move';
    dragType = 'milestone';
    draggedId = milestoneId;
  }

  function handleMilestoneDragEnd() {
    dragType = null;
    draggedId = null;
    dropTargetConnectorKey = null;
  }

  // Connector drop zone handlers
  function handleConnectorDragOver(e: DragEvent, connectorKey: string) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    e.dataTransfer.dropEffect = 'move';
    dropTargetConnectorKey = connectorKey;
    // Clear card drop target to prevent both being active
    dropTargetObjectId = null;
  }

  function handleConnectorDragLeave(connectorKey: string) {
    if (dropTargetConnectorKey === connectorKey) {
      dropTargetConnectorKey = null;
    }
  }

  function handleConnectorDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();

    console.log('[handleConnectorDrop]', {
      dropIndex,
      draggedId,
      dragType
    });

    if (dragType === 'card' && draggedId) {
      // Reorder card to the drop index
      reorderCard(draggedId, dropIndex);
    } else if (dragType === 'mutation' && draggedId) {
      // Get the timeslot ID at this index for mutation drop
      const timeslotId = timeline.getTimeslotIdAt(dropIndex) ?? timeline.currentTimeslotId;
      droppedMutationId = draggedId;
      mutationDropTarget = { type: 'between', timeslotId };
      mutationDropDialogOpen = true;
    } else if (dragType === 'milestone' && draggedId) {
      // Move milestone to appear before the timeslot at dropIndex
      const targetTimeslotId = timeline.getTimeslotIdAt(dropIndex) ?? null;
      moveMilestone(draggedId, targetTimeslotId);
    }

    dropTargetConnectorKey = null;
    dragType = null;
    draggedId = null;
  }

  // Card as drop target (for mutation attachment OR card-to-card drop)
  function handleCardDragOver(e: DragEvent, objectId: string) {
    // Accept mutations for attachment OR cards for swap/stack
    if (dragType !== 'mutation' && dragType !== 'card') return;
    // Don't allow dropping card on itself
    if (dragType === 'card' && draggedId === objectId) return;
    e.preventDefault();
    if (!e.dataTransfer) return;
    e.dataTransfer.dropEffect = 'move';
    dropTargetObjectId = objectId;
    // Clear connector drop target to prevent both being active
    dropTargetConnectorKey = null;
  }

  function handleCardDragLeave(objectId: string) {
    if (dropTargetObjectId === objectId) {
      dropTargetObjectId = null;
    }
  }

  function handleCardDrop(e: DragEvent, objectId: string) {
    e.preventDefault();

    if (dragType === 'mutation' && draggedId) {
      // Existing mutation drop behavior
      droppedMutationId = draggedId;
      mutationDropTarget = { type: 'below', attachedToCardId: objectId };
      mutationDropDialogOpen = true;
    } else if (dragType === 'card' && draggedId && draggedId !== objectId) {
      // Card-to-card drop - show dialog
      droppedCardId = draggedId;
      cardDropTargetId = objectId;
      cardDropDialogOpen = true;
    }

    dropTargetObjectId = null;
    dragType = null;
    draggedId = null;
  }

  // Mutation drop dialog handlers
  function handleMutationDropMove() {
    if (!droppedMutationId || !mutationDropTarget) return;
    moveMutation(droppedMutationId, {
      timeslotId: mutationDropTarget.timeslotId ?? undefined,
      attachedToCardId: mutationDropTarget.attachedToCardId,
    });
    closeMutationDropDialog();
  }

  function handleMutationDropDuplicate() {
    if (!droppedMutationId || !mutationDropTarget) return;
    duplicateMutation(droppedMutationId, {
      timeslotId: mutationDropTarget.timeslotId ?? undefined,
      attachedToCardId: mutationDropTarget.attachedToCardId,
    });
    closeMutationDropDialog();
  }

  function handleMutationDropNewMutation() {
    if (!droppedMutationId || !mutationDropTarget) return;
    // Open mutation dialog at the timeslot
    if (mutationDropTarget.timeslotId) {
      const tsIndex = timeline.getTimeslotIndex(mutationDropTarget.timeslotId);
      mutationDialogTimeslotIndex = tsIndex >= 0 ? tsIndex : 0;
      mutationDialogOpen = true;
    }
    closeMutationDropDialog();
  }

  function closeMutationDropDialog() {
    mutationDropDialogOpen = false;
    droppedMutationId = null;
    mutationDropTarget = null;
  }

  // Card drop dialog handlers
  function handleCardDropSwap() {
    if (!droppedCardId || !cardDropTargetId) return;
    swapCards(droppedCardId, cardDropTargetId);
    closeCardDropDialog();
  }

  function handleCardDropStack() {
    if (!droppedCardId || !cardDropTargetId) return;
    stackCards(droppedCardId, cardDropTargetId);
    closeCardDropDialog();
  }

  function closeCardDropDialog() {
    cardDropDialogOpen = false;
    droppedCardId = null;
    cardDropTargetId = null;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="timeline"
  class:collapsed
  role="region"
  aria-label="Story Timeline"
  tabindex="0"
  onkeydown={handleKeyDown}
  onclick={handleTimelineClick}
>
  {#if collapsed}
    <button class="collapsed-bar" onclick={() => ui.toggleTimeline()}>
      <span class="collapsed-title">▶ Timeline</span>
      <span class="collapsed-pos">{cursorIndex + 1} / {cardCount}</span>
    </button>
  {:else if cardCount === 0}
    <div class="empty">
      <p class="empty-title">No chapters on the timeline</p>
      <p class="empty-desc">Mark objects as "Rendered" to add them here</p>
    </div>
  {:else}
    <!-- Timeline header with undo/redo -->
    <TimelineHeader />

    <!-- Cursor highlight - positioned relative to timeline, scrolls with content -->
    {#if cursorHighlight.hasPosition}
      <div
        class="cursor-highlight"
        style:left="{cursorHighlight.leftPx - scrollLeft}px"
        style:width="{cursorHighlight.widthPx}px"
      ></div>
    {/if}

    <!-- Main scroll area - contains flow and thread rows -->
    <div class="timeline-scroll" bind:this={scrollContainer} onscroll={() => { scrollLeft = scrollContainer?.scrollLeft ?? 0; }}>
      <div class="timeline-content" bind:this={flowContainerEl}>
        <div class="timeline-flow">
          <!-- Spine - behind all items -->
          <div class="flow-spine"></div>

        <!-- Flow items -->
        {#each flowItems as item (item.key)}
          {#if item.type === 'connector'}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="flow-item connector"
              class:expanded={expandedConnectorKey === item.key}
              class:drop-active={dropTargetConnectorKey === item.key}
              data-connector-key={item.key}
              data-drop-index={item.dropIndex}
              ondragover={(e) => handleConnectorDragOver(e, item.key)}
              ondragleave={() => handleConnectorDragLeave(item.key)}
              ondrop={(e) => handleConnectorDrop(e, item.dropIndex)}
            >
              <button class="node-btn" onclick={(e) => handleConnectorClick(e, item.key)}>+</button>
              {#if expandedConnectorKey === item.key}
                <div class="node-menu">
                  <button onclick={() => openMutationDialog(item.dropIndex)}>
                    <span class="menu-icon">~</span> Add Mutation
                  </button>
                  <button onclick={() => openAddExistingObjectDialog(item.dropIndex)}>
                    <span class="menu-icon">&#8250;</span> Add Existing Object
                  </button>
                  <button onclick={() => openCreateNewObjectDialog(item.dropIndex)}>
                    <span class="menu-icon">+</span> Create New Object
                  </button>
                  <button onclick={() => openMilestoneDialog(item.dropIndex)}>
                    <span class="menu-icon">|</span> Add Milestone
                  </button>
                </div>
              {/if}
            </div>

          {:else if item.type === 'timeslot'}
            {@const ts = item.timeslot}
            {@const tsCards = getCardsForTimeslot(ts)}
            {@const isStacked = tsCards.length > 1}
            {@const standaloneMutations = getUnattachedMutations(ts)}

            <div
              class="flow-item card-group"
              class:stacked={isStacked}
              use:registerCardGroup={ts.timeslotId}
            >
              {#if isStacked}
                <div class="stack-indicator"></div>
              {/if}

              <div class="cards-column">
                {#each tsCards as card (card.object.id)}
                  {@const obj = card.object}
                  {@const objType = getObjectType(obj.typeId)}
                  {@const color = objects.getEffectiveColor(obj.id)}
                  {@const icon = objects.getEffectiveIcon(obj.id)}
                  {@const isSelected = timelineEditor.selectedCardId === obj.id}
                  {@const isCurrent = card.index === cursorIndex}
                  {@const threadStripes = getCardThreadStripes(card)}

                  <div class="card-slot" data-card-index={card.index}>
                    {#if threadStripes.length > 0}
                      <div class="thread-stripes">
                        {#each threadStripes as stripe (stripe.id)}
                          <div class="thread-stripe" style:background={stripe.color} title={stripe.name}></div>
                        {/each}
                      </div>
                    {/if}

                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="card"
                      class:selected={isSelected}
                      class:current={isCurrent}
                      class:dragging={draggedId === obj.id && dragType === 'card'}
                      class:drop-target={dropTargetObjectId === obj.id}
                      style:--card-color={color}
                      draggable="true"
                      ondragstart={(e) => handleCardDragStart(e, obj.id)}
                      ondragend={handleCardDragEnd}
                      ondragover={(e) => handleCardDragOver(e, obj.id)}
                      ondragleave={() => handleCardDragLeave(obj.id)}
                      ondrop={(e) => handleCardDrop(e, obj.id)}
                      onclick={(e) => handleCardClick(e, obj.id, card.index)}
                      ondblclick={() => handleCardDoubleClick(obj.id)}
                      role="button"
                      tabindex="0"
                    >
                      {#if isCurrent}
                        <div class="cursor-arrow"></div>
                      {/if}
                      <span class="card-icon">{icon}</span>
                      <div class="card-text">
                        <span class="card-name">{obj.name}</span>
                        <span class="card-type">{objType.name}</span>
                      </div>
                      <button
                        class="card-x"
                        onclick={(e) => { e.stopPropagation(); handleRemoveCard(obj.id); }}
                      >×</button>
                    </div>

                    {#if card.mutationsBelow.length > 0}
                      <div class="below-mutations">
                        {#each card.mutationsBelow as mutation (mutation.id)}
                          {@const mutObj = objects.get(mutation.objectId)}
                          {@const mutColor = mutObj ? objects.getEffectiveColor(mutObj.id) : '#888'}
                          <!-- svelte-ignore a11y_click_events_have_key_events -->
                          <!-- svelte-ignore a11y_no_static_element_interactions -->
                          <div
                            class="mut-chip"
                            class:dragging={draggedId === mutation.id && dragType === 'mutation'}
                            style:--mc={mutColor}
                            draggable="true"
                            ondragstart={(e) => handleMutationDragStart(e, mutation.id)}
                            ondragend={handleMutationDragEnd}
                            onclick={(e) => handleMutationClick(e, mutation, card.index)}
                          >
                            <span>{mutation.mutation?.label ?? 'Changed'}</span>
                            <button class="mut-x" onclick={(e) => { e.stopPropagation(); handleRemoveMutation(mutation.id); }}>×</button>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}

                <!-- Standalone mutations (not attached to any card) -->
                {#if standaloneMutations.length > 0}
                  <div class="standalone-mutations">
                    {#each standaloneMutations as mutation (mutation.id)}
                      {@const mutObj = objects.get(mutation.objectId)}
                      {@const mutColor = mutObj ? objects.getEffectiveColor(mutObj.id) : '#888'}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="mut-chip standalone"
                        class:dragging={draggedId === mutation.id && dragType === 'mutation'}
                        style:--mc={mutColor}
                        draggable="true"
                        ondragstart={(e) => handleMutationDragStart(e, mutation.id)}
                        ondragend={handleMutationDragEnd}
                        onclick={(e) => handleMutationClick(e, mutation, ts.index)}
                      >
                        <span class="mut-icon">~</span>
                        <span>{mutation.mutation?.label ?? 'Changed'}</span>
                        <button class="mut-x" onclick={(e) => { e.stopPropagation(); handleRemoveMutation(mutation.id); }}>×</button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Add more button - absolutely positioned below -->
              <button
                class="timeslot-add-btn"
                class:expanded={expandedTimeslotId === ts.timeslotId}
                onclick={(e) => handleTimeslotAddClick(e, ts.timeslotId, ts.index)}
                title="Add mutation, object, or milestone"
              >+</button>
              {#if expandedTimeslotId === ts.timeslotId}
                <div class="timeslot-add-menu">
                  <button onclick={() => { openMutationDialogForTimeslot(ts.timeslotId); }}>
                    <span class="menu-icon">~</span> Add Mutation
                  </button>
                  <button onclick={() => { openAddExistingObjectDialogForTimeslot(ts.timeslotId); }}>
                    <span class="menu-icon">›</span> Add Existing Object
                  </button>
                  <button onclick={() => { openCreateNewObjectDialogForTimeslot(ts.timeslotId); }}>
                    <span class="menu-icon">+</span> Create New Object
                  </button>
                </div>
              {/if}
            </div>

          {:else if item.type === 'milestone'}
            {@const m = item.milestone}

            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="flow-item milestone-marker"
              class:dragging={draggedId === m.id && dragType === 'milestone'}
              style:--ml-color={m.color ?? '#8b5cf6'}
              draggable="true"
              ondragstart={(e) => handleMilestoneDragStart(e, m.id)}
              ondragend={handleMilestoneDragEnd}
              ondblclick={() => openMilestoneDialogForEdit(m.id)}
            >
              <div class="ml-line"></div>
              <div class="ml-badge">
                <span>{m.name}</span>
                <button class="ml-x" onclick={() => handleRemoveMilestone(m.id)}>×</button>
              </div>
            </div>
          {/if}
        {/each}
        </div>

        <!-- Thread section - at bottom -->
        {#if threadRowCount > 0}
          <div class="thread-header">
            <button class="thread-toggle" onclick={toggleThreadRows}>
              <span class="toggle-icon">{threadRowsExpanded ? '▼' : '▶'}</span>
              <span class="toggle-label">Threads ({threadRowCount})</span>
            </button>
          </div>
        {/if}

        <!-- Thread rows - inside scroll so they align with cards -->
        {#if threadRowCount > 0 && threadRowsExpanded}
          {@const rowPositions = (() => {
            const positions: Array<{
              type: 'thread' | 'subthread';
              threadId: string;
              sectionId?: string;
              row: number;
              thread: typeof visibleThreads[0];
              measured: typeof measuredThreads[0] | undefined;
              measuredSub?: typeof measuredSubthreads[0] | undefined;
              subthread?: SubthreadInfo;
            }> = [];
            let row = 0;
            for (const thread of visibleThreads) {
              const measured = measuredThreads.find(m => m.threadId === thread.threadId);
              positions.push({ type: 'thread', threadId: thread.threadId, row, thread, measured });
              row++;
              if (thread.hasSubthreads && timelineEditor.isThreadExpanded(thread.threadId)) {
                for (const sub of thread.subthreads) {
                  const measuredSub = measuredSubthreads.find(
                    m => m.threadId === thread.threadId && m.sectionId === sub.sectionId
                  );
                  positions.push({
                    type: 'subthread',
                    threadId: thread.threadId,
                    sectionId: sub.sectionId,
                    row,
                    thread,
                    measured,
                    measuredSub,
                    subthread: sub
                  });
                  row++;
                }
              }
            }
            return positions;
          })()}
          <div class="thread-rows" style:--thread-count={threadRowCount}>
            {#each rowPositions as pos (pos.type === 'thread' ? pos.threadId : `${pos.threadId}-${pos.sectionId}`)}
              {#if pos.type === 'thread'}
                <div class="thread-row" style:top="{pos.row * 1.5}rem">
                  <span class="thread-label" style:--thread-color={pos.thread.color}>
                    {#if pos.thread.hasSubthreads}
                      <button
                        class="subthread-toggle"
                        onclick={() => timelineEditor.toggleThreadExpanded(pos.threadId)}
                        title={timelineEditor.isThreadExpanded(pos.threadId) ? 'Collapse subthreads' : 'Expand subthreads'}
                      >
                        {timelineEditor.isThreadExpanded(pos.threadId) ? '▼' : '▶'}
                      </button>
                    {/if}
                    {pos.thread.name}
                  </span>
                  <div class="thread-track">
                    <div class="thread-base"></div>
                    {#if pos.measured?.hasActiveSpan}
                      <div
                        class="thread-active"
                        style:left="{pos.measured.activeLeftPx}px"
                        style:width="{pos.measured.activeWidthPx}px"
                        style:background={pos.thread.color}
                      ></div>
                    {/if}
                  </div>
                </div>
              {:else}
                <!-- Subthread row (indented) - uses its own measured span -->
                <div class="thread-row subthread-row" style:top="{pos.row * 1.5}rem">
                  <span class="thread-label subthread-label" style:--thread-color={pos.thread.color}>
                    {pos.subthread?.name}
                  </span>
                  <div class="thread-track">
                    <div class="thread-base subthread-base"></div>
                    {#if pos.measuredSub?.hasActiveSpan}
                      <div
                        class="thread-active subthread-active"
                        style:left="{pos.measuredSub.activeLeftPx}px"
                        style:width="{pos.measuredSub.activeWidthPx}px"
                        style:background={pos.thread.color}
                      ></div>
                    {/if}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="timeline-footer">
      <span class="pos-indicator">{cursorIndex + 1} / {cardCount}</span>
    </div>
  {/if}
</div>

<!-- Dialogs -->
<MilestoneDialog
  open={milestoneDialogOpen}
  timeslotIndex={milestoneDialogTimeslotIndex}
  milestoneId={milestoneDialogEditId}
  onClose={() => milestoneDialogOpen = false}
/>

<AddMutationDialog
  open={mutationDialogOpen}
  timeslotIndex={mutationDialogTimeslotIndex}
  onClose={() => mutationDialogOpen = false}
/>

<AddExistingObjectDialog
  open={addExistingObjectDialogOpen}
  timeslotIndex={addExistingObjectTimeslotIndex}
  onClose={() => addExistingObjectDialogOpen = false}
/>

<CreateNewObjectDialog
  open={createNewObjectDialogOpen}
  timeslotIndex={createNewObjectTimeslotIndex}
  onClose={() => createNewObjectDialogOpen = false}
/>

<MutationDropDialog
  open={mutationDropDialogOpen}
  mutationId={droppedMutationId}
  targetPosition={mutationDropTarget}
  onMove={handleMutationDropMove}
  onDuplicate={handleMutationDropDuplicate}
  onNewMutation={handleMutationDropNewMutation}
  onClose={closeMutationDropDialog}
/>

<CardDropDialog
  open={cardDropDialogOpen}
  draggedCardId={droppedCardId}
  targetCardId={cardDropTargetId}
  onSwap={handleCardDropSwap}
  onStack={handleCardDropStack}
  onClose={closeCardDropDialog}
/>

<style>
  /* ============================================================================
   * Design Tokens - Single Source of Truth
   * ============================================================================ */
  .timeline {
    /* Spacing scale (4px base) */
    --space-xs: 0.25rem;    /* 4px */
    --space-sm: 0.5rem;     /* 8px */
    --space-md: 0.75rem;    /* 12px */
    --space-lg: 1rem;       /* 16px */
    --space-xl: 1.5rem;     /* 24px */
    --space-2xl: 2rem;      /* 32px */

    /* Component sizing */
    --card-width: 11rem;
    --node-btn-size: 1.375rem;

    /* Flow layout - THE positioning source of truth */
    --flow-padding-x: var(--space-2xl);
    --flow-padding-y: var(--space-lg);
    --flow-gap: var(--space-md);  /* Gap between all flow items */

    /* Thread rows */
    --thread-row-height: 1.5rem;
    --thread-label-width: 4.5rem;

    /* Lines */
    --spine-thickness: 2px;
    --thread-thickness: 3px;
    --spine-color: var(--border-default, #e5e7eb);
  }

  /* ============================================================================
   * Timeline Container
   * ============================================================================ */
  .timeline {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-base);
    border-top: 1px solid var(--border-subtle);
    position: relative;
  }
  .timeline:focus { outline: none; }

  /* Collapsed state */
  .collapsed-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 2.25rem;
    padding: 0 var(--space-lg);
    background: var(--surface-raised);
    border: none;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }
  .collapsed-bar:hover {
    background: var(--hover-bg);
  }
  .collapsed-title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
  }
  .collapsed-pos {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  /* Empty state */
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-xl);
  }
  .empty-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin: 0;
  }
  .empty-desc {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    margin: 0;
  }

  /* ============================================================================
   * Thread Header - Expand/Collapse Toggle
   * ============================================================================ */
  .thread-header {
    display: flex;
    align-items: center;
    padding: var(--space-xs) var(--space-md);
    margin-top: var(--space-sm);
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-base);
  }

  .thread-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: var(--space-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .thread-toggle:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  .toggle-icon {
    font-size: 0.5625rem;
    color: var(--text-tertiary);
    transition: transform 0.15s ease;
  }
  .toggle-label {
    color: inherit;
    letter-spacing: 0.01em;
  }

  /* ============================================================================
   * Thread Rows - Coordinate system matches flow exactly
   * ============================================================================ */
  .thread-rows {
    position: relative;
    height: calc(var(--thread-count, 0) * var(--thread-row-height));
    flex-shrink: 0;
    overflow: visible;
    background: var(--surface-base);
    padding: var(--space-xs) 0;
  }

  .thread-row {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--thread-row-height);
    display: flex;
    align-items: center;
  }

  .thread-label {
    position: sticky;
    left: var(--space-md);
    flex-shrink: 0;
    width: var(--thread-label-width);
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--thread-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 3;
    background: var(--surface-base);
    padding-right: var(--space-sm);
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .subthread-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    padding: 0;
    font-size: 0.5rem;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .subthread-toggle:hover {
    color: var(--thread-color);
    background: var(--hover-bg);
  }

  .subthread-row {
    opacity: 0.85;
  }

  .subthread-label {
    padding-left: 14px;
    font-weight: 400;
    font-size: 0.625rem;
  }

  .subthread-base {
    opacity: 0.3;
  }

  .subthread-active {
    opacity: 0.7;
  }

  .thread-track {
    /* Track spans full width - same coordinate system as flow */
    position: absolute;
    left: 0;
    right: 0;
    height: var(--thread-thickness);
    top: 50%;
    transform: translateY(-50%);
  }

  .thread-base {
    position: absolute;
    /* Base line starts after label, ends at padding */
    left: calc(var(--thread-label-width) + var(--space-lg));
    right: var(--space-md);
    height: 100%;
    background: var(--spine-color);
    border-radius: 2px;
    opacity: 0.5;
  }

  .thread-active {
    /* Active portion positioned via JS measurements - matches flow coordinates */
    position: absolute;
    height: 100%;
    border-radius: 2px;
    z-index: 1;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
  }

  /* ============================================================================
   * Scrollable Flow Area
   * ============================================================================ */
  .timeline-scroll {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .timeline-content {
    /* Contains both thread-rows and timeline-flow with unified coordinates */
    display: flex;
    flex-direction: column;
    min-width: max-content;
  }

  .timeline-flow {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: var(--flow-padding-y) var(--flow-padding-x);
    min-width: max-content;
    position: relative;
    gap: var(--flow-gap);
  }

  /* Spine - behind all items, vertically centered */
  .flow-spine {
    position: absolute;
    left: var(--flow-padding-x);
    right: var(--flow-padding-x);
    top: 50%;
    transform: translateY(-50%);
    height: var(--spine-thickness);
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--spine-color) 3%,
      var(--spine-color) 97%,
      transparent 100%
    );
    z-index: 0;
    border-radius: 1px;
  }

  /* Cursor highlight - spans from below header to bottom of timeline */
  .cursor-highlight {
    position: absolute;
    top: 37px; /* Below header */
    bottom: 0;
    background: color-mix(in srgb, var(--accent-primary, #3b82f6) 6%, transparent);
    border-left: 2px solid color-mix(in srgb, var(--accent-primary, #3b82f6) 35%, transparent);
    border-right: 2px solid color-mix(in srgb, var(--accent-primary, #3b82f6) 35%, transparent);
    pointer-events: none;
    z-index: 1;
    transition: left 0.15s ease-out, width 0.15s ease-out;
  }

  /* ============================================================================
   * Flow Items - shared base styles
   * ============================================================================ */
  .flow-item {
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  /* Connector */
  .flow-item.connector {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-sm);
    position: relative;
  }

  .node-btn {
    width: var(--node-btn-size);
    height: var(--node-btn-size);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted, var(--text-tertiary));
    background: var(--surface-base);
    border: 1.5px solid var(--border-subtle);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.18s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }
  .node-btn:hover {
    color: var(--accent-primary, #3b82f6);
    border-color: var(--accent-primary, #3b82f6);
    background: color-mix(in srgb, var(--accent-primary, #3b82f6) 6%, var(--surface-raised));
    transform: scale(1.12);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--accent-primary, #3b82f6) 12%, transparent),
      0 2px 4px rgba(0, 0, 0, 0.06);
  }
  .flow-item.connector.expanded .node-btn {
    color: #fff;
    background: var(--accent-primary, #3b82f6);
    border-color: var(--accent-primary, #3b82f6);
    transform: scale(1.12) rotate(45deg);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--accent-primary, #3b82f6) 15%, transparent),
      0 4px 8px rgba(59, 130, 246, 0.25);
  }

  .node-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--surface-overlay, var(--surface-raised));
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg, 8px);
    padding: 6px;
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.12),
      0 2px 6px rgba(0, 0, 0, 0.08);
    z-index: 100;
    animation: menu-appear 0.15s ease-out;
  }

  @keyframes menu-appear {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-4px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
  }

  .node-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    white-space: nowrap;
    text-align: left;
    transition: all 0.12s ease;
  }
  .node-menu button:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
    padding-left: 16px;
  }

  .menu-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
  .node-menu button:hover .menu-icon {
    color: var(--accent-primary, #3b82f6);
  }

  /* Card Groups */
  .flow-item.card-group {
    position: relative;
  }
  .flow-item.card-group.stacked {
    padding-left: var(--space-sm);
  }

  .stack-indicator {
    position: absolute;
    left: 0;
    top: var(--space-xs);
    bottom: var(--space-xs);
    width: 3px;
    background: var(--accent-primary, #3b82f6);
    border-radius: 2px;
    opacity: 0.8;
  }

  .cards-column {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .card-slot {
    width: var(--card-width);
  }

  /* Card */
  .card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: 10px 12px;
    background: var(--surface-raised);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg, 8px);
    cursor: pointer;
    transition: all 0.18s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  }
  .card:hover {
    border-color: var(--border-default);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.06),
      0 1px 3px rgba(0, 0, 0, 0.04);
    transform: translateY(-2px);
  }
  .card.selected {
    border-color: var(--card-color);
    background: color-mix(in srgb, var(--card-color) 4%, var(--surface-raised));
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--card-color) 20%, transparent),
      0 4px 12px rgba(0, 0, 0, 0.08);
  }
  .card.current {
    border-color: var(--accent-primary, #3b82f6);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--accent-primary, #3b82f6) 18%, transparent),
      0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .cursor-arrow {
    position: absolute;
    left: calc(-0.5rem - 1.5px);
    top: 50%;
    transform: translateY(-50%);
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 6px solid var(--accent-primary, #3b82f6);
  }

  .card-icon {
    font-size: 1.125rem;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 1px;
  }
  .card-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }
  .card-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.3;
  }
  .card-type {
    font-size: 0.6875rem;
    color: var(--text-tertiary);
    line-height: 1.2;
  }

  .card-x {
    position: absolute;
    top: var(--space-xs);
    right: var(--space-xs);
    width: 1rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-radius: var(--space-xs);
    cursor: pointer;
    opacity: 0;
    transition: all 0.1s ease;
  }
  .card:hover .card-x { opacity: 0.6; }
  .card-x:hover {
    opacity: 1;
    background: var(--error-bg);
    color: var(--error-text);
  }

  /* Mutations below card */
  .below-mutations {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    padding-left: 4px;
    padding-right: 4px;
  }

  .mut-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 8px;
    font-size: 0.6875rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--mc) 85%, var(--text-primary));
    background: color-mix(in srgb, var(--mc) 12%, var(--surface-raised));
    border: none;
    border-left: 3px solid var(--mc);
    border-radius: var(--radius-sm, 4px);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    transition: all 0.15s ease;
  }
  .mut-chip:hover {
    background: color-mix(in srgb, var(--mc) 18%, var(--surface-raised));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
    transform: translateX(1px);
  }
  .mut-chip.standalone {
    padding: 5px 12px 5px 10px;
  }
  .mut-chip.active {
    outline: 2px solid var(--accent-primary, #3b82f6);
    outline-offset: 1px;
    background: color-mix(in srgb, var(--mc) 22%, var(--surface-raised));
  }

  .mut-x {
    width: 0.875rem;
    height: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-radius: var(--space-xs);
    cursor: pointer;
    opacity: 0;
    margin-left: auto;
    transition: all 0.1s ease;
  }
  .mut-chip:hover .mut-x { opacity: 0.6; }
  .mut-x:hover {
    opacity: 1;
    background: var(--error-bg);
    color: var(--error-text);
  }

  .mut-icon {
    font-size: 0.875rem;
    font-weight: bold;
    opacity: 0.7;
  }

  /* Standalone mutations (not attached to any card) */
  .standalone-mutations {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: var(--card-width);
  }

  .mut-chip.standalone {
    border-left-width: 4px;
    background: color-mix(in srgb, var(--mc) 15%, var(--surface-raised));
  }

  /* Timeslot add button - absolutely positioned below content */
  .timeslot-add-btn {
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    background: var(--surface-raised);
    border: 1px dashed var(--border-subtle);
    border-radius: 50%;
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
    z-index: 5;
  }

  .card-group:hover .timeslot-add-btn,
  .timeslot-add-btn.expanded {
    opacity: 1;
  }

  .timeslot-add-btn:hover {
    background: var(--hover-bg);
    border-color: var(--border-default);
    color: var(--text-primary);
  }

  .timeslot-add-menu {
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 50;
    min-width: 160px;
  }

  .timeslot-add-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    font-size: 0.75rem;
    font-weight: 500;
    text-align: left;
    color: var(--text-primary);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .timeslot-add-menu button:hover {
    background: var(--hover-bg);
  }

  .timeslot-add-menu .menu-icon {
    width: 16px;
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-tertiary);
  }

  /* Inline mutation (between cards) */
  .flow-item.inline-mut {
    display: flex;
    align-items: center;
    padding: 0 var(--space-sm);
  }

  /* Milestone marker */
  .flow-item.milestone-marker {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-md);
    position: relative;
    cursor: pointer;
  }

  .ml-line {
    position: absolute;
    top: calc(-1 * var(--flow-padding-y) - 4px);
    bottom: calc(-1 * var(--flow-padding-y) - 4px);
    left: 50%;
    width: 2px;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      var(--ml-color) 15%,
      var(--ml-color) 85%,
      transparent 100%
    );
    transform: translateX(-50%);
    z-index: 0;
  }

  .ml-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: #fff;
    background: linear-gradient(
      135deg,
      var(--ml-color) 0%,
      color-mix(in srgb, var(--ml-color) 85%, #000) 100%
    );
    border-radius: 100px;
    z-index: 1;
    white-space: nowrap;
    box-shadow:
      0 2px 6px color-mix(in srgb, var(--ml-color) 30%, transparent),
      0 1px 2px rgba(0, 0, 0, 0.1);
    transition: all 0.18s ease;
  }
  .ml-badge:hover {
    transform: scale(1.03);
    box-shadow:
      0 4px 12px color-mix(in srgb, var(--ml-color) 35%, transparent),
      0 2px 4px rgba(0, 0, 0, 0.12);
  }

  .ml-x {
    width: 0.875rem;
    height: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    color: rgba(255, 255, 255, 0.7);
    background: transparent;
    border: none;
    border-radius: var(--space-xs);
    cursor: pointer;
    opacity: 0;
    transition: all 0.1s ease;
  }
  .ml-badge:hover .ml-x { opacity: 0.8; }
  .ml-x:hover {
    opacity: 1;
    color: #fff;
    background: rgba(0, 0, 0, 0.15);
  }

  /* Thread stripes above card */
  .thread-stripes {
    display: flex;
    gap: 2px;
    height: 3px;
    margin-bottom: 6px;
    border-radius: 2px;
    overflow: hidden;
  }
  .thread-stripe {
    flex: 1;
    min-width: 12px;
    opacity: 0.85;
    transition: opacity 0.15s ease;
  }
  .card-slot:hover .thread-stripe {
    opacity: 1;
  }

  /* Footer */
  .timeline-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-lg);
    background: var(--surface-raised);
    border-top: 1px solid var(--border-subtle);
  }
  .pos-indicator {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  /* ============================================================================
   * Drag-Drop States
   * ============================================================================ */

  /* Drag source states */
  .card.dragging,
  .mut-chip.dragging,
  .milestone-marker.dragging {
    opacity: 0.4;
    transform: scale(0.98);
  }

  /* Drop zone active state for connectors */
  .flow-item.connector.drop-active {
    padding: 0 var(--space-lg);
  }

  .flow-item.connector.drop-active .node-btn {
    transform: scale(1.3);
    background: var(--accent-primary, #3b82f6);
    color: white;
    border-color: var(--accent-primary, #3b82f6);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--accent-primary, #3b82f6) 20%, transparent),
      0 4px 8px rgba(59, 130, 246, 0.25);
  }

  /* Card as drop target (for mutations) */
  .card.drop-target {
    outline: 2px dashed var(--accent-primary, #3b82f6);
    outline-offset: 2px;
    background: color-mix(in srgb, var(--accent-primary, #3b82f6) 8%, var(--surface-raised));
  }
</style>
