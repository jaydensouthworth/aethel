<script lang="ts">
  import type { TimelinePlacement } from '$lib/types';
  import { milestones, timeline } from '$lib/stores';

  interface Props {
    afterIndex: number;
    mutations?: TimelinePlacement[];
    onaddmilestone?: () => void;
    onmutationclick?: (placement: TimelinePlacement) => void;
  }

  let { afterIndex, mutations = [], onaddmilestone, onmutationclick }: Props = $props();

  // Check if there's a milestone at this position
  // Milestones appear "before" a timeslot, so to get milestone after index N,
  // we look for milestones before timeslot at index N+1
  const nextTimeslotId = $derived(timeline.getTimeslotIdAt(afterIndex + 1) ?? null);
  const milestone = $derived(milestones.getMilestonesBeforeTimeslot(nextTimeslotId)[0]);
  const hasMilestone = $derived(!!milestone);
  const hasMutations = $derived(mutations.length > 0);

  function handleMilestoneClick(e: MouseEvent) {
    e.stopPropagation();
    // Could open milestone editor
  }

  function handleAddMilestone(e: MouseEvent) {
    e.stopPropagation();
    onaddmilestone?.();
  }
</script>

<div
  class="progression-marker"
  class:has-milestone={hasMilestone}
  class:has-mutations={hasMutations}
>
  <!-- The dot/connector -->
  <div class="connector">
    <div class="dot"></div>
    <div class="line"></div>
  </div>

  <!-- Milestone label if present -->
  {#if milestone}
    <button
      class="milestone-label"
      style:--milestone-color={milestone.color ?? 'var(--text-tertiary)'}
      onclick={handleMilestoneClick}
    >
      {milestone.name}
      {#if milestone.exportAs}
        <span class="milestone-type">{milestone.exportAs}</span>
      {/if}
    </button>
  {:else}
    <!-- Add milestone button (shows on hover) -->
    <button
      class="add-milestone-btn"
      onclick={handleAddMilestone}
      title="Add milestone"
    >
      +
    </button>
  {/if}

  <!-- Mutations between cards -->
  {#if mutations.length > 0}
    <div class="mutations-between">
      {#each mutations as mutation}
        <button
          class="mutation-marker"
          onclick={() => onmutationclick?.(mutation)}
          title={mutation.mutation?.label ?? 'Mutation'}
        >
          <span class="mutation-icon">~</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .progression-marker {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    padding: var(--space-xs) 0;
  }

  /* Connector line and dot */
  .connector {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
  }

  .line {
    flex: 1;
    height: 1px;
    background-color: var(--border-default);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--surface-raised);
    border: 2px solid var(--border-default);
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    transition: transform var(--transition-fast), background-color var(--transition-fast);
  }

  .progression-marker:hover .dot {
    transform: translateX(-50%) scale(1.2);
    background-color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .progression-marker.has-milestone .dot {
    background-color: var(--milestone-color, var(--accent-primary));
    border-color: var(--milestone-color, var(--accent-primary));
    width: 10px;
    height: 10px;
  }

  /* Milestone label */
  .milestone-label {
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--milestone-color, var(--text-secondary));
    background-color: var(--surface-raised);
    padding: 2px var(--space-sm);
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--milestone-color, var(--border-default)) 40%, transparent);
    white-space: nowrap;
    cursor: pointer;
    transition: background-color var(--transition-fast), transform var(--transition-fast);
  }

  .milestone-label:hover {
    background-color: var(--hover-bg);
    transform: translateX(-50%) translateY(-2px);
  }

  .milestone-type {
    font-size: 9px;
    color: var(--text-tertiary);
    margin-left: var(--space-xs);
    text-transform: uppercase;
  }

  /* Add milestone button */
  .add-milestone-btn {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
    background-color: var(--surface-raised);
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--transition-fast), background-color var(--transition-fast);
  }

  .progression-marker:hover .add-milestone-btn {
    opacity: 1;
  }

  .add-milestone-btn:hover {
    background-color: var(--hover-bg);
    border-color: var(--border-default);
    color: var(--text-primary);
  }

  /* Mutations between */
  .mutations-between {
    position: absolute;
    bottom: -24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
  }

  .mutation-marker {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: 50%;
    cursor: pointer;
    transition: background-color var(--transition-fast), transform var(--transition-fast);
  }

  .mutation-marker:hover {
    background-color: var(--hover-bg);
    transform: scale(1.1);
  }

  .mutation-icon {
    font-size: 12px;
    font-weight: bold;
    color: var(--text-secondary);
  }
</style>
