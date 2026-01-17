<script lang="ts">
  import type { TimelinePlacement } from '$lib/types';
  import { objects, timelineEditor, threads } from '$lib/stores';

  interface Props {
    placement: TimelinePlacement;
    compact?: boolean;
    oncontextmenu?: (e: MouseEvent) => void;
    onclick?: (e: MouseEvent) => void;
  }

  let { placement, compact = false, oncontextmenu, onclick }: Props = $props();

  // Object data
  const obj = $derived(objects.get(placement.objectId));
  const effectiveColor = $derived(obj ? objects.getEffectiveColor(obj.id) : '#888');

  // Selection state
  const isSelected = $derived(timelineEditor.selectedMutationIds.has(placement.id));

  // Thread colors
  const threadColors = $derived.by(() => {
    const colors: string[] = [];
    for (const threadId of placement.threadIds ?? []) {
      const thread = threads.get(threadId);
      if (thread && timelineEditor.isThreadVisible(threadId)) {
        colors.push(thread.color);
      }
    }
    return colors;
  });

  function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      timelineEditor.toggleMutationSelection(placement.id);
    } else {
      timelineEditor.selectMutation(placement.id);
    }

    onclick?.(e);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isSelected) {
      timelineEditor.selectMutation(placement.id);
    }

    oncontextmenu?.(e);
  }
</script>

{#if compact}
  <!-- Compact view: just a dot with tooltip -->
  <button
    class="mutation-marker compact"
    class:selected={isSelected}
    style:--marker-color={effectiveColor}
    onclick={handleClick}
    oncontextmenu={handleContextMenu}
    title={placement.mutation?.label ?? 'Mutation'}
  >
    <span class="marker-dot"></span>
    {#if threadColors.length > 0}
      <div class="thread-ring" style:background={threadColors[0]}></div>
    {/if}
  </button>
{:else}
  <!-- Full view: shows label -->
  <button
    class="mutation-marker full"
    class:selected={isSelected}
    style:--marker-color={effectiveColor}
    onclick={handleClick}
    oncontextmenu={handleContextMenu}
  >
    <!-- Thread indicators -->
    {#if threadColors.length > 0}
      <div class="thread-dots">
        {#each threadColors as color}
          <span class="thread-dot" style:background-color={color}></span>
        {/each}
      </div>
    {/if}

    <span class="marker-icon">~</span>
    <span class="marker-label">{placement.mutation?.label ?? 'Mutation'}</span>

    {#if obj}
      <span class="marker-object">{obj.name}</span>
    {/if}
  </button>
{/if}

<style>
  /* Compact marker (dot) */
  .mutation-marker.compact {
    position: relative;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: 50%;
    cursor: pointer;
    transition: transform var(--transition-fast), background-color var(--transition-fast);
  }

  .mutation-marker.compact:hover {
    background-color: var(--hover-bg);
    transform: scale(1.15);
  }

  .mutation-marker.compact.selected {
    background-color: color-mix(in srgb, var(--marker-color) 20%, var(--surface-raised));
    border-color: var(--marker-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--marker-color) 30%, transparent);
  }

  .marker-dot {
    width: 8px;
    height: 8px;
    background-color: var(--marker-color);
    border-radius: 50%;
  }

  .thread-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    opacity: 0.3;
  }

  /* Full marker (with label) */
  .mutation-marker.full {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background-color: var(--surface-raised);
    border: 1px dashed var(--marker-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-xs);
    transition:
      background-color var(--transition-fast),
      transform var(--transition-fast),
      border-style var(--transition-fast);
  }

  .mutation-marker.full:hover {
    background-color: var(--hover-bg);
    border-style: solid;
    transform: translateY(-1px);
  }

  .mutation-marker.full.selected {
    background-color: color-mix(in srgb, var(--marker-color) 15%, var(--surface-raised));
    border-style: solid;
    box-shadow: 0 0 0 1px var(--marker-color);
  }

  .thread-dots {
    display: flex;
    gap: 2px;
  }

  .thread-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .marker-icon {
    font-weight: bold;
    color: var(--marker-color);
  }

  .marker-label {
    color: var(--text-primary);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .marker-object {
    color: var(--text-tertiary);
    font-size: 10px;
    padding-left: var(--space-xs);
    border-left: 1px solid var(--border-subtle);
  }
</style>
