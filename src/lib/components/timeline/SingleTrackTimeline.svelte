<script lang="ts">
  import { timeline, timelineEditor, milestones, objects, ui } from '$lib/stores';
  import { getObjectType } from '$lib/types';
  import type { TimelinePlacement, Milestone } from '$lib/types';
  import type { TimelineCard } from '$lib/stores/timeline.svelte';
  import { deleteMilestone, deletePlacement, toggleCardRendered } from '$lib/services/timeline-operations';
  import { MilestoneDialog, AddMutationDialog } from './dialogs';

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

  // Dialog state
  let milestoneDialogOpen = $state(false);
  let milestoneDialogAfterIndex = $state(-1);
  let milestoneDialogEditId = $state<string | null>(null);

  let mutationDialogOpen = $state(false);
  let mutationDialogAfterIndex = $state(-1);

  // ============================================================================
  // Slot Groups - Group cards by timelineSlot for stacking
  // ============================================================================

  interface SlotGroup {
    slotId: string;
    cards: TimelineCard[];
    minIndex: number;
    maxIndex: number;
  }

  const slotGroups = $derived.by(() => {
    const groups: SlotGroup[] = [];
    const slotMap = new Map<number, TimelineCard[]>();
    const ungrouped: TimelineCard[] = [];

    for (const card of cards) {
      const slot = card.object.timelineSlot;
      if (typeof slot === 'number') {
        const existing = slotMap.get(slot) ?? [];
        existing.push(card);
        slotMap.set(slot, existing);
      } else {
        ungrouped.push(card);
      }
    }

    for (const [slot, slotCards] of slotMap) {
      const sorted = slotCards.sort((a, b) => a.index - b.index);
      groups.push({
        slotId: `slot-${slot}`,
        cards: sorted,
        minIndex: Math.min(...sorted.map(c => c.index)),
        maxIndex: Math.max(...sorted.map(c => c.index)),
      });
    }

    for (const card of ungrouped) {
      groups.push({
        slotId: `card-${card.object.id}`,
        cards: [card],
        minIndex: card.index,
        maxIndex: card.index,
      });
    }

    return groups.sort((a, b) => a.minIndex - b.minIndex);
  });

  // ============================================================================
  // Flow Items - Build flat array for horizontal flexbox layout
  // ============================================================================

  type FlowItem =
    | { type: 'connector'; key: string; afterIndex: number }
    | { type: 'card-group'; key: string; slotId: string; group: SlotGroup }
    | { type: 'mutation'; key: string; placement: TimelinePlacement }
    | { type: 'milestone'; key: string; milestone: Milestone };

  const flowItems = $derived.by(() => {
    const items: FlowItem[] = [];

    const usedMutationIds = new Set<string>();
    const usedMilestoneIds = new Set<string>();

    // Helper to add connector if last item wasn't a connector
    const addConnectorIfNeeded = (afterIndex: number) => {
      const last = items[items.length - 1];
      if (!last || last.type !== 'connector') {
        items.push({ type: 'connector', key: `conn-${afterIndex}-${items.length}`, afterIndex });
      }
    };

    // Items before first card (afterIndex -1)
    for (const mut of mutationsBetween) {
      const afterIdx = mut.afterRenderedIndex ?? -1;
      if (afterIdx < 0) {
        addConnectorIfNeeded(-1);
        items.push({ type: 'mutation', key: `mut-${mut.id}`, placement: mut });
        usedMutationIds.add(mut.id);
      }
    }
    for (const milestone of allMilestones) {
      if (milestone.afterIndex < 0) {
        addConnectorIfNeeded(-1);
        items.push({ type: 'milestone', key: `ms-${milestone.id}`, milestone });
        usedMilestoneIds.add(milestone.id);
      }
    }

    // Starting connector before first card
    addConnectorIfNeeded(-1);

    for (const group of slotGroups) {
      // Card group
      items.push({ type: 'card-group', key: `group-${group.slotId}`, slotId: group.slotId, group });

      // Mutations after this group (with connectors between them)
      for (const mut of mutationsBetween) {
        if (usedMutationIds.has(mut.id)) continue;
        const afterIdx = mut.afterRenderedIndex ?? -1;
        if (afterIdx >= group.minIndex && afterIdx <= group.maxIndex) {
          addConnectorIfNeeded(afterIdx);
          items.push({ type: 'mutation', key: `mut-${mut.id}`, placement: mut });
          usedMutationIds.add(mut.id);
        }
      }

      // Milestones after this group (with connectors between them)
      for (const milestone of allMilestones) {
        if (usedMilestoneIds.has(milestone.id)) continue;
        if (milestone.afterIndex >= group.minIndex && milestone.afterIndex <= group.maxIndex) {
          addConnectorIfNeeded(milestone.afterIndex);
          items.push({ type: 'milestone', key: `ms-${milestone.id}`, milestone });
          usedMilestoneIds.add(milestone.id);
        }
      }

      // Connector after group
      addConnectorIfNeeded(group.maxIndex);
    }

    return items;
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

    for (const mutation of card.mutationsBelow) {
      for (const threadId of mutation.threadIds ?? []) {
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

  let expandedConnector = $state<number | null>(null);

  function handleConnectorClick(e: MouseEvent, afterIndex: number) {
    e.stopPropagation();
    expandedConnector = expandedConnector === afterIndex ? null : afterIndex;
  }

  function openMilestoneDialog(afterIndex: number, editId: string | null = null) {
    milestoneDialogAfterIndex = afterIndex;
    milestoneDialogEditId = editId;
    milestoneDialogOpen = true;
    expandedConnector = null;
  }

  function openMutationDialog(afterIndex: number) {
    mutationDialogAfterIndex = afterIndex;
    mutationDialogOpen = true;
    expandedConnector = null;
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
    expandedConnector = null;
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
    <!-- Thread rows - full width gray lines with colored overlay for active portion -->
    {#if threadRowCount > 0}
      <div class="thread-header">
        <button class="thread-toggle" onclick={toggleThreadRows}>
          <span class="toggle-icon">{threadRowsExpanded ? '▼' : '▶'}</span>
          <span class="toggle-label">Threads ({threadRowCount})</span>
        </button>
      </div>
      {#if threadRowsExpanded}
        <div class="thread-rows" style:--thread-count={threadRowCount}>
          {#each measuredThreads as thread, i (thread.threadId)}
            <div class="thread-row" style:top="{i * 1.25}rem">
              <span class="thread-label" style:--thread-color={thread.color}>{thread.name}</span>
              <div class="thread-track">
                <!-- Gray base line spanning full width -->
                <div class="thread-base"></div>
                <!-- Colored active portion -->
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
    {/if}

    <!-- Main flow area -->
    <div class="timeline-scroll" bind:this={scrollContainer}>
      <div class="timeline-flow" bind:this={flowContainerEl}>
        <!-- Spine - centered behind items -->
        <div class="flow-spine"></div>

        <!-- Flow items -->
        {#each flowItems as item (item.key)}
          {#if item.type === 'connector'}
            <div
              class="flow-item connector"
              class:expanded={expandedConnector === item.afterIndex}
            >
              <button class="node-btn" onclick={(e) => handleConnectorClick(e, item.afterIndex)}>+</button>
              {#if expandedConnector === item.afterIndex}
                <div class="node-menu">
                  <button onclick={() => openMutationDialog(item.afterIndex)}>+ Mutation</button>
                  <button onclick={() => openMilestoneDialog(item.afterIndex)}>+ Milestone</button>
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
                    <div
                      class="card"
                      class:selected={isSelected}
                      class:current={isCurrent}
                      style:--card-color={color}
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
                          <div class="mut-chip" style:--mc={mutColor}>
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
              <div class="mut-chip standalone" style:--mc={mutColor}>
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
              style:--ml-color={m.color ?? '#8b5cf6'}
              ondblclick={() => openMilestoneDialog(m.afterIndex, m.id)}
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
    </div>

    <div class="timeline-footer">
      <span class="pos-indicator">{cursorIndex + 1} / {cardCount}</span>
    </div>
  {/if}
</div>

<!-- Dialogs -->
<MilestoneDialog
  open={milestoneDialogOpen}
  afterIndex={milestoneDialogAfterIndex}
  milestoneId={milestoneDialogEditId}
  onClose={() => milestoneDialogOpen = false}
/>

<AddMutationDialog
  open={mutationDialogOpen}
  afterIndex={mutationDialogAfterIndex}
  onClose={() => mutationDialogOpen = false}
/>

<style>
  /* ============================================================================
   * Design Tokens
   * ============================================================================ */
  .timeline {
    --card-width: 10rem;
    --connector-padding: 0.25rem;
    --mutation-padding: 0.125rem;
    --milestone-padding: 0.25rem;
    --flow-padding-x: 1rem;
    --flow-padding-y: 0.75rem;
    --thread-row-height: 1.25rem;
    --spine-thickness: 2px;
    --thread-thickness: 3px;
    --spine-color: var(--border-default, #d1d5db);
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
    height: 2rem;
    padding: 0 1rem;
  }
  .collapsed-title { font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); }
  .collapsed-pos { font-size: 0.6875rem; color: var(--text-tertiary); }

  /* Empty state */
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }
  .empty-title { font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); margin: 0; }
  .empty-desc { font-size: 0.6875rem; color: var(--text-tertiary); margin: 0; }

  /* ============================================================================
   * Thread Header - Expand/Collapse Toggle
   * ============================================================================ */
  .thread-header {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-raised);
  }

  .thread-toggle {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }
  .thread-toggle:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  .toggle-icon {
    font-size: 0.5rem;
    color: var(--text-tertiary);
  }
  .toggle-label {
    color: inherit;
  }

  /* ============================================================================
   * Thread Rows - Full width with colored active overlay
   * ============================================================================ */
  .thread-rows {
    position: relative;
    height: calc(var(--thread-count, 0) * var(--thread-row-height));
    flex-shrink: 0;
    overflow: hidden;
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
    position: absolute;
    left: 0.5rem;
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--thread-color);
    white-space: nowrap;
    z-index: 2;
    background: var(--surface-base);
    padding: 0 0.25rem;
  }

  .thread-track {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--thread-thickness);
    top: 50%;
    transform: translateY(-50%);
  }

  .thread-base {
    position: absolute;
    left: var(--flow-padding-x);
    right: var(--flow-padding-x);
    height: 100%;
    background: var(--spine-color);
    border-radius: 1px;
  }

  .thread-active {
    position: absolute;
    height: 100%;
    border-radius: 1px;
    z-index: 1;
  }

  /* ============================================================================
   * Scrollable Flow Area
   * ============================================================================ */
  .timeline-scroll {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .timeline-flow {
    display: flex;
    flex-direction: row;
    align-items: center; /* KEY: vertical centering */
    padding: var(--flow-padding-y) var(--flow-padding-x);
    min-width: max-content;
    position: relative;
  }

  /* Spine - behind all items, vertically centered */
  .flow-spine {
    position: absolute;
    left: var(--flow-padding-x);
    right: var(--flow-padding-x);
    top: 50%;
    transform: translateY(-50%);
    height: var(--spine-thickness);
    background: var(--spine-color);
    z-index: 0;
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
    padding: 0 var(--connector-padding);
    position: relative;
  }

  .node-btn {
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-tertiary);
    background: var(--surface-base);
    border: 1.5px solid var(--spine-color);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.1s ease;
  }
  .node-btn:hover {
    color: var(--accent-primary, #3b82f6);
    border-color: var(--accent-primary, #3b82f6);
    transform: scale(1.1);
  }
  .flow-item.connector.expanded .node-btn {
    color: #fff;
    background: var(--accent-primary, #3b82f6);
    border-color: var(--accent-primary, #3b82f6);
    transform: scale(1.1);
  }

  .node-menu {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 0.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    background: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: 0.375rem;
    padding: 0.25rem;
    box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,0.12);
    z-index: 100;
  }
  .node-menu button {
    padding: 0.3125rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    white-space: nowrap;
    text-align: left;
  }
  .node-menu button:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  /* Card Groups */
  .flow-item.card-group {
    position: relative;
  }
  .flow-item.card-group.stacked {
    padding-left: 0.375rem;
  }

  .stack-indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 0.1875rem;
    background: var(--accent-primary, #3b82f6);
    border-radius: 1px;
    opacity: 0.7;
  }

  .cards-column {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .card-slot {
    width: var(--card-width);
  }

  /* Card */
  .card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    background: var(--surface-raised);
    border: 1.5px solid var(--border-subtle);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.1s;
  }
  .card:hover {
    border-color: var(--border-default);
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .card.selected {
    border-color: var(--card-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--card-color) 20%, transparent);
  }
  .card.current {
    border-color: var(--accent-primary, #3b82f6);
  }

  .cursor-arrow {
    position: absolute;
    left: calc(-0.375rem - 1.5px);
    top: 50%;
    transform: translateY(-50%);
    border-top: 0.25rem solid transparent;
    border-bottom: 0.25rem solid transparent;
    border-left: 0.375rem solid var(--accent-primary, #3b82f6);
  }

  .card-icon { font-size: 1rem; flex-shrink: 0; line-height: 1; }
  .card-text { display: flex; flex-direction: column; gap: 0; min-width: 0; flex: 1; }
  .card-name { font-size: 0.75rem; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card-type { font-size: 0.625rem; color: var(--text-tertiary); }

  .card-x {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    width: 0.875rem;
    height: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .card:hover .card-x { opacity: 1; }
  .card-x:hover { background: var(--error-bg); color: var(--error-text); }

  /* Mutations below card */
  .below-mutations {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-top: 0.25rem;
    padding-left: 0.125rem;
  }

  .mut-chip {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.375rem;
    font-size: 0.625rem;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--mc) 10%, var(--surface-base));
    border: 1px dashed color-mix(in srgb, var(--mc) 35%, var(--border-subtle));
    border-left: 2px solid var(--mc);
    border-radius: 2px;
  }
  .mut-chip.standalone {
    border-left-style: dashed;
  }

  .mut-x {
    width: 0.75rem;
    height: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5rem;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    opacity: 0;
    margin-left: auto;
  }
  .mut-chip:hover .mut-x { opacity: 1; }
  .mut-x:hover { background: var(--error-bg); color: var(--error-text); }

  /* Inline mutation (between cards) */
  .flow-item.inline-mut {
    display: flex;
    align-items: center;
    padding: 0 var(--mutation-padding);
  }

  /* Milestone marker */
  .flow-item.milestone-marker {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--milestone-padding);
    position: relative;
    cursor: pointer;
  }

  .ml-line {
    position: absolute;
    top: -0.5rem;
    bottom: -0.5rem;
    left: 50%;
    width: var(--spine-thickness);
    background: var(--ml-color);
    transform: translateX(-50%);
    z-index: -1;
  }

  .ml-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    color: #fff;
    background: var(--ml-color);
    border-radius: 0.5rem;
    z-index: 1;
    white-space: nowrap;
  }

  .ml-x {
    width: 0.75rem;
    height: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5rem;
    color: rgba(255,255,255,0.7);
    background: transparent;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    opacity: 0;
  }
  .ml-badge:hover .ml-x { opacity: 1; }
  .ml-x:hover { color: #fff; }

  /* Thread stripes above card */
  .thread-stripes {
    display: flex;
    gap: 0.125rem;
    height: 0.25rem;
    margin-bottom: 0.1875rem;
  }
  .thread-stripe {
    flex: 1;
    border-radius: 1px;
    min-width: 0.375rem;
  }

  /* Footer */
  .timeline-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0.25rem 0.75rem;
    background: var(--surface-raised);
    border-top: 1px solid var(--border-subtle);
  }
  .pos-indicator {
    font-size: 0.625rem;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
  }
</style>
