<script lang="ts">
  import type { Milestone } from '$lib/types';

  interface Props {
    milestone: Milestone;
    oncontextmenu?: (e: MouseEvent) => void;
    onclick?: (e: MouseEvent) => void;
  }

  let { milestone, oncontextmenu, onclick }: Props = $props();

  const color = $derived(milestone.color ?? 'var(--accent-primary)');

  function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onclick?.(e);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    oncontextmenu?.(e);
  }
</script>

<div
  class="milestone-marker"
  style:--milestone-color={color}
  onclick={handleClick}
  oncontextmenu={handleContextMenu}
  role="button"
  tabindex="0"
>
  <!-- Vertical divider line -->
  <div class="divider-line"></div>

  <!-- Label badge -->
  <div class="milestone-badge">
    <span class="milestone-name">{milestone.name}</span>
    {#if milestone.exportAs}
      <span class="milestone-type">{milestone.exportAs}</span>
    {/if}
  </div>

  <!-- Bottom anchor -->
  <div class="divider-line bottom"></div>
</div>

<style>
  .milestone-marker {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 80px;
    cursor: pointer;
    padding: 0 var(--space-sm);
  }

  .divider-line {
    width: 2px;
    height: 20px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--milestone-color)
    );
  }

  .divider-line.bottom {
    background: linear-gradient(
      to bottom,
      var(--milestone-color),
      transparent
    );
  }

  .milestone-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-xs) var(--space-md);
    background-color: var(--surface-raised);
    border: 2px solid var(--milestone-color);
    border-radius: var(--radius-md);
    transition:
      background-color var(--transition-fast),
      transform var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .milestone-marker:hover .milestone-badge {
    background-color: color-mix(in srgb, var(--milestone-color) 10%, var(--surface-raised));
    transform: scale(1.05);
    box-shadow: var(--shadow-sm);
  }

  .milestone-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .milestone-type {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--milestone-color);
    background-color: color-mix(in srgb, var(--milestone-color) 15%, transparent);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
  }
</style>
