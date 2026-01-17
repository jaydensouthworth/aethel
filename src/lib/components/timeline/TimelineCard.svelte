<script lang="ts">
  import type { TimelineCard as TCard } from '$lib/stores/timeline.svelte';
  import { getObjectType } from '$lib/types';
  import { objects, timelineEditor, threads } from '$lib/stores';

  interface Props {
    card: TCard;
    oncontextmenu?: (e: MouseEvent) => void;
    ondblclick?: (e: MouseEvent) => void;
    onmutationclick?: (placementId: string) => void;
  }

  let { card, oncontextmenu, ondblclick, onmutationclick }: Props = $props();

  // Object data
  const obj = $derived(card.object);
  const objectType = $derived(getObjectType(obj.typeId));
  const effectiveColor = $derived(objects.getEffectiveColor(obj.id));
  const effectiveIcon = $derived(objects.getEffectiveIcon(obj.id));

  // Selection state
  const isSelected = $derived(timelineEditor.selectedCardId === obj.id);

  // Thread colors for this card
  const cardThreads = $derived.by(() => {
    const result: Array<{ id: string; color: string; name: string }> = [];
    const seenIds = new Set<string>();

    for (const mutation of card.mutationsBelow) {
      for (const threadId of mutation.threadIds ?? []) {
        if (!seenIds.has(threadId)) {
          seenIds.add(threadId);
          const thread = threads.get(threadId);
          if (thread && timelineEditor.isThreadVisible(threadId)) {
            result.push({ id: thread.id, color: thread.color, name: thread.name });
          }
        }
      }
    }

    return result;
  });

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    timelineEditor.selectCard(obj.id);
  }

  function handleDoubleClick(e: MouseEvent) {
    e.stopPropagation();
    ondblclick?.(e);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSelected) {
      timelineEditor.selectCard(obj.id);
    }
    oncontextmenu?.(e);
  }

  function handleMutationClick(e: MouseEvent, placementId: string) {
    e.stopPropagation();
    onmutationclick?.(placementId);
  }
</script>

<div class="card-container">
  <!-- Main Card -->
  <button
    class="timeline-card"
    class:selected={isSelected}
    style:--card-color={effectiveColor}
    onclick={handleClick}
    ondblclick={handleDoubleClick}
    oncontextmenu={handleContextMenu}
  >
    <!-- Thread indicators at top -->
    {#if cardThreads.length > 0}
      <div class="thread-bar">
        {#each cardThreads as thread (thread.id)}
          <div
            class="thread-segment"
            style:background-color={thread.color}
            title={thread.name}
          ></div>
        {/each}
      </div>
    {/if}

    <div class="card-content">
      <span class="card-icon">{effectiveIcon}</span>
      <div class="card-info">
        <span class="card-name">{obj.name}</span>
        <span class="card-type">{objectType.name}</span>
      </div>
    </div>
  </button>

  <!-- Mutations Below Card -->
  {#if card.mutationsBelow.length > 0}
    <div class="mutations-below">
      {#each card.mutationsBelow as mutation (mutation.id)}
        {@const mutatedObj = objects.get(mutation.objectId)}
        {@const mutationColor = mutatedObj ? objects.getEffectiveColor(mutatedObj.id) : 'var(--text-tertiary)'}
        {@const mutationIcon = mutatedObj ? objects.getEffectiveIcon(mutatedObj.id) : '~'}
        <button
          class="mutation-item"
          style:--mutation-color={mutationColor}
          onclick={(e) => handleMutationClick(e, mutation.id)}
          title={mutation.mutation?.label ?? 'State change'}
        >
          <span class="mutation-icon">{mutationIcon}</span>
          <span class="mutation-label">{mutation.mutation?.label ?? 'Changed'}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .card-container {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .timeline-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--surface-raised);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    min-width: 180px;
    max-width: 240px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .timeline-card:hover {
    border-color: var(--border-default);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  .timeline-card:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .timeline-card.selected {
    border-color: var(--card-color);
    box-shadow: 0 0 0 1px var(--card-color), 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  /* Thread bar at top */
  .thread-bar {
    display: flex;
    height: 3px;
    gap: 0;
  }

  .thread-segment {
    flex: 1;
    min-width: 20px;
  }

  /* Card content */
  .card-content {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
  }

  .card-icon {
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .card-name {
    font-size: 13px;
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

  /* Mutations below */
  .mutations-below {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 4px;
  }

  .mutation-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: color-mix(in srgb, var(--mutation-color) 8%, var(--surface-sunken));
    border: 1px solid color-mix(in srgb, var(--mutation-color) 20%, transparent);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .mutation-item:hover {
    background: color-mix(in srgb, var(--mutation-color) 15%, var(--surface-sunken));
    border-color: color-mix(in srgb, var(--mutation-color) 35%, transparent);
  }

  .mutation-icon {
    font-size: 12px;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .mutation-label {
    font-size: 11px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
