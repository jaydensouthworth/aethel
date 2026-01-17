<script lang="ts">
  import { timeline, timelineEditor, milestones, threads, objects, ui } from '$lib/stores';
  import { getObjectType } from '$lib/types';

  interface Props {
    collapsed?: boolean;
  }

  let { collapsed = false }: Props = $props();

  // Timeline data
  const cards = $derived(timeline.cards);
  const allMilestones = $derived(milestones.all);
  const allThreads = $derived(threads.visible);
  const cursorIndex = $derived(timeline.cursorIndex);
  const cardCount = $derived(timeline.cardCount);

  // Build thread connection data for visualization
  const threadConnections = $derived.by(() => {
    const connections: Array<{
      threadId: string;
      color: string;
      cardIndices: number[];
    }> = [];

    for (const thread of allThreads) {
      const indices: number[] = [];

      // Find cards that have mutations belonging to this thread
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const hasThreadMutation = card.mutationsBelow.some(m =>
          m.threadIds?.includes(thread.id)
        );
        if (hasThreadMutation) {
          indices.push(i);
        }
      }

      if (indices.length > 0) {
        connections.push({
          threadId: thread.id,
          color: thread.color,
          cardIndices: indices,
        });
      }
    }

    return connections;
  });

  // Get milestone at a specific position (between cards)
  function getMilestoneAfter(afterIndex: number) {
    return allMilestones.find(m => m.afterIndex === afterIndex);
  }

  // Keyboard navigation
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

  function handleCardClick(objectId: string, index: number) {
    timelineEditor.selectCard(objectId);
    timeline.setCursorIndex(index);
  }

  function handleCardDoubleClick(objectId: string) {
    ui.select(objectId);
  }

  // Scroll container
  let scrollContainer: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (scrollContainer && cursorIndex >= 0 && !collapsed) {
      const cardEl = scrollContainer.querySelector(`[data-index="${cursorIndex}"]`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });
</script>

<div
  class="timeline"
  class:collapsed
  role="region"
  aria-label="Story Timeline"
  tabindex="0"
  onkeydown={handleKeyDown}
