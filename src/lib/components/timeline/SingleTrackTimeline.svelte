<script lang="ts">
  import { timeline, timelineEditor, milestones, objects, ui } from '$lib/stores';
  import { getObjectType } from '$lib/types';
  import type { TimelinePlacement, Milestone } from '$lib/types';
  import type { TimelineCard } from '$lib/stores/timeline.svelte';
  import { deleteMilestone, deletePlacement, toggleCardRendered, reorderCard, moveMutation, duplicateMutation, moveMilestone, swapCards, stackCards } from '$lib/services/timeline-operations';
  import { MilestoneDialog, AddMutationDialog, AddExistingObjectDialog, CreateNewObjectDialog, MutationDropDialog, CardDropDialog } from './dialogs';
  import TimelineHeader from './TimelineHeader.svelte';

  interface Props {
    collapsed?: boolean;
  }

  let { collapsed = false }: Props = $props();

  // Timeline data
  const cards = $derived(timeline.cards);
  const mutationsBetween = $derived(timeline.mutationsBetween);
  const allMilestones = $derived(milestones.all);
  const cursorIndex = $derived(timeline.cursorIndex);
  const cardCount = $derived(timeline.cardCount);

  // Dialog state - now uses position instead of afterIndex
  let milestoneDialogOpen = $state(false);
  let milestoneDialogPosition = $state(500); // Default to position 500 (before first item at 1000)
  let milestoneDialogEditId = $state<string | null>(null);

  let mutationDialogOpen = $state(false);
  let mutationDialogPosition = $state(500);

  let addExistingObjectDialogOpen = $state(false);
  let addExistingObjectPosition = $state(500);

  let createNewObjectDialogOpen = $state(false);
  let createNewObjectPosition = $state(500);

  // Drag-drop state
  let dragType = $state<'card' | 'mutation' | 'milestone' | null>(null);
  let draggedId = $state<string | null>(null);
  let dropTargetConnectorKey = $state<string | null>(null);
  let dropTargetObjectId = $state<string | null>(null);

  // Mutation drop dialog state - now uses position
  let mutationDropDialogOpen = $state(false);
  let droppedMutationId = $state<string | null>(null);
  let mutationDropTarget = $state<{ type: 'between' | 'below'; position?: number; attachedToObjectId?: string } | null>(null);

  // Card drop dialog state
  let cardDropDialogOpen = $state(false);
  let droppedCardId = $state<string | null>(null);
  let cardDropTargetId = $state<string | null>(null);

  // ============================================================================
  // Slot Groups - Group cards by timelineSlot for stacking
  // ============================================================================

  interface SlotGroup {
    slotId: string;
    cards: TimelineCard[];
    /** The index of the first card in renderedObjects order */
    visualPosition: number;
  }

  /**
   * Group ADJACENT cards by timelineSlot for stacking.
   * Only cards that are consecutive in sort order AND have the same
   * numeric timelineSlot are grouped together.
   * This ensures visual order always matches actual card index order.
   */
  const slotGroups = $derived.by(() => {
    const groups: SlotGroup[] = [];

    if (cards.length === 0) return groups;

    let currentGroup: TimelineCard[] = [cards[0]];
    let currentSlot = cards[0].object.timelineSlot;

    for (let i = 1; i < cards.length; i++) {
      const card = cards[i];
      const slot = card.object.timelineSlot;

      // Group if: both have numeric slots AND slots match
      const shouldGroup =
        typeof currentSlot === 'number' &&
        typeof slot === 'number' &&
        slot === currentSlot;

      if (shouldGroup) {
        currentGroup.push(card);
      } else {
        // Flush current group
        groups.push({
          slotId: typeof currentSlot === 'number'
            ? `slot-${currentSlot}-${currentGroup[0].object.id}`
            : `card-${currentGroup[0].object.id}`,
          cards: currentGroup,
          visualPosition: currentGroup[0].index,
        });
        // Start new group
        currentGroup = [card];
        currentSlot = slot;
      }
    }

    // Flush final group
    groups.push({
      slotId: typeof currentSlot === 'number'
        ? `slot-${currentSlot}-${currentGroup[0].object.id}`
        : `card-${currentGroup[0].object.id}`,
      cards: currentGroup,
      visualPosition: currentGroup[0].index,
    });

    return groups;
  });

  // ============================================================================
  // Flow Items - Build flat array for horizontal flexbox layout
  // Uses unified position model - each connector has unique dropPosition
  // ============================================================================

  type FlowItem =
    | { type: 'connector'; key: string; dropPosition: number }
    | { type: 'card-group'; key: string; slotId: string; group: SlotGroup; position: number }
    | { type: 'mutation'; key: string; placement: TimelinePlacement; position: number }
    | { type: 'milestone'; key: string; milestone: Milestone; position: number };

  const flowItems = $derived.by(() => {
    const items: FlowItem[] = [];
    const allItems = timeline.getAllItemsSorted;

    // Connector before first item
    const firstPos = allItems[0]?.position ?? 1000;
    items.push({
      type: 'connector',
      key: 'conn-start',
      dropPosition: timeline.getPositionBetween(null, firstPos)
    });

    // Track which cards we've already processed (for grouping)
    const processedCardIds = new Set<string>();

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const nextItem = allItems[i + 1];

      if (item.type === 'card') {
        // Skip if already processed as part of a group
        if (processedCardIds.has(item.item.id)) continue;

        // Find the slot group this card belongs to
        const group = slotGroups.find(g => g.cards.some(c => c.object.id === item.item.id));
        if (group) {
          // Mark all cards in this group as processed
          for (const card of group.cards) {
            processedCardIds.add(card.object.id);
          }

          // Add card group with position of first card in group
          items.push({
            type: 'card-group',
            key: `group-${group.slotId}`,
            slotId: group.slotId,
            group,
            position: item.position
          });

          // Find the position after the last card in the group for the connector
          const lastCardInGroup = group.cards[group.cards.length - 1];
          const lastCardPos = lastCardInGroup.object.position ?? item.position;

          // Find next item that's NOT in this group
          let nextNonGroupItem = nextItem;
          let nextIdx = i + 1;
          while (nextNonGroupItem && nextNonGroupItem.type === 'card' && group.cards.some(c => c.object.id === nextNonGroupItem!.item.id)) {
            nextIdx++;
            nextNonGroupItem = allItems[nextIdx];
          }

          // Connector after this group
          items.push({
            type: 'connector',
            key: `conn-${lastCardPos}`,
            dropPosition: timeline.getPositionBetween(lastCardPos, nextNonGroupItem?.position ?? null)
          });
        } else {
          // Fallback: if slotGroups lookup fails (can happen during reactivity updates),
          // create a minimal single-card group to avoid missing cards
          processedCardIds.add(item.item.id);

          // Find the card object in the cards array for mutationsBelow
          const cardObj = cards.find(c => c.object.id === item.item.id);
          const fallbackGroup: SlotGroup = {
            slotId: `card-${item.item.id}`,
            cards: cardObj ? [cardObj] : [{
              index: 0,
              object: item.item,
              placement: null,
              mutationsBelow: []
            }],
            visualPosition: 0
          };

          items.push({
            type: 'card-group',
            key: `group-${fallbackGroup.slotId}`,
            slotId: fallbackGroup.slotId,
            group: fallbackGroup,
            position: item.position
          });

          // Connector after this card
          items.push({
            type: 'connector',
            key: `conn-${item.position}`,
            dropPosition: timeline.getPositionBetween(item.position, nextItem?.position ?? null)
          });
        }
      } else if (item.type === 'milestone') {
        items.push({
          type: 'milestone',
          key: `ms-${item.item.id}`,
          milestone: item.item,
          position: item.position
        });

        // Connector after milestone
        items.push({
          type: 'connector',
          key: `conn-ms-${item.item.id}`,
          dropPosition: timeline.getPositionBetween(item.position, nextItem?.position ?? null)
        });
      } else if (item.type === 'mutation') {
        items.push({
          type: 'mutation',
          key: `mut-${item.item.id}`,
          placement: item.item,
          position: item.position
        });

        // Connector after mutation
        items.push({
          type: 'connector',
          key: `conn-mut-${item.item.id}`,
          dropPosition: timeline.getPositionBetween(item.position, nextItem?.position ?? null)
        });
      }
    }

    // Deduplicate consecutive connectors (keep only the last one before each non-connector)
    const dedupedItems: FlowItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const next = items[i + 1];
      // Skip this connector if the next item is also a connector
      if (item.type === 'connector' && next?.type === 'connector') {
        continue;
      }
      dedupedItems.push(item);
    }

    return dedupedItems;
  });

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
  const threadSlotMap = $derived.by(() => {
    const map = new Map<string, Set<string>>(); // slotId -> Set of threadIds
    for (const group of slotGroups) {
      const threadIds = new Set<string>();
      for (const card of group.cards) {
        // Check the card's own placement (creation/reference) for thread membership
        if (card.placement?.threadIds) {
          for (const threadId of card.placement.threadIds) {
            if (timelineEditor.isThreadVisible(threadId)) {
              threadIds.add(threadId);
            }
          }
        }
        // Also check mutations below the card
        for (const mutation of card.mutationsBelow) {
          for (const threadId of mutation.threadIds ?? []) {
            if (timelineEditor.isThreadVisible(threadId)) {
              threadIds.add(threadId);
            }
          }
        }
      }
      if (threadIds.size > 0) {
        map.set(group.slotId, threadIds);
      }
    }
    return map;
  });

  // Visible thread info (for rendering thread rows)
  interface ThreadInfo {
    threadId: string;
    color: string;
    name: string;
    slotIds: string[]; // Which slot groups this thread spans
  }

  const visibleThreads = $derived.by(() => {
    const threads: ThreadInfo[] = [];
    for (const threadId of timelineEditor.visibleThreadIds) {
      const threadObj = objects.get(threadId);
      if (!threadObj?.isThread) continue;

      const slotIds: string[] = [];
      for (const [slotId, threadIds] of threadSlotMap) {
        if (threadIds.has(threadId)) {
          slotIds.push(slotId);
        }
      }

      // Include thread even if no slots - it will show as inactive
      threads.push({
        threadId,
        color: objects.getEffectiveThreadColor(threadId),
        name: threadObj.name,
        slotIds,
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

  let measuredThreads = $state<MeasuredThread[]>([]);
  let totalFlowWidth = $state(0);

  function measureThreadPositions() {
    if (!flowContainerEl) return;

    const threads: MeasuredThread[] = [];
    const containerRect = flowContainerEl.getBoundingClientRect();
    const scrollLeft = flowContainerEl.scrollLeft;
    totalFlowWidth = flowContainerEl.scrollWidth;

    for (const thread of visibleThreads) {
      if (thread.slotIds.length === 0) {
        // No active cards for this thread - show as inactive
        threads.push({
          threadId: thread.threadId,
          color: thread.color,
          name: thread.name,
          activeLeftPx: 0,
          activeWidthPx: 0,
          hasActiveSpan: false,
        });
        continue;
      }

      // Get first and last card group elements
      const firstEl = cardGroupEls.get(thread.slotIds[0]);
      const lastEl = cardGroupEls.get(thread.slotIds[thread.slotIds.length - 1]);
      if (!firstEl || !lastEl) continue;

      const firstRect = firstEl.getBoundingClientRect();
      const lastRect = lastEl.getBoundingClientRect();

      // Measure full card width (left edge to right edge)
      threads.push({
        threadId: thread.threadId,
        color: thread.color,
        name: thread.name,
        activeLeftPx: firstRect.left - containerRect.left + scrollLeft,
        activeWidthPx: lastRect.right - firstRect.left,
        hasActiveSpan: true,
      });
    }

    measuredThreads = threads;
  }

  // Recalculate thread positions when layout changes
  $effect(() => {
    // Dependencies: trigger recalc when these change
    visibleThreads;
    flowItems;
    // Delay to allow DOM update
    requestAnimationFrame(() => measureThreadPositions());
  });

  // Thread row count for CSS variable
  const threadRowCount = $derived(visibleThreads.length);

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
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        timeline.cursorNext();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        timeline.cursorPrev();
        break;
      case 'Home':
        e.preventDefault();
        timeline.cursorFirst();
        break;
      case 'End':
        e.preventDefault();
        timeline.cursorLast();
        break;
      case 'Enter':
        if (timeline.currentCard) {
          ui.select(timeline.currentCard.id);
        }
        break;
    }
  }

  function handleCardClick(e: MouseEvent, objectId: string, index: number) {
    e.stopPropagation();
    timelineEditor.selectCard(objectId);
    timeline.setCursorIndex(index);
  }

  function handleCardDoubleClick(objectId: string) {
    ui.select(objectId);
  }

  let expandedConnectorKey = $state<string | null>(null);

  function handleConnectorClick(e: MouseEvent, connectorKey: string) {
    e.stopPropagation();
    expandedConnectorKey = expandedConnectorKey === connectorKey ? null : connectorKey;
  }

  function openMilestoneDialog(position: number, editId: string | null = null) {
    milestoneDialogPosition = position;
    milestoneDialogEditId = editId;
    milestoneDialogOpen = true;
    expandedConnectorKey = null;
  }

  function openMutationDialog(position: number) {
    mutationDialogPosition = position;
    mutationDialogOpen = true;
    expandedConnectorKey = null;
  }

  function openAddExistingObjectDialog(position: number) {
    addExistingObjectPosition = position;
    addExistingObjectDialogOpen = true;
    expandedConnectorKey = null;
  }

  function openCreateNewObjectDialog(position: number) {
    createNewObjectPosition = position;
    createNewObjectDialogOpen = true;
    expandedConnectorKey = null;
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

  function handleConnectorDrop(e: DragEvent, dropPosition: number) {
    e.preventDefault();

    console.log('[handleConnectorDrop]', {
      dropPosition,
      draggedId,
      dragType
    });

    if (dragType === 'card' && draggedId) {
      // Reorder card to the drop position
      reorderCard(draggedId, dropPosition);
    } else if (dragType === 'mutation' && draggedId) {
      // Show mutation drop dialog with position
      droppedMutationId = draggedId;
      mutationDropTarget = { type: 'between', position: dropPosition };
      mutationDropDialogOpen = true;
    } else if (dragType === 'milestone' && draggedId) {
      // Move milestone to new position
      moveMilestone(draggedId, dropPosition);
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
      mutationDropTarget = { type: 'below', attachedToObjectId: objectId };
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
      display: mutationDropTarget.type,
      position: mutationDropTarget.position,
      attachedToObjectId: mutationDropTarget.attachedToObjectId,
    });
    closeMutationDropDialog();
  }

  function handleMutationDropDuplicate() {
    if (!droppedMutationId || !mutationDropTarget) return;
    duplicateMutation(droppedMutationId, {
      display: mutationDropTarget.type,
      position: mutationDropTarget.position,
      attachedToObjectId: mutationDropTarget.attachedToObjectId,
    });
    closeMutationDropDialog();
  }

  function handleMutationDropNewMutation() {
    if (!droppedMutationId || !mutationDropTarget) return;
    // Open mutation dialog at new position
    if (mutationDropTarget.position !== undefined) {
      mutationDialogPosition = mutationDropTarget.position;
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
    <div class="collapsed-bar">
      <span class="collapsed-title">Timeline</span>
      <span class="collapsed-pos">{cursorIndex + 1} / {cardCount}</span>
    </div>
  {:else if cardCount === 0}
    <div class="empty">
      <p class="empty-title">No chapters on the timeline</p>
      <p class="empty-desc">Mark objects as "Rendered" to add them here</p>
    </div>
  {:else}
    <!-- Timeline header with undo/redo -->
    <TimelineHeader />

    <!-- Main scroll area - contains flow and thread rows -->
    <div class="timeline-scroll" bind:this={scrollContainer}>
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
              data-drop-position={item.dropPosition}
              ondragover={(e) => handleConnectorDragOver(e, item.key)}
              ondragleave={() => handleConnectorDragLeave(item.key)}
              ondrop={(e) => handleConnectorDrop(e, item.dropPosition)}
            >
              <button class="node-btn" onclick={(e) => handleConnectorClick(e, item.key)}>+</button>
              {#if expandedConnectorKey === item.key}
                <div class="node-menu">
                  <button onclick={() => openMutationDialog(item.dropPosition)}>
                    <span class="menu-icon">~</span> Add Mutation
                  </button>
                  <button onclick={() => openAddExistingObjectDialog(item.dropPosition)}>
                    <span class="menu-icon">&#8250;</span> Add Existing Object
                  </button>
                  <button onclick={() => openCreateNewObjectDialog(item.dropPosition)}>
                    <span class="menu-icon">+</span> Create New Object
                  </button>
                  <button onclick={() => openMilestoneDialog(item.dropPosition)}>
                    <span class="menu-icon">|</span> Add Milestone
                  </button>
                </div>
              {/if}
            </div>

          {:else if item.type === 'card-group'}
            {@const group = item.group}
            {@const isStacked = group.cards.length > 1}

            <div
              class="flow-item card-group"
              class:stacked={isStacked}
              use:registerCardGroup={item.slotId}
            >
              {#if isStacked}
                <div class="stack-indicator"></div>
              {/if}

              <div class="cards-column">
                {#each group.cards as card (card.object.id)}
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
                          <div
                            class="mut-chip"
                            class:dragging={draggedId === mutation.id && dragType === 'mutation'}
                            style:--mc={mutColor}
                            draggable="true"
                            ondragstart={(e) => handleMutationDragStart(e, mutation.id)}
                            ondragend={handleMutationDragEnd}
                          >
                            <span>{mutation.mutation?.label ?? 'Changed'}</span>
                            <button class="mut-x" onclick={() => handleRemoveMutation(mutation.id)}>×</button>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

          {:else if item.type === 'mutation'}
            {@const mut = item.placement}
            {@const mutObj = objects.get(mut.objectId)}
            {@const mutColor = mutObj ? objects.getEffectiveColor(mutObj.id) : '#888'}

            <div class="flow-item inline-mut">
              <div
                class="mut-chip standalone"
                class:dragging={draggedId === mut.id && dragType === 'mutation'}
                style:--mc={mutColor}
                draggable="true"
                ondragstart={(e) => handleMutationDragStart(e, mut.id)}
                ondragend={handleMutationDragEnd}
              >
                <span>{mut.mutation?.label ?? '~'}</span>
                <button class="mut-x" onclick={() => handleRemoveMutation(mut.id)}>×</button>
              </div>
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
              ondblclick={() => openMilestoneDialog(m.position, m.id)}
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
          <div class="thread-rows" style:--thread-count={threadRowCount}>
            {#each measuredThreads as thread, i (thread.threadId)}
              <div class="thread-row" style:top="{i * 1.5}rem">
                <span class="thread-label" style:--thread-color={thread.color}>{thread.name}</span>
                <div class="thread-track">
                  <div class="thread-base"></div>
                  {#if thread.hasActiveSpan}
                    <div
                      class="thread-active"
                      style:left="{thread.activeLeftPx}px"
                      style:width="{thread.activeWidthPx}px"
                      style:background={thread.color}
                    ></div>
                  {/if}
                </div>
              </div>
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
  position={milestoneDialogPosition}
  milestoneId={milestoneDialogEditId}
  onClose={() => milestoneDialogOpen = false}
/>

<AddMutationDialog
  open={mutationDialogOpen}
  position={mutationDialogPosition}
  onClose={() => mutationDialogOpen = false}
/>

<AddExistingObjectDialog
  open={addExistingObjectDialogOpen}
  position={addExistingObjectPosition}
  onClose={() => addExistingObjectDialogOpen = false}
/>

<CreateNewObjectDialog
  open={createNewObjectDialogOpen}
  position={createNewObjectPosition}
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
  }
  .timeline:focus { outline: none; }

  /* Collapsed state */
  .collapsed-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 2.25rem;
    padding: 0 var(--space-lg);
    background: var(--surface-raised);
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
