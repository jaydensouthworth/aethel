<script lang="ts">
  import type { AethelObject } from '$lib/types';
  import { getObjectType } from '$lib/types';

  interface Props {
    obj: AethelObject;
    selected?: boolean;
    onclick?: () => void;
  }

  let { obj, selected = false, onclick }: Props = $props();

  const objectType = $derived(getObjectType(obj.typeId));
</script>

<button
  class="timeline-block"
  class:selected
  class:rendered={obj.rendered}
  style:--block-color={objectType.color}
  {onclick}
>
  <span class="block-icon">{objectType.icon}</span>
  <span class="block-name">{obj.name}</span>
  {#if obj.rendered}
    <span class="rendered-indicator" title="Rendered in book">📖</span>
  {/if}
</button>

<style>
  .timeline-block {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--block-color);
    border-radius: var(--radius-md);
    background-color: var(--surface-raised);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    flex-shrink: 0;
    transition: all var(--transition-normal);
  }

  .timeline-block:hover {
    background-color: var(--hover-bg);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .timeline-block.selected {
    background-color: var(--selected-bg);
    box-shadow: 0 0 0 2px var(--block-color);
  }

  .timeline-block.rendered {
    border-style: solid;
  }

  .timeline-block:not(.rendered) {
    border-style: dashed;
    opacity: 0.7;
  }

  .timeline-block:not(.rendered):hover {
    opacity: 1;
  }

  .block-icon {
    font-size: var(--font-size-md);
  }

  .block-name {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rendered-indicator {
    font-size: 10px;
    margin-left: var(--space-xs);
  }
</style>