>
  {#if collapsed}
    <div class="collapsed-bar">
      <span class="collapsed-title">Timeline</span>
      <span class="collapsed-info">{cursorIndex + 1} of {cardCount}</span>
    </div>
  {:else if cardCount === 0}
    <div class="empty-state">
      <div class="empty-icon">📚</div>
      <h3 class="empty-title">Your story timeline is empty</h3>
      <p class="empty-description">Mark chapters and scenes as "Rendered" to see them here</p>
    </div>
  {:else}
    <!-- Thread ribbons at top -->
    {#if threadConnections.length > 0}
      <div class="thread-ribbons">
        {#each threadConnections as conn (conn.threadId)}
          {@const thread = threads.get(conn.threadId)}
          <div class="thread-ribbon" style:--thread-color={conn.color}>
            <span class="thread-name">{thread?.name ?? 'Thread'}</span>
            <div class="thread-dots">
              {#each Array(cardCount) as _, i}
                <div
                  class="thread-dot"
                  class:active={conn.cardIndices.includes(i)}
                  style:--dot-color={conn.cardIndices.includes(i) ? conn.color : 'transparent'}
                ></div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Main timeline track -->
    <div class="timeline-scroll" bind:this={scrollContainer}>
      <div class="timeline-track">
        {#each cards as card, i (card.object.id)}
          {@const obj = card.object}
          {@const objType = getObjectType(obj.typeId)}
          {@const color = objects.getEffectiveColor(obj.id)}
          {@const icon = objects.getEffectiveIcon(obj.id)}
          {@const isSelected = timelineEditor.selectedCardId === obj.id}
          {@const isCurrent = i === cursorIndex}
          {@const milestone = i > 0 ? getMilestoneAfter(i - 1) : null}
          {@const cardThreads = threadConnections.filter(c => c.cardIndices.includes(i))}

          <!-- Milestone divider -->
          {#if milestone}
            <div class="milestone" style:--milestone-color={milestone.color ?? '#8b5cf6'}>
              <div class="milestone-line"></div>
              <div class="milestone-label">
                <span class="milestone-name">{milestone.name}</span>
                {#if milestone.exportAs}
                  <span class="milestone-type">{milestone.exportAs}</span>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Connector line -->
          {#if i > 0 && !milestone}
            <div class="connector">
              <div class="connector-line"></div>
            </div>
          {/if}

          <!-- Card -->
          <button
            class="card"
            class:selected={isSelected}
            class:current={isCurrent}
            style:--card-color={color}
            data-index={i}
            onclick={() => handleCardClick(obj.id, i)}
            ondblclick={() => handleCardDoubleClick(obj.id)}
          >
            <!-- Thread indicators -->
            {#if cardThreads.length > 0}
              <div class="card-threads">
                {#each cardThreads as ct (ct.threadId)}
                  <div class="card-thread-dot" style:background-color={ct.color}></div>
                {/each}
              </div>
            {/if}

            <div class="card-main">
              <span class="card-icon">{icon}</span>
              <div class="card-text">
                <span class="card-name">{obj.name}</span>
                <span class="card-type">{objType.name}</span>
              </div>
            </div>

            <!-- Mutations below -->
            {#if card.mutationsBelow.length > 0}
              <div class="card-mutations">
                {#each card.mutationsBelow as mutation (mutation.id)}
                  {@const mutObj = objects.get(mutation.objectId)}
                  {@const mutIcon = mutObj ? objects.getEffectiveIcon(mutObj.id) : '~'}
                  {@const mutColor = mutObj ? objects.getEffectiveColor(mutObj.id) : '#888'}
                  <div class="mutation" style:--mutation-color={mutColor}>
                    <span class="mutation-icon">{mutIcon}</span>
                    <span class="mutation-label">{mutation.mutation?.label ?? 'Changed'}</span>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Cursor indicator -->
            {#if isCurrent}
              <div class="cursor-marker"></div>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Footer info -->
    <div class="timeline-footer">
      <div class="thread-legend">
        {#each threadConnections as conn (conn.threadId)}
          {@const thread = threads.get(conn.threadId)}
          <div class="legend-item">
            <div class="legend-dot" style:background-color={conn.color}></div>
            <span class="legend-name">{thread?.name}</span>
          </div>
        {/each}
      </div>
      <div class="position-info">
        <span class="position-current">{cursorIndex + 1}</span>
        <span class="position-divider">/</span>
        <span class="position-total">{cardCount}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: linear-gradient(180deg, #fafbfc 0%, #f3f4f6 100%);
    font-family: var(--font-sans);
  }

  :global([data-theme="dark"]) .timeline {
    background: linear-gradient(180deg, #1a1b1e 0%, #141517 100%);
  }

  .timeline:focus {
    outline: none;
  }

  /* Collapsed */
  .collapsed-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0 16px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border-subtle);
  }

  .collapsed-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .collapsed-info {
    font-size: 12px;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 40px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px;
  }

  .empty-description {
    font-size: 13px;
    color: var(--text-tertiary);
    margin: 0;
  }

  /* Thread ribbons */
  .thread-ribbons {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 16px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border-subtle);
  }

  .thread-ribbon {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 20px;
  }

  .thread-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--thread-color);
    min-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-dots {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .thread-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dot-color);
    border: 1px solid color-mix(in srgb, var(--thread-color) 30%, transparent);
    transition: transform 0.15s ease;
  }

  .thread-dot.active {
    transform: scale(1.2);
    border-color: var(--thread-color);
  }

  /* Timeline scroll */
  .timeline-scroll {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 24px 20px;
  }

  .timeline-scroll::-webkit-scrollbar {
    height: 8px;
  }

  .timeline-scroll::-webkit-scrollbar-track {
    background: var(--surface-sunken);
    border-radius: 4px;
  }

  .timeline-scroll::-webkit-scrollbar-thumb {
    background: var(--border-default);
    border-radius: 4px;
  }

  .timeline-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--border-strong);
  }

  /* Timeline track */
  .timeline-track {
    display: flex;
    align-items: flex-start;
    min-width: max-content;
    padding: 16px 0;
  }

  /* Milestone */
  .milestone {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 8px;
    margin: 0 4px;
  }

  .milestone-line {
    width: 2px;
    height: 100%;
    min-height: 100px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      var(--milestone-color) 20%,
      var(--milestone-color) 80%,
      transparent 100%
    );
  }

  .milestone-label {
    position: absolute;
    top: -8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 12px;
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--milestone-color) 40%, var(--border-subtle));
    border-radius: 16px;
    white-space: nowrap;
  }

  .milestone-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--milestone-color);
  }

  .milestone-type {
    font-size: 9px;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Connector */
  .connector {
    display: flex;
    align-items: center;
    width: 40px;
    padding: 0 4px;
  }

  .connector-line {
    flex: 1;
    height: 2px;
    background: var(--border-default);
  }

  /* Card */
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    max-width: 260px;
    background: var(--surface-raised);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .card:hover {
    border-color: var(--border-default);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  .card:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .card.selected {
    border-color: var(--card-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--card-color) 20%, transparent),
                0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .card.current::before {
    content: '';
    position: absolute;
    inset: -3px;
    border: 2px solid var(--accent-primary);
    border-radius: 12px;
    pointer-events: none;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  /* Card thread indicators */
  .card-threads {
    display: flex;
    gap: 0;
    height: 4px;
  }

  .card-thread-dot {
    flex: 1;
    min-width: 24px;
  }

  /* Card main content */
  .card-main {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
  }

  .card-icon {
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
  }

  .card-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .card-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-type {
    font-size: 11px;
    color: var(--text-tertiary);
    text-transform: capitalize;
  }

  /* Card mutations */
  .card-mutations {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 8px 10px;
  }

  .mutation {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--mutation-color) 8%, var(--surface-sunken));
    border-left: 3px solid var(--mutation-color);
    border-radius: 6px;
  }

  .mutation-icon {
    font-size: 13px;
    flex-shrink: 0;
  }

  .mutation-label {
    font-size: 12px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Cursor marker */
  .cursor-marker {
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 10px solid var(--accent-primary);
  }

  /* Footer */
  .timeline-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--surface-raised);
    border-top: 1px solid var(--border-subtle);
  }

  .thread-legend {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .legend-name {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .position-info {
    display: flex;
    align-items: baseline;
    gap: 2px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .position-current {
    font-weight: 600;
    color: var(--text-primary);
  }

  .position-divider {
    color: var(--text-tertiary);
  }

  .position-total {
    color: var(--text-tertiary);
  }
</style>
